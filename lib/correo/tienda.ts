import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { BASE_URL, CORREO_CONTACTO } from "@/lib/site";
import { enviarCorreo, type Armado, type ResultadoEnvio, type TipoCorreo } from "@/lib/correo/enviar";
import { boton, esc, marco, p } from "@/lib/correo/plantilla";

/**
 * Correos de la activación de tienda (commit 8c):
 *   - tienda_solicitud, a MuzikChile (hola@): un artista pidió activar su tienda.
 *   - tienda_aprobada, tienda_devuelta y tienda_suspendida, al artista: el
 *     resultado, con el comentario o el motivo que escribió el admin.
 *
 * Los mandan las rutas que cambian el estado, justo después del cambio, y el
 * cron /api/cron/correos reintenta los que fallaron. La referencia es
 * artista:momento del evento (solicitada_at o resuelta_at): cada solicitud o
 * resolución es un correo distinto, pero un reintento no la repite. Si la tienda
 * ya pasó a otro estado, no se manda: el correo describiría algo que ya cambió.
 */

export type TipoCorreoTienda = Extract<TipoCorreo, `tienda_${string}`>;

const ESTADO_DE: Record<TipoCorreoTienda, string> = {
  tienda_solicitud: "solicitada",
  tienda_aprobada: "activa",
  tienda_devuelta: "devuelta",
  tienda_suspendida: "suspendida",
};

export type ResultadoCorreoTienda = ResultadoEnvio | "estado_cambio";

/** Para leer el tipo desde la tabla correos sin cast. */
export function esTipoCorreoTienda(tipo: string): tipo is TipoCorreoTienda {
  return tipo in ESTADO_DE;
}

export async function enviarCorreoTienda(
  servicio: SupabaseClient<Database>,
  artistaId: string,
  tipo: TipoCorreoTienda
): Promise<ResultadoCorreoTienda> {
  const { data: t, error } = await servicio
    .from("tiendas")
    .select("estado, comentario_moderacion, solicitada_at, resuelta_at, artistas(nombre, user_id)")
    .eq("artista_id", artistaId)
    .maybeSingle();
  if (error || !t) {
    console.error(`[correo tienda] no se pudo leer la tienda ${artistaId}:`, error?.message);
    return "fallido";
  }
  if (t.estado !== ESTADO_DE[tipo]) return "estado_cambio";

  const momento = tipo === "tienda_solicitud" ? t.solicitada_at : t.resuelta_at;
  const referencia = `${artistaId}:${momento ?? "sin-fecha"}`;
  const nombre = t.artistas?.nombre ?? "Artista";

  return enviarCorreo(servicio, tipo, referencia, async (): Promise<Armado> => {
    if (tipo === "tienda_solicitud") return { ok: true, correo: armarSolicitud(nombre) };

    const userId = t.artistas?.user_id;
    if (!userId) return { ok: false, error: "El artista no tiene cuenta" };
    const { data, error: errUsuario } = await servicio.auth.admin.getUserById(userId);
    if (errUsuario) return { ok: false, error: `No se pudo leer la cuenta del artista: ${errUsuario.message}` };
    const para = data.user?.email;
    if (!para) return { ok: false, error: "El artista no tiene correo en su cuenta" };

    const texto = t.comentario_moderacion?.trim() ?? "";
    if (tipo === "tienda_aprobada") return { ok: true, correo: armarAprobada(para, nombre) };
    if (tipo === "tienda_devuelta") return { ok: true, correo: armarDevuelta(para, nombre, texto) };
    return { ok: true, correo: armarSuspendida(para, nombre, texto) };
  });
}

/** Párrafos → HTML y texto, con los que vienen ya en HTML marcados. */
function armar(para: string, asunto: string, partes: { html: string; texto: string }[], cta?: [string, string]) {
  const html = marco(asunto, partes.map((x) => p(x.html)).join("\n") + (cta ? boton(cta[0], cta[1]) : ""));
  const texto = [...partes.map((x) => x.texto), ...(cta ? [`${cta[1]}: ${cta[0]}`] : []), `MuzikChile · ${BASE_URL} · ${CORREO_CONTACTO}`].join("\n\n");
  return { para, asunto, html, texto };
}
const linea = (texto: string) => ({ html: esc(texto), texto });

function armarSolicitud(nombre: string) {
  return armar(CORREO_CONTACTO, `Solicitud de tienda: ${nombre}`, [
    linea(`${nombre} pidió activar su tienda en MuzikChile.`),
    linea("Revísala en la bandeja de tiendas: el checklist se ve en vivo, y puedes aprobarla o devolverla con un comentario."),
  ], [`${BASE_URL}/admin/tiendas`, "Abrir la bandeja de tiendas"]);
}

function armarAprobada(para: string, nombre: string) {
  return armar(para, "Tu tienda en MuzikChile está activa", [
    linea(`Hola ${nombre},`),
    { html: "<strong>Aprobamos tu tienda.</strong> Ya está activa.", texto: "Aprobamos tu tienda. Ya está activa." },
    linea("Cada producto pasa por revisión antes de publicarse: envía tus borradores a revisión desde tu panel. Durante el piloto, tus productos se abren a la venta cuando MuzikChile habilite las compras del público."),
    linea("Cuando tengas una venta pagada te avisamos por correo, con qué despachar, a quién y en qué plazo."),
  ], [`${BASE_URL}/panel/tienda`, "Ir a Mi tienda"]);
}

function armarDevuelta(para: string, nombre: string, comentario: string) {
  return armar(para, "Tu solicitud de tienda necesita cambios", [
    linea(`Hola ${nombre},`),
    linea("Revisamos tu solicitud para activar tu tienda y necesita algunos cambios antes de aprobarla:"),
    { html: `<em>${esc(comentario || "Sin comentario.")}</em>`, texto: `"${comentario || "Sin comentario."}"` },
    linea("Corrígelos en Mi tienda y vuelve a solicitar la activación desde ahí."),
  ], [`${BASE_URL}/panel/tienda`, "Ir a Mi tienda"]);
}

function armarSuspendida(para: string, nombre: string, motivo: string) {
  return armar(para, "Tu tienda en MuzikChile está suspendida", [
    linea(`Hola ${nombre},`),
    { html: "<strong>Suspendimos tu tienda.</strong> Tus productos dejan de venderse mientras dure la suspensión.", texto: "Suspendimos tu tienda. Tus productos dejan de venderse mientras dure la suspensión." },
    { html: `Motivo: <em>${esc(motivo || "Sin motivo indicado.")}</em>`, texto: `Motivo: "${motivo || "Sin motivo indicado."}"` },
    linea(`Debes cumplir igual los pedidos ya pagados. Cuando lo corrijas, responde a este correo o escribe a ${CORREO_CONTACTO} y revisamos la reactivación.`),
  ], [`${BASE_URL}/panel/tienda`, "Ir a Mi tienda"]);
}
