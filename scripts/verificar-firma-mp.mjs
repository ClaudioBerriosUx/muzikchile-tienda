/**
 * Verificación de la firma de los avisos de Mercado Pago (lib/mp/firma.ts).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CORRERLO
 *
 *   npm run verificar:firma
 *
 * Sin red ni base: las firmas se arman acá con node:crypto, siguiendo el
 * formato de MP (`id:<data.id>;request-id:<x-request-id>;ts:<ts>;`), y no con
 * el SDK que usa lib/mp/firma.ts, para no validar el SDK contra sí mismo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createHmac } from "node:crypto";
// Node 24 importa TypeScript sin compilar (solo quita los tipos).
import { revisarFirma } from "../lib/mp/firma.ts";

const CLAVE = "clave-de-prueba-0123456789abcdef";
const OTRA = "otra-clave-de-prueba-fedcba9876543210";
const AHORA = 1_800_000_000_000; // ms

function firmar({ id, requestId, ts, clave = CLAVE }) {
  const partes = [];
  if (id) partes.push(`id:${String(id).toLowerCase()}`);
  if (requestId) partes.push(`request-id:${requestId}`);
  partes.push(`ts:${ts}`);
  const hash = createHmac("sha256", clave).update(partes.join(";") + ";").digest("hex");
  return { header: `ts=${ts},v1=${hash}`, hash };
}

const resultados = [];
function check(caso, ok, detalle) {
  resultados.push({ caso, ok });
  console.log(`  ${ok ? "✓" : "✗"} ${caso}`);
  if (!ok && detalle) console.log(`      ${JSON.stringify(detalle)}`);
}

const revisar = ({ header, requestId = "req-123", query = "", body = {}, secretos = CLAVE }) =>
  revisarFirma({
    xSignature: header ?? null,
    xRequestId: requestId,
    query: new URLSearchParams(query),
    body,
    secretos,
    ahora: AHORA,
  });

const filtrados = [];
function sinSecretos(caso, registro, hash) {
  const texto = JSON.stringify(registro);
  if ([CLAVE, OTRA, hash].some((s) => s && texto.includes(s))) filtrados.push(caso);
}

console.log("Verificación · firma de avisos de Mercado Pago\n");

const tsMs = AHORA - 3000;
{
  const f = firmar({ id: "123456", requestId: "req-123", ts: tsMs });
  const r = revisar({ header: f.header, query: "data.id=123456&type=payment" });
  sinSecretos("f1", r, f.hash);
  check("(f1) Firma correcta → valida, clave 0, aviso webhook, id desde la query, desfase 3 s",
    r.resultado === "valida" && r.clave === 0 && r.aviso === "webhook" && r.id_desde === "query" && r.desfase_s === 3 && r.tipo === "payment", r);
}
{
  const f = firmar({ id: "123456", requestId: "req-123", ts: tsMs });
  const alterado = f.header.slice(0, -1) + (f.header.endsWith("0") ? "1" : "0");
  const r = revisar({ header: alterado, query: "data.id=123456&type=payment" });
  sinSecretos("f2", r, f.hash);
  check("(f2) Hash alterado → invalida (SignatureMismatch)", r.resultado === "invalida" && r.motivo === "SignatureMismatch", r);
}
{
  const f = firmar({ id: "999999", requestId: "req-123", ts: tsMs });
  const r = revisar({ header: f.header, query: "data.id=123456&type=payment" });
  check("(f3) Firma de otro data.id → invalida", r.resultado === "invalida", r);
}
{
  const r = revisar({ header: null, query: "data.id=123456&type=payment" });
  check("(f4) Sin x-signature → sin_firma", r.resultado === "sin_firma" && r.desfase_s === undefined, r);
}
{
  const r1 = revisar({ header: "ts=abc,v1=deadbeef", query: "data.id=1" });
  const r2 = revisar({ header: `ts=${tsMs}`, query: "data.id=1" });
  const r3 = revisar({ header: "v1=deadbeef", query: "data.id=1" });
  check("(f5) ts no numérico, sin v1 o sin ts → malformada",
    [r1, r2, r3].every((r) => r.resultado === "malformada"), [r1.motivo, r2.motivo, r3.motivo]);
}
{
  const f = firmar({ id: "abc123def", requestId: "req-123", ts: tsMs });
  const r = revisar({ header: f.header, query: "data.id=ABC123DEF&type=order" });
  check("(f6) data.id alfanumérico en mayúsculas → valida (se firma en minúsculas)", r.resultado === "valida", r);
}
{
  const f = firmar({ requestId: "req-123", ts: tsMs });
  const body = { type: "mp-connect", action: "application.deauthorized", user_id: 123 };
  const r = revisar({ header: f.header, body });
  sinSecretos("f7", r, f.hash);
  check("(f7) mp-connect sin data.id → valida con el texto sin id; aviso mp-connect",
    r.resultado === "valida" && r.aviso === "mp-connect" && r.id_desde === "ninguno", r);
}
{
  const f = firmar({ id: "777", ts: tsMs });
  const r = revisar({ header: f.header, requestId: null, query: "data.id=777&type=payment" });
  check("(f8) Sin x-request-id → valida con el texto sin request-id", r.resultado === "valida" && r.request_id === undefined, r);
}
{
  const f = firmar({ id: "123456", requestId: "req-123", ts: tsMs, clave: OTRA });
  const r = revisar({ header: f.header, query: "data.id=123456&type=payment", secretos: `${CLAVE}, ${OTRA}` });
  sinSecretos("f9", r, f.hash);
  check("(f9) Dos claves, coincide la segunda → valida con clave 1", r.resultado === "valida" && r.clave === 1, r);
}
{
  const f = firmar({ id: "123456", requestId: "req-123", ts: tsMs });
  // Directo: en revisar(), un `secretos: undefined` tomaría el valor por defecto.
  const r1 = revisarFirma({ xSignature: f.header, xRequestId: "req-123", query: new URLSearchParams("data.id=123456"), body: {}, secretos: undefined, ahora: AHORA });
  const r2 = revisar({ header: f.header, query: "data.id=123456", secretos: " , " });
  check("(f10) Sin MP_WEBHOOK_SECRET (o vacío) → sin_secret", r1.resultado === "sin_secret" && r2.resultado === "sin_secret", [r1, r2]);
}
{
  const r = revisar({ header: null, query: "topic=payment&id=123456" });
  check("(f11) IPN (topic/id en la query) → aviso ipn", r.aviso === "ipn" && r.tipo === "payment" && r.id_desde === "ninguno", r);
}
{
  const f = firmar({ id: "55", requestId: "req-123", ts: tsMs });
  const r = revisar({ header: f.header, query: "type=payment", body: { type: "payment", data: { id: "55" } } });
  check("(f12) data.id solo en el body → se usa y se anota id_desde body", r.resultado === "valida" && r.id_desde === "body", r);
}
{
  const f = firmar({ id: "1", requestId: "req-123", ts: tsMs });
  const r = revisar({ header: f.header, query: "data.id=1&type=payment&grupo=6f1c0b6e-0000-4000-8000-000000000000" });
  check("(f13) ?grupo= → cobro marketplace", r.cobro === "marketplace", r);
}
{
  const segundos = Math.floor(AHORA / 1000) - 120;
  const f = firmar({ id: "1", requestId: "req-123", ts: segundos });
  const r = revisar({ header: f.header, query: "data.id=1" });
  check("(f14) ts en segundos → desfase en segundos (120)", r.resultado === "valida" && r.desfase_s === 120, r);
}
check("(f15) Ningún registro contiene la clave ni el hash", filtrados.length === 0, filtrados);

const fallidos = resultados.filter((r) => !r.ok);
console.log("\n" + "─".repeat(60));
console.log(`Resultado: ${resultados.length - fallidos.length}/${resultados.length} casos OK`);
process.exit(fallidos.length ? 1 : 0);
