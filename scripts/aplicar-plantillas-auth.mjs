/**
 * Aplica las plantillas de correo de Supabase Auth (supabase/templates/) al
 * proyecto, vía la Management API, junto con los ajustes de los que dependen
 * sus enlaces: site_url, Redirect URLs (uri_allow_list) y vencimiento
 * (mailer_otp_exp). Ver AJUSTES más abajo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CORRERLO
 *
 *   node scripts/aplicar-plantillas-auth.mjs            # solo GET + diff
 *   node scripts/aplicar-plantillas-auth.mjs --aplicar  # PATCH + verificación
 *
 * Necesita en el entorno SUPABASE_ACCESS_TOKEN: un token personal de una cuenta
 * con permisos sobre el proyecto (Dashboard → Account → Access Tokens). El login
 * de la CLI no sirve: responde 403 en este proyecto.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Sin --aplicar no escribe nada en Supabase. En los dos modos guarda el estado
 * leído en supabase/.temp/plantillas-auth/<fecha>/ (ignorado por git): las
 * plantillas tal como estaban y un resumen con asuntos y ajustes de correo.
 * Del GET solo se guardan las claves de ALLOWLIST: la respuesta trae secretos
 * (smtp_pass, claves de proveedores) que no deben quedar en disco.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REF = "rgskspvuvzwmvmsccoez";
const API = `https://api.supabase.com/v1/projects/${REF}/config/auth`;
const TIPOS = ["invite", "recovery", "confirmation", "email_change", "magic_link"];
const DIR = join("supabase", "templates");

/** Ajustes que conviene ver junto con las plantillas. Nada secreto. */
const DIAGNOSTICO = [
  "site_url",
  "uri_allow_list",
  "disable_signup",
  "mailer_otp_exp",
  "mailer_secure_email_change_enabled",
  "mailer_autoconfirm",
  "rate_limit_email_sent",
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_admin_email",
  "smtp_sender_name",
];

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Falta SUPABASE_ACCESS_TOKEN en el entorno.");
  process.exit(1);
}
const aplicar = process.argv.includes("--aplicar");

async function api(method, body) {
  const res = await fetch(API, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    console.error(`${method} config/auth → ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  return res.json();
}

const clavesAsunto = (t) => `mailer_subjects_${t}`;
const clavesPlantilla = (t) => `mailer_templates_${t}_content`;

// ── Lo que queremos ─────────────────────────────────────────────────────────
// Siempre LF: en Windows git puede dejar las plantillas en CRLF, y eso las haría
// distintas de lo aplicado sin que haya un cambio real.
const leer = (archivo) => readFileSync(join(DIR, archivo), "utf8").replace(/\r\n/g, "\n");
const asuntos = JSON.parse(leer("asuntos.json"));
const deseado = {};
for (const t of TIPOS) {
  deseado[clavesAsunto(t)] = asuntos[t];
  deseado[clavesPlantilla(t)] = leer(`${t}.html`);
}

// ── Lo que hay ──────────────────────────────────────────────────────────────
const actual = await api("GET");

// Ajustes de auth que van junto con las plantillas. tienda. es un redirect de
// dominio desde el 2026-10-25: sus Redirect URLs se sacan. El resto de la lista
// (p. ej. un localhost agregado a mano) se conserva.
const WWW = "https://www.muzikchile.cl";
const listaActual = (actual.uri_allow_list ?? "").split(",").filter(Boolean);
const AJUSTES = {
  site_url: WWW,
  uri_allow_list: [...new Set([`${WWW}/**`, ...listaActual])]
    .filter((u) => !u.startsWith("https://tienda.muzikchile.cl"))
    .join(","),
  // 24 h: lo que dicen las plantillas ("vence en 24 horas"). Es el máximo.
  mailer_otp_exp: 86400,
};
Object.assign(deseado, AJUSTES);

const sello = new Date().toISOString().replace(/[:.]/g, "-");
const salida = join("supabase", ".temp", "plantillas-auth", sello);
mkdirSync(salida, { recursive: true });

const resumen = { diagnostico: {}, asuntos: {} };
for (const k of DIAGNOSTICO) resumen.diagnostico[k] = actual[k] ?? null;
resumen.diagnostico.smtp_pass_configurado = Boolean(actual.smtp_pass);
for (const t of TIPOS) {
  resumen.asuntos[t] = actual[clavesAsunto(t)] ?? null;
  writeFileSync(join(salida, `${t}.antes.html`), actual[clavesPlantilla(t)] ?? "");
}
writeFileSync(join(salida, "resumen.json"), JSON.stringify(resumen, null, 2));

console.log(`Estado actual guardado en ${salida}\n`);
console.log("Ajustes de correo:");
for (const [k, v] of Object.entries(resumen.diagnostico)) console.log(`  ${k}: ${JSON.stringify(v)}`);

console.log("\nDiff:");
const cambios = {};
for (const [k, v] of Object.entries(AJUSTES)) {
  if (actual[k] === v) { console.log(`\n  [${k}] sin cambios`); continue; }
  cambios[k] = v;
  console.log(`\n  [${k}]\n    ${JSON.stringify(actual[k])}\n  → ${JSON.stringify(v)}`);
}
for (const t of TIPOS) {
  const a = actual[clavesAsunto(t)] ?? "";
  const ha = actual[clavesPlantilla(t)] ?? "";
  const asuntoCambia = a !== deseado[clavesAsunto(t)];
  const htmlCambia = ha !== deseado[clavesPlantilla(t)];
  if (asuntoCambia) cambios[clavesAsunto(t)] = deseado[clavesAsunto(t)];
  if (htmlCambia) cambios[clavesPlantilla(t)] = deseado[clavesPlantilla(t)];

  console.log(`\n  [${t}]`);
  console.log(asuntoCambia
    ? `    asunto: ${JSON.stringify(a)}\n         → ${JSON.stringify(deseado[clavesAsunto(t)])}`
    : "    asunto: sin cambios");
  console.log(htmlCambia
    ? `    html:   ${ha.length} → ${deseado[clavesPlantilla(t)].length} caracteres (antes en ${t}.antes.html)`
    : "    html:   sin cambios");
}

if (Object.keys(cambios).length === 0) {
  console.log("\nNada que aplicar: el proyecto ya tiene las plantillas del repo.");
  process.exit(0);
}
if (!aplicar) {
  console.log(`\n${Object.keys(cambios).length} campos cambiarían. Para aplicarlos: --aplicar`);
  process.exit(0);
}

// ── Aplicar y verificar ─────────────────────────────────────────────────────
await api("PATCH", cambios);
const despues = await api("GET");
const distintos = Object.keys(deseado).filter((k) => despues[k] !== deseado[k]);
if (distintos.length) {
  console.error(`\nPATCH aceptado, pero estos campos no quedaron iguales al repo: ${distintos.join(", ")}`);
  process.exit(1);
}
console.log(`\nAplicado: ${Object.keys(cambios).length} campos. Verificado con un GET: los ${Object.keys(deseado).length} campos coinciden.`);
