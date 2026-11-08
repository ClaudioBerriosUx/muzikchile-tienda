import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { CORREO_CONTACTO } from "@/lib/site";

/**
 * Envío de correos transaccionales por la API de Resend, con registro en la
 * tabla `correos` (migración 20261108010000).
 *
 * Cada correo es un (tipo, referencia) único: sale una sola vez aunque Mercado
 * Pago repita el aviso o el cron lo reintente. Si ya salió, no se vuelve a
 * mandar. Resend recibe además una Idempotency-Key con el mismo par, por si dos
 * envíos se cruzan.
 *
 * Sin RESEND_API_KEY:
 *   - en producción (VERCEL_ENV=production), el correo queda `fallido` con el
 *     motivo en el log: nunca se omite en silencio, y el cron lo reintenta;
 *   - fuera de producción se guarda en supabase/.temp/correos/ (`buzon_local`),
 *     que es lo que leen las pruebas. `npm run dev:pruebas` siempre vacía la
 *     llave, para que una prueba nunca mande un correo de verdad.
 *
 * Requiere service role.
 */

export type TipoCorreo =
  | "confirmacion_compra"
  | "nueva_venta"
  | "tienda_solicitud"
  | "tienda_aprobada"
  | "tienda_devuelta"
  | "tienda_suspendida";

export interface Correo {
  para: string;
  asunto: string;
  html: string;
  texto: string;
}

/** Lo que devuelve quien arma el correo: el correo, o por qué no se puede. */
export type Armado = { ok: true; correo: Correo } | { ok: false; error: string };

export type ResultadoEnvio = "enviado" | "fallido" | "buzon_local" | "ya_enviado";

export const REMITENTE = "MuzikChile <noreply@muzikchile.cl>";

/** Cuántas veces lo intenta el cron antes de dejarlo para revisión manual. */
export const MAX_INTENTOS = 5;

const YA_SALIO = new Set(["enviado", "buzon_local"]);

export async function enviarCorreo(
  servicio: SupabaseClient<Database>,
  tipo: TipoCorreo,
  referencia: string,
  armar: () => Promise<Armado>
): Promise<ResultadoEnvio> {
  // 1. La fila del correo: se crea una vez; si ya salió, no se repite.
  const { error: errFila } = await servicio
    .from("correos")
    .upsert({ tipo, referencia }, { onConflict: "tipo,referencia", ignoreDuplicates: true });
  if (errFila) {
    console.error(`[correo] no se pudo registrar ${tipo} ${referencia}:`, errFila.message);
    return "fallido";
  }
  const { data: fila, error: errLeer } = await servicio
    .from("correos")
    .select("id, estado, intentos")
    .eq("tipo", tipo)
    .eq("referencia", referencia)
    .single();
  if (errLeer || !fila) {
    console.error(`[correo] no se pudo leer ${tipo} ${referencia}:`, errLeer?.message);
    return "fallido";
  }
  if (YA_SALIO.has(fila.estado)) return "ya_enviado";
  // Agotó sus intentos: queda para revisión manual en /admin/ordenes.
  if (fila.estado === "fallido" && fila.intentos >= MAX_INTENTOS) return "fallido";

  const terminar = async (estado: "enviado" | "fallido" | "buzon_local", extra: { destinatario?: string; resend_id?: string; ultimo_error?: string | null }) => {
    const { error } = await servicio
      .from("correos")
      .update({
        estado,
        intentos: fila.intentos + 1,
        ultimo_error: extra.ultimo_error ?? null,
        ...(extra.destinatario ? { destinatario: extra.destinatario } : {}),
        ...(extra.resend_id ? { resend_id: extra.resend_id } : {}),
        ...(estado === "fallido" ? {} : { enviado_at: new Date().toISOString() }),
      })
      .eq("id", fila.id);
    if (error) console.error(`[correo] no se pudo actualizar ${tipo} ${referencia}:`, error.message);
    if (estado === "fallido") console.error(`[correo] ${tipo} ${referencia} falló:`, extra.ultimo_error);
    return estado;
  };

  // 2. El contenido, armado desde la base.
  let armado: Armado;
  try {
    armado = await armar();
  } catch (err) {
    armado = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!armado.ok) return terminar("fallido", { ultimo_error: armado.error });
  const { correo } = armado;

  // 3. El envío.
  const llave = process.env.RESEND_API_KEY?.trim();
  if (!llave) {
    if (process.env.VERCEL_ENV === "production") {
      return terminar("fallido", { destinatario: correo.para, ultimo_error: "Falta RESEND_API_KEY en producción" });
    }
    const error = await guardarEnBuzonLocal(tipo, referencia, correo);
    return terminar("buzon_local", { destinatario: correo.para, ultimo_error: error });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${llave}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `${tipo}/${referencia}`,
      },
      body: JSON.stringify({
        from: REMITENTE,
        to: [correo.para],
        reply_to: CORREO_CONTACTO,
        subject: correo.asunto,
        html: correo.html,
        text: correo.texto,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return terminar("fallido", { destinatario: correo.para, ultimo_error: `Resend ${res.status}: ${data?.message ?? "sin detalle"}` });
    }
    return terminar("enviado", { destinatario: correo.para, resend_id: data?.id });
  } catch (err) {
    return terminar("fallido", { destinatario: correo.para, ultimo_error: `Resend: ${err instanceof Error ? err.message : String(err)}` });
  }
}

/** Fuera de producción y sin llave: el correo queda en un archivo. Devuelve el error, si hubo. */
async function guardarEnBuzonLocal(tipo: TipoCorreo, referencia: string, correo: Correo): Promise<string | null> {
  try {
    const dir = path.join(process.cwd(), "supabase", ".temp", "correos");
    await mkdir(dir, { recursive: true });
    const archivo = path.join(dir, `${tipo}--${referencia.replace(/[^a-zA-Z0-9-]/g, "_")}.json`);
    await writeFile(archivo, JSON.stringify({ tipo, referencia, ...correo }, null, 2), "utf8");
    return null;
  } catch (err) {
    return `Buzón local: ${err instanceof Error ? err.message : String(err)}`;
  }
}
