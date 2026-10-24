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
