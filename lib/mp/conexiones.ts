import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { cifrar, descifrar } from "./cifrado";
import { ErrorMP, obtenerUsuario, renovarToken, type TokenMP, type UsuarioMP } from "./oauth";

/**
 * Conexiones de Mercado Pago de los artistas (tabla mp_conexiones). Solo
 * servidor, con service role: la tabla no tiene políticas RLS.
 */

type Servicio = SupabaseClient<Database>;
type Conexion = Database["public"]["Tables"]["mp_conexiones"]["Row"];

/** Margen: un token que vence antes de esto se renueva antes de usarlo. */
const RENOVAR_SI_VENCE_EN_MS = 7 * 24 * 60 * 60 * 1000;

export function clienteServicio(): Servicio {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Artista de la sesión actual (cookies de Supabase), o null. La sesión se
 * valida contra Supabase Auth (getUser), no solo se lee la cookie.
 */
export async function artistaDeLaSesion(servicio: Servicio): Promise<{ userId: string; artistaId: string } | null> {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: artista } = await servicio.from("artistas").select("id").eq("user_id", user.id).maybeSingle();
  if (!artista) return null;
  return { userId: user.id, artistaId: artista.id };
}

let cuentaPlataforma: number | null = null;

/**
 * Id de la cuenta de MP de MuzikChile (dueña de la aplicación, la que cobra
 * en el modelo centralizado). Un artista no puede conectar esa cuenta: es el
 * error típico de autorizar con la sesión de MP equivocada abierta.
 */
export async function idCuentaPlataforma(servicio: Servicio): Promise<number | null> {
  if (cuentaPlataforma) return cuentaPlataforma;
  const { data } = await servicio.from("app_settings").select("value").eq("key", "mp_access_token").maybeSingle();
  if (!data?.value) return null;
  cuentaPlataforma = (await obtenerUsuario(data.value)).id;
  return cuentaPlataforma;
}

function filaDesdeToken(token: TokenMP) {
  return {
    access_token_cifrado:  cifrar(token.access_token),
    refresh_token_cifrado: cifrar(token.refresh_token),
    public_key:            token.public_key ?? null,
    live_mode:             token.live_mode,
    scope:                 token.scope ?? null,
    expires_at:            new Date(Date.now() + token.expires_in * 1000).toISOString(),
  };
}

export async function guardarConexion(servicio: Servicio, artistaId: string, token: TokenMP, usuario: UsuarioMP) {
  const ahora = new Date().toISOString();
  return servicio.from("mp_conexiones").upsert({
    artista_id:        artistaId,
    mp_user_id:        usuario.id,
    nickname:          usuario.nickname ?? null,
    email:             usuario.email ?? null,
    ...filaDesdeToken(token),
    estado:            "conectado",
    ultimo_error:      null,
    refrescando_hasta: null,
    conectado_at:      ahora,
    refrescado_at:     null,
    updated_at:        ahora,
  });
}

export type ResultadoRenovacion = "renovado" | "reconectar" | "reintentar" | "ocupado";

/**
 * Renueva el token de un artista. Toma el lock de la base para que dos
 * renovaciones no usen el mismo refresh_token (rota en cada uso).
 *   - 'renovado'   → tokens nuevos guardados.
 *   - 'reconectar' → MP rechazó la renovación (autorización revocada o
 *                    vencida): queda en estado 'reconectar' y cobros_activos
 *                    se apaga solo (trigger).
 *   - 'reintentar' → MP no respondió; se intenta de nuevo en la próxima pasada.
 *   - 'ocupado'    → otra renovación está en curso.
 */
export async function renovarConexion(servicio: Servicio, conexion: Conexion): Promise<ResultadoRenovacion> {
  const { data: tomado, error: lockError } = await servicio.rpc("tomar_lock_renovacion_mp", { p_artista_id: conexion.artista_id });
  if (lockError) throw lockError;
  if (!tomado) return "ocupado";

  const ahora = new Date().toISOString();
  try {
    const token = await renovarToken(descifrar(conexion.refresh_token_cifrado));
    const { error } = await servicio
      .from("mp_conexiones")
      .update({
        ...filaDesdeToken(token),
        estado:            "conectado",
        ultimo_error:      null,
        refrescando_hasta: null,
        refrescado_at:     ahora,
        updated_at:        ahora,
      })
      .eq("artista_id", conexion.artista_id);
    if (error) throw error;
    return "renovado";
  } catch (err) {
    const reintentable = !(err instanceof ErrorMP) || err.reintentable;
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error("[mp] renovación falló:", conexion.artista_id, mensaje, err instanceof ErrorMP ? JSON.stringify(err.detalle) : "");
    await servicio
      .from("mp_conexiones")
      .update({
        ...(reintentable ? {} : { estado: "reconectar" }),
        ultimo_error:      mensaje,
        refrescando_hasta: null,
        updated_at:        ahora,
      })
      .eq("artista_id", conexion.artista_id);
    return reintentable ? "reintentar" : "reconectar";
  }
}

export type ResultadoDesvinculacion =
  | "sin_conexion"   // ninguna conexión activa con ese user_id de MP
  | "no_confirmada"  // MP sigue aceptando el token: el aviso no se cree
  | "renovada"       // el token solo había vencido; la renovación salió bien
  | "reconectar"     // MP rechazó token y renovación: quedó en 'reconectar'
  | "sin_token"      // no se pudo descifrar (otra MP_TOKENS_KEY): no se toca
  | "reintentar";    // MP no respondió u otra renovación en curso

/**
 * Aviso mp-connect `application.deauthorized`: el artista desvinculó la app
 * desde su cuenta de MP. El aviso no se cree (puede ser falso o viejo): se
 * pregunta a MP con el token del artista. Si MP lo rechaza, se intenta renovar
 * (puede ser solo un token vencido); si también rechaza la renovación,
 * renovarConexion deja la conexión en 'reconectar' y el trigger apaga
 * cobros_activos.
 */
export async function procesarDesvinculacion(servicio: Servicio, mpUserId: number): Promise<ResultadoDesvinculacion> {
  const { data: conexion, error } = await servicio
    .from("mp_conexiones")
    .select("*")
    .eq("mp_user_id", mpUserId)
    .eq("estado", "conectado")
    .maybeSingle();
  if (error) throw error;
  if (!conexion) return "sin_conexion";

  let accessToken: string;
  try {
    accessToken = descifrar(conexion.access_token_cifrado);
  } catch {
    console.error("[mp] desvinculación: el token no se pudo descifrar (¿otra MP_TOKENS_KEY?):", conexion.artista_id);
    return "sin_token";
  }

  try {
    await obtenerUsuario(accessToken);
    console.error("[mp] desvinculación no confirmada: MP sigue aceptando el token de", conexion.artista_id);
    return "no_confirmada";
  } catch (err) {
    if (!(err instanceof ErrorMP) || err.reintentable) return "reintentar";
    if (err.status !== 401 && err.status !== 403) {
      console.error("[mp] desvinculación: respuesta inesperada de MP, no se toca la conexión:", conexion.artista_id, err.status);
      return "no_confirmada";
    }
  }

  const r = await renovarConexion(servicio, conexion);
  if (r === "renovado") return "renovada";
  if (r === "reconectar") {
    await servicio
      .from("mp_conexiones")
      .update({ ultimo_error: "Desvinculada desde Mercado Pago" })
      .eq("artista_id", conexion.artista_id)
      .eq("estado", "reconectar");
    return "reconectar";
  }
  return "reintentar";
}

/**
 * Token del artista listo para usar (renovado si está por vencer). Lo usará
 * crear-preferencia en el modelo marketplace.
 */
export async function tokenVigente(
  servicio: Servicio,
  artistaId: string
): Promise<{ ok: true; accessToken: string; mpUserId: number } | { ok: false; motivo: "no_conectado" | "reconectar" | "no_disponible" }> {
  const leer = () => servicio.from("mp_conexiones").select("*").eq("artista_id", artistaId).maybeSingle();

  let { data: conexion } = await leer();
  if (!conexion) return { ok: false, motivo: "no_conectado" };
  if (conexion.estado !== "conectado") return { ok: false, motivo: "reconectar" };

  if (new Date(conexion.expires_at).getTime() - Date.now() < RENOVAR_SI_VENCE_EN_MS) {
    const r = await renovarConexion(servicio, conexion);
    if (r === "reconectar") return { ok: false, motivo: "reconectar" };
    ({ data: conexion } = await leer());
    if (!conexion || conexion.estado !== "conectado") return { ok: false, motivo: "reconectar" };
  }

  // Si la renovación falló por un problema temporal, el token viejo sirve
  // mientras no haya vencido.
  if (new Date(conexion.expires_at).getTime() <= Date.now()) return { ok: false, motivo: "no_disponible" };

  // Un token cifrado con otra MP_TOKENS_KEY (p. ej. conectado desde un preview)
  // no se puede usar acá: el artista no puede cobrar, pero no es un error 500.
  let accessToken: string;
  try {
    accessToken = descifrar(conexion.access_token_cifrado);
  } catch (err) {
    console.error("[mp] el token del artista no se pudo descifrar (¿otra MP_TOKENS_KEY?):", artistaId, err instanceof Error ? err.message : err);
    return { ok: false, motivo: "no_disponible" };
  }
  return { ok: true, accessToken, mpUserId: Number(conexion.mp_user_id) };
}
