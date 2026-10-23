/**
 * Verificación de las conexiones de Mercado Pago (commit 2 del marketplace).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CORRERLO
 *
 *   npm run verificar:mp                                  → base + unitarios
 *   npm run verificar:mp -- --api=http://localhost:3000   → + endpoints
 *
 * Base:      mp_conexiones sin acceso para anon/authenticated, trigger que
 *            sincroniza artistas.cobros_activos, una cuenta MP por artista,
 *            lock de renovación, flag cobro_modelo.
 * Unitarios: cifrado AES-256-GCM (ida y vuelta, alteración, otra llave) y PKCE.
 * API:       /api/mp/conexion, /api/mp/desconectar, el inicio del OAuth
 *            (redirect a auth.mercadopago.cl con PKCE y cookie httpOnly) y el
 *            callback con state falso, sin cookie, con la sesión de otro
 *            usuario y con un código falso; cron sin secreto.
 *
 * La conexión real (autorizar en MP con una cuenta de prueba) no se puede
 * automatizar: requiere iniciar sesión en Mercado Pago. Ver PROGRESS.md.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ ESCRIBE EN LA BASE DE DATOS REAL, con el prefijo `rlstest-`, y limpia en
 * el `finally` (mismo esquema que verificar-rls-publicaciones.mjs).
 */

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
// Node 24 importa TypeScript sin compilar (solo quita los tipos).
import { cifrar, descifrar } from "../lib/mp/cifrado.ts";
import { nuevoIntento } from "../lib/mp/oauth.ts";

const URL          = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON_KEY || !SERVICE_KEY || !process.env.MP_TOKENS_KEY) {
  console.error("Faltan variables de entorno (incluida MP_TOKENS_KEY). Corre con: npm run verificar:mp");
  process.exit(1);
}

const API = process.argv.find((a) => a.startsWith("--api="))?.slice("--api=".length).replace(/\/$/, "");

const FAMILIA = "rlstest-";
const PREFIJO = `${FAMILIA}${Date.now()}`;
const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(URL, SERVICE_KEY, opciones);
const anon  = createClient(URL, ANON_KEY, opciones);

// ── Reporte ──────────────────────────────────────────────────────────────────

const resultados = [];
function check(caso, ok, detalle) {
  resultados.push({ caso, ok, detalle });
  console.log(`  ${ok ? "✓" : "✗"} ${caso}`);
  if (detalle) console.log(`      ${detalle}`);
}
const fmt = (error) => (error ? `${error.code ?? ""} ${error.message}`.trim() : "sin error");

// ── Escenario ────────────────────────────────────────────────────────────────

/**
 * Artista de prueba con su sesión en un frasco de cookies, armado por el mismo
 * @supabase/ssr que usa la app: así la cookie tiene el formato exacto.
 */
async function crearArtista(sufijo) {
  const email = `${PREFIJO}-${sufijo}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Usuario ${sufijo}: ${error.message}`);
  const userId = data.user.id;
  const { error: rolErr } = await admin.from("user_roles").insert({ user_id: userId, role: "artista" });
  if (rolErr && rolErr.code !== "23505") throw new Error(`Rol ${sufijo}: ${rolErr.message}`);
  const { data: artista, error: artErr } = await admin
    .from("artistas")
    .insert({ user_id: userId, nombre: `RLS Test ${sufijo}`, slug: `${PREFIJO}-${sufijo}` })
    .select("id")
    .single();
  if (artErr) throw new Error(`Artista ${sufijo}: ${artErr.message}`);

  const frasco = new Map();
  const ssr = createServerClient(URL, ANON_KEY, {
    cookies: {
      getAll: () => [...frasco].map(([name, value]) => ({ name, value })),
      setAll: (lista) => lista.forEach(({ name, value }) => (value ? frasco.set(name, value) : frasco.delete(name))),
    },
  });
  const { error: loginErr } = await ssr.auth.signInWithPassword({ email, password });
  if (loginErr) throw new Error(`Login ${sufijo}: ${loginErr.message}`);

  const cliente = createClient(URL, ANON_KEY, opciones);
  await cliente.auth.signInWithPassword({ email, password });

  const cookie = [...frasco].map(([n, v]) => `${n}=${v}`).join("; ");
  return { userId, artistaId: artista.id, cliente, cookie };
}

const cobrosActivos = async (artistaId) =>
  (await admin.from("artistas").select("cobros_activos").eq("id", artistaId).single()).data?.cobros_activos;

function filaConexion(artistaId, mpUserId, extra = {}) {
  return {
    artista_id: artistaId,
    mp_user_id: mpUserId,
    nickname: "RLSTEST_VENDEDOR",
    email: `${PREFIJO}-mp@example.com`,
    access_token_cifrado: cifrar("APP_USR-falso-access"),
    refresh_token_cifrado: cifrar("TG-falso-refresh"),
    live_mode: false,
    expires_at: new Date(Date.now() + 180 * 86400000).toISOString(),
    ...extra,
  };
}

// Ids de MP ficticios, lejos de los reales.
const mpId = () => 9_000_000_000 + Math.floor(Math.random() * 999_999_999);

async function limpiar() {
  console.log("\nLimpiando datos de prueba...");
  const { data: artistas } = await admin.from("artistas").select("id").like("slug", `${FAMILIA}%`);
  for (const a of artistas ?? []) {
    await admin.from("mp_conexiones").delete().eq("artista_id", a.id);
    await admin.from("artistas").delete().eq("id", a.id);
  }
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const deTest = (lista?.users ?? []).filter((u) => u.email?.startsWith(FAMILIA));
  for (const u of deTest) {
    await admin.from("user_roles").delete().eq("user_id", u.id);
    await admin.auth.admin.deleteUser(u.id);
  }
  console.log(`  Usuarios: ${deTest.length} · artistas: ${artistas?.length ?? 0}`);
}

// ── Unitarios ────────────────────────────────────────────────────────────────

function unitarios() {
  console.log("\n── Cifrado y PKCE ──");
  const secreto = "APP_USR-1234567890-abcdef";
  const c1 = cifrar(secreto);
  const c2 = cifrar(secreto);
  check("(u1) Cifrar y descifrar devuelve el original", descifrar(c1) === secreto);
  check("(u2) Dos cifrados del mismo texto son distintos (IV aleatorio)", c1 !== c2);
  check("(u3) El cifrado no contiene el texto en claro", !c1.includes("APP_USR"));

  const partes = c1.split(".");
  const alterado = [partes[0], partes[1], partes[2], partes[3].slice(0, -2) + (partes[3].endsWith("A") ? "BB" : "AA")].join(".");
  let fallo = false;
  try { descifrar(alterado); } catch { fallo = true; }
  check("(u4) Un cifrado alterado no descifra", fallo);

  const llaveOriginal = process.env.MP_TOKENS_KEY;
  process.env.MP_TOKENS_KEY = Buffer.alloc(32, 7).toString("base64");
  fallo = false;
  try { descifrar(c1); } catch { fallo = true; }
  process.env.MP_TOKENS_KEY = llaveOriginal;
  check("(u5) Con otra llave no descifra", fallo);

  const { verifier, challenge, state } = nuevoIntento();
  const esperado = createHash("sha256").update(verifier).digest("base64url");
  check("(u6) PKCE: challenge = base64url(sha256(verifier))", challenge === esperado);
  check("(u7) PKCE: verifier de 43 a 128 caracteres válidos", /^[A-Za-z0-9\-._~]{43,128}$/.test(verifier), `largo=${verifier.length}`);
  check("(u8) state aleatorio de 256 bits", state.length >= 43 && nuevoIntento().state !== state);
}

// ── Base de datos ────────────────────────────────────────────────────────────

async function base(A, B) {
  console.log("\n── mp_conexiones en la base ──");
  {
    const r1 = await anon.from("mp_conexiones").select("*");
    const r2 = await A.cliente.from("mp_conexiones").select("*");
    check("(b1) Anónimo/artista leen mp_conexiones → rechazado", !!r1.error && !!r2.error, `anon: ${fmt(r1.error)} · artista: ${fmt(r2.error)}`);
  }
  {
    const { error } = await A.cliente.from("mp_conexiones").insert(filaConexion(A.artistaId, mpId()));
    check("(b2) Artista inserta su conexión directo → rechazado", !!error, fmt(error));
  }

  const idA = mpId();
  {
    const { error } = await admin.from("mp_conexiones").insert(filaConexion(A.artistaId, idA));
    check("(b3) Conexión nueva → cobros_activos = true", !error && (await cobrosActivos(A.artistaId)) === true, fmt(error));
  }
  {
    await admin.from("mp_conexiones").update({ estado: "reconectar" }).eq("artista_id", A.artistaId);
    const tras = await cobrosActivos(A.artistaId);
    await admin.from("mp_conexiones").update({ estado: "conectado" }).eq("artista_id", A.artistaId);
    const vuelta = await cobrosActivos(A.artistaId);
    check("(b4) 'reconectar' apaga cobros_activos y 'conectado' lo prende", tras === false && vuelta === true, `reconectar=${tras} conectado=${vuelta}`);
  }
  {
    const { error } = await admin.from("mp_conexiones").update({ estado: "otro" }).eq("artista_id", A.artistaId);
    check("(b5) Estado fuera de la lista → rechazado (CHECK)", error?.code === "23514", fmt(error));
  }
  {
    const { error } = await admin.from("mp_conexiones").insert(filaConexion(B.artistaId, idA));
    check("(b6) Misma cuenta de MP para otro artista → rechazado (23505)", error?.code === "23505", fmt(error));
  }
  {
    const r1 = await admin.rpc("tomar_lock_renovacion_mp", { p_artista_id: A.artistaId });
    const r2 = await admin.rpc("tomar_lock_renovacion_mp", { p_artista_id: A.artistaId });
    const r3 = await anon.rpc("tomar_lock_renovacion_mp", { p_artista_id: A.artistaId });
    await admin.from("mp_conexiones").update({ refrescando_hasta: null }).eq("artista_id", A.artistaId);
    check("(b7) Lock de renovación: el primero lo toma, el segundo no, anon no puede", r1.data === true && r2.data === false && !!r3.error,
      `1º=${r1.data ?? fmt(r1.error)} 2º=${r2.data ?? fmt(r2.error)} anon=${fmt(r3.error)}`);
  }
  {
    const intentos = await Promise.all(Array.from({ length: 5 }, () => admin.rpc("tomar_lock_renovacion_mp", { p_artista_id: A.artistaId })));
    const ganadores = intentos.filter((r) => r.data === true).length;
    await admin.from("mp_conexiones").update({ refrescando_hasta: null }).eq("artista_id", A.artistaId);
    check("(b8) 5 renovaciones simultáneas → un solo lock", ganadores === 1, `ganadores=${ganadores}`);
  }
  {
    await admin.from("mp_conexiones").delete().eq("artista_id", A.artistaId);
    check("(b9) Borrar la conexión → cobros_activos = false", (await cobrosActivos(A.artistaId)) === false);
  }
  {
    const { data } = await admin.from("app_settings").select("value").eq("key", "cobro_modelo").maybeSingle();
    check("(b10) Flag cobro_modelo existe y está en 'centralizado'", data?.value === "centralizado", `valor=${data?.value}`);
  }
}

// ── API ──────────────────────────────────────────────────────────────────────

const pedir = (ruta, { cookie, method = "GET" } = {}) =>
  fetch(`${API}${ruta}`, { method, redirect: "manual", headers: cookie ? { cookie } : {} });

async function api(A, B) {
  console.log(`\n── API · ${API} ──`);
  {
    const r = await pedir("/api/mp/conexion");
    check("(a1) /api/mp/conexion sin sesión → 401", r.status === 401, `status=${r.status}`);
  }
  {
    const r = await pedir("/api/mp/conexion", { cookie: A.cookie });
    const d = await r.json().catch(() => null);
    check("(a2) Con sesión y sin conexión → conexion null, modelo centralizado", r.status === 200 && d?.conexion === null && d?.modelo === "centralizado", `status=${r.status} ${JSON.stringify(d)}`);
  }
  {
    await admin.from("mp_conexiones").insert(filaConexion(A.artistaId, mpId()));
    const r = await pedir("/api/mp/conexion", { cookie: A.cookie });
    const texto = await r.text();
    const d = JSON.parse(texto || "null");
    check("(a3) Con conexión → 'conectado' y nunca devuelve tokens",
      r.status === 200 && d?.conexion?.estado === "conectado" && d.conexion.nickname === "RLSTEST_VENDEDOR" && !/token|cifrado|APP_USR|v1\./i.test(texto),
      `status=${r.status} ${texto}`);
  }
  {
    const r1 = await pedir("/api/mp/desconectar", { method: "POST" });
    const r2 = await pedir("/api/mp/desconectar", { method: "POST", cookie: A.cookie });
    const { data } = await admin.from("mp_conexiones").select("artista_id").eq("artista_id", A.artistaId);
    check("(a4) Desconectar: sin sesión 401; con sesión borra la conexión y apaga cobros_activos",
      r1.status === 401 && r2.status === 200 && (data ?? []).length === 0 && (await cobrosActivos(A.artistaId)) === false,
      `sin sesión=${r1.status} con sesión=${r2.status} filas=${data?.length}`);
  }
  {
    const r = await pedir("/api/mp/oauth/iniciar");
    check("(a5) Iniciar sin sesión → al login", r.status >= 300 && r.status < 400 && (r.headers.get("location") ?? "").includes("/login"), `status=${r.status} → ${r.headers.get("location")}`);
  }

  // Intento real de A: URL de MP y cookie.
  const rA = await pedir("/api/mp/oauth/iniciar", { cookie: A.cookie });
  const loc = new globalThis.URL(rA.headers.get("location") ?? "about:blank");
  const setCookie = rA.headers.get("set-cookie") ?? "";
  const cookieOauth = setCookie.match(/mp_oauth=([^;]+)/)?.[1];
  const stateA = loc.searchParams.get("state");
  {
    const ok = rA.status >= 300 && rA.status < 400
      && loc.origin === "https://auth.mercadopago.cl" && loc.pathname === "/authorization"
      && loc.searchParams.get("client_id") === "5838765500898605"
      && loc.searchParams.get("response_type") === "code"
      && loc.searchParams.get("code_challenge_method") === "S256"
      && (loc.searchParams.get("code_challenge") ?? "").length === 43
      // La redirect_uri sale del NEXT_PUBLIC_URL del servidor: en producción es
      // el mismo host de la API; en local, el de .env.local.
      && [API, process.env.NEXT_PUBLIC_URL].map((b) => `${b}/api/mp/oauth/callback`).includes(loc.searchParams.get("redirect_uri"))
      && !!stateA;
    check("(a6) Iniciar con sesión → auth.mercadopago.cl con client_id, PKCE S256, state y redirect_uri", ok,
      `status=${rA.status} · redirect_uri=${loc.searchParams.get("redirect_uri")}`);
  }
  {
    const ok = !!cookieOauth && /HttpOnly/i.test(setCookie) && /Path=\/api\/mp\/oauth/i.test(setCookie) && /SameSite=lax/i.test(setCookie)
      && !setCookie.includes(stateA ?? "@@");
    check("(a7) Cookie del intento: httpOnly, Lax, solo /api/mp/oauth y cifrada (no muestra el state)", ok, setCookie.slice(0, 160));
  }

  const callback = (query, cookie) => pedir(`/api/mp/oauth/callback?${query}`, { cookie });
  const destino = (r) => r.headers.get("location") ?? "";
  {
    const r = await callback("error=access_denied", `${A.cookie}; mp_oauth=${cookieOauth}`);
    check("(a8) El artista cancela en MP → error=cancelado y borra la cookie", destino(r).includes("error=cancelado") && /mp_oauth=;/.test(r.headers.get("set-cookie") ?? ""), destino(r));
  }
  {
    const r = await callback(`code=falso&state=${stateA}`, A.cookie);
    check("(a9) Callback sin la cookie del intento → error=estado", destino(r).includes("error=estado"), destino(r));
  }
  {
    const r = await callback("code=falso&state=STATE-FALSO-123", `${A.cookie}; mp_oauth=${cookieOauth}`);
    check("(a10) Callback con state falso → error=estado", destino(r).includes("error=estado"), destino(r));
  }
  {
    const r = await callback(`code=falso&state=${stateA}`, `${B.cookie}; mp_oauth=${cookieOauth}`);
    check("(a11) Cookie de A con la sesión de B → error=sesion", destino(r).includes("error=sesion"), destino(r));
  }
  {
    const r = await callback(`code=codigo-falso&state=${stateA}`, `${A.cookie}; mp_oauth=${cookieOauth}`);
    const { data } = await admin.from("mp_conexiones").select("artista_id").eq("artista_id", A.artistaId);
    // Con MP_CLIENT_SECRET, MP rechaza el código (error=mp); sin él, error=config.
    check("(a12) State y sesión correctos pero código falso → no conecta nada",
      /error=(mp|config)/.test(destino(r)) && (data ?? []).length === 0, destino(r));
  }
  {
    const r = await pedir("/api/cron/mp-renovar");
    check("(a13) Cron sin CRON_SECRET → 401", r.status === 401, `status=${r.status}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Verificación · conexiones de Mercado Pago");
  console.log(`Proyecto: ${URL}${API ? ` · API: ${API}` : ""}`);
  try {
    unitarios();
    await limpiar();
    const A = await crearArtista("a");
    const B = await crearArtista("b");
    await base(A, B);
    if (API) await api(A, B);
  } catch (err) {
    console.error("\nError montando o ejecutando la verificación:");
    console.error(`  ${err.message}`);
    resultados.push({ caso: "ejecución del script", ok: false, detalle: err.message });
  } finally {
    await limpiar();
  }

  const fallidos = resultados.filter((r) => !r.ok);
  console.log("\n" + "─".repeat(60));
  console.log(`Resultado: ${resultados.length - fallidos.length}/${resultados.length} casos OK`);
  if (fallidos.length) {
    console.log("\nFallaron:");
    for (const f of fallidos) console.log(`  ✗ ${f.caso}`);
    process.exit(1);
  }
  process.exit(0);
}

main();
