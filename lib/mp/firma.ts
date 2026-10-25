import { InvalidWebhookSignatureError, WebhookSignatureValidator } from "mercadopago";

/**
 * Firma de los avisos de Mercado Pago (header x-signature), fase 1: solo se
 * revisa y se anota en el log; el webhook procesa el aviso igual.
 *
 * MP firma con HMAC-SHA256 (hex, clave secreta de la aplicación) el texto
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, donde data.id sale de la
 * query (en minúsculas) y un par que falta se omite. La firma no cubre el body:
 * lo que trae el body (p. ej. el user_id de mp-connect) se sigue confirmando
 * contra la API de MP. La comparación la hace el validador del SDK oficial, en
 * tiempo constante.
 *
 * MP_WEBHOOK_SECRET admite varias claves separadas por coma (modo de prueba y
 * productivo, o una rotación). El registro dice cuál coincidió por posición,
 * nunca por valor, y no incluye ni la clave ni los hashes.
 */

export type ResultadoFirma = "valida" | "invalida" | "sin_firma" | "malformada" | "sin_secret" | "error";

export interface RegistroFirma {
  resultado: ResultadoFirma;
  /** Motivo del SDK cuando no es válida (SignatureMismatch, MissingTimestamp…). */
  motivo?: string;
  /** webhook (data.id/type), ipn (id/topic), mp-connect o desconocido. */
  aviso: "webhook" | "ipn" | "mp-connect" | "desconocido";
  tipo: string | null;
  /** Según la URL: las preferencias marketplace traen ?grupo=. */
  cobro: "centralizado" | "marketplace";
  id_desde: "query" | "body" | "ninguno";
  /** Posición en MP_WEBHOOK_SECRET de la clave que coincidió. */
  clave?: number;
  /** Diferencia entre la hora del servidor y el ts de la firma, en segundos. */
  desfase_s?: number;
  request_id?: string;
}

export interface EntradaFirma {
  xSignature: string | null;
  xRequestId: string | null;
  query: URLSearchParams;
  body: unknown;
  /** Valor crudo de MP_WEBHOOK_SECRET. */
  secretos: string | undefined;
  ahora?: number;
}

type Body = { type?: unknown; topic?: unknown; data?: { id?: unknown } };

/** El ts viene en segundos en unos ejemplos de MP y en milisegundos en otros. */
function desfaseSegundos(xSignature: string, ahora: number): number | undefined {
  const ts = xSignature.match(/(?:^|,)\s*ts=(\d+)/)?.[1];
  if (!ts) return undefined;
  const n = Number(ts);
  const ms = n < 1e12 ? n * 1000 : n;
  return Math.round((ahora - ms) / 1000);
}

export function revisarFirma(e: EntradaFirma): RegistroFirma {
  const body = (e.body && typeof e.body === "object" ? e.body : {}) as Body;
  const tipo = String(body.type ?? body.topic ?? e.query.get("type") ?? e.query.get("topic") ?? "") || null;

  const idQuery = e.query.get("data.id");
  const idBody = body.data?.id != null ? String(body.data.id) : null;
  const dataId = idQuery ?? idBody;

  const aviso: RegistroFirma["aviso"] =
    tipo === "mp-connect" ? "mp-connect"
    : dataId ? "webhook"
    : e.query.has("topic") && e.query.has("id") ? "ipn"
    : "desconocido";

  const registro: RegistroFirma = {
    resultado: "error",
    aviso,
    tipo,
    cobro: e.query.has("grupo") ? "marketplace" : "centralizado",
    id_desde: idQuery ? "query" : idBody ? "body" : "ninguno",
  };
  if (e.xRequestId) registro.request_id = e.xRequestId.slice(0, 64);

  try {
    const claves = (e.secretos ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!e.xSignature?.trim()) return { ...registro, resultado: "sin_firma" };
    registro.desfase_s = desfaseSegundos(e.xSignature, e.ahora ?? Date.now());
    if (claves.length === 0) return { ...registro, resultado: "sin_secret" };

    for (const [i, secret] of claves.entries()) {
      try {
        WebhookSignatureValidator.validate({
          xSignature: e.xSignature,
          xRequestId: e.xRequestId ?? undefined,
          dataId: dataId ?? undefined,
          secret,
        });
        return { ...registro, resultado: "valida", clave: i };
      } catch (err) {
        if (!(err instanceof InvalidWebhookSignatureError)) throw err;
        if (err.reason === "SignatureMismatch") continue;
        // Header vacío, sin ts o sin v1: no depende de la clave.
        return { ...registro, resultado: "malformada", motivo: err.reason };
      }
    }
    return { ...registro, resultado: "invalida", motivo: "SignatureMismatch" };
  } catch (err) {
    return { ...registro, resultado: "error", motivo: err instanceof Error ? err.name : "desconocido" };
  }
}
