/**
 * Verificación de la activación de tienda: permisos, estados y aprobación.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CORRERLO
 *
 *   npm run verificar:tienda
 *   npm run verificar:tienda -- --api=http://localhost:3000
 *                         → + cómo cobra una tienda (cotizar, ficha, /api/mp/conexion)
 *                           y las rutas del panel y del admin (/api/panel/tienda, /api/admin/tiendas).
 *                           El servidor parte con `npm run dev:pruebas`.
 *
 * Lee `.env.pruebas`. La base tiene que tener aplicada la migración
 * 20261107172500_tiendas_y_terminos_artistas.
 *
 * Sale con código 0 si todos los casos pasan, 1 si alguno falla.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ ESCRIBE EN LA BASE: crea usuarios, artistas y productos con el prefijo
 * `rlstienda-` y los borra al terminar. Se niega a correr contra producción.
 *
 * Las aserciones de permisos se hacen con clientes autenticados o anónimos. Las
 * funciones de estado son solo de service role, como en los Route Handlers.
 */

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { frenarSiEsProduccion } from "./freno-produccion.mjs";
import { VERSION_TERMINOS_ARTISTAS } from "../lib/terminos.ts";

frenarSiEsProduccion();

const URL_BASE    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANON_KEY || !SERVICE_KEY) {
  console.error("Faltan variables de entorno. Corre con: npm run verificar:tienda");
  process.exit(1);
}

const API = process.argv.find((a) => a.startsWith("--api="))?.slice("--api=".length).replace(/\/$/, "");
const FAMILIA = "rlstienda-";
const PREFIJO = `${FAMILIA}${Date.now()}`;
const VERSION = "1.0-prueba";
const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(URL_BASE, SERVICE_KEY, opciones);
const anon  = createClient(URL_BASE, ANON_KEY, opciones);

const resultados = [];
function check(caso, ok, detalle) {
  resultados.push({ caso, ok });
  console.log(`  ${ok ? "✓" : "✗"} ${caso}`);
  if (!ok && detalle) console.log(`      ${detalle}`);
}
const rechazo = (error) => error?.code === "42501";
const fmt = (error) => (error ? `${error.code}: ${error.message}` : "sin error");

// ── Escenario ────────────────────────────────────────────────────────────────

async function crearUsuario(sufijo, rol) {
  const email = `${PREFIJO}-${sufijo}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Usuario ${sufijo}: ${error.message}`);
  const userId = data.user.id;

  await admin.from("user_roles").delete().eq("user_id", userId);
  const { error: rolError } = await admin.from("user_roles").insert({ user_id: userId, role: rol });
  if (rolError) throw new Error(`Rol ${sufijo}: ${rolError.message}`);

  let artistaId = null;
  if (rol === "artista") {
    const { data: artista, error: artistaError } = await admin
      .from("artistas")
      .insert({ user_id: userId, nombre: `Tienda ${sufijo}`, slug: `${PREFIJO}-${sufijo}` })
      .select("id")
      .single();
    if (artistaError) throw new Error(`Artista ${sufijo}: ${artistaError.message}`);
    artistaId = artista.id;
  }

  const cliente = createClient(URL_BASE, ANON_KEY, opciones);
  const { error: loginError } = await cliente.auth.signInWithPassword({ email, password });
  if (loginError) throw new Error(`Login ${sufijo}: ${loginError.message}`);
  return { cliente, artistaId, userId, email, password };
}

let nProducto = 0;
async function sembrarProducto(artistaId, estado) {
  const { data, error } = await admin
    .from("productos")
    .insert({ artista_id: artistaId, nombre: `${PREFIJO}-${++nProducto}`, precio: 10000, stock: 5, tipo: "fisico", imagenes: [], estado })
    .select("id")
    .single();
  if (error) throw new Error(`Producto: ${error.message}`);
  return data.id;
}

const tienda  = async (id) => (await admin.from("tiendas").select("*").eq("artista_id", id).single()).data;
const artista = async (id) => (await admin.from("artistas").select("tienda_activa, cobro, comision").eq("id", id).single()).data;
const estadoProducto = async (id) => (await admin.from("productos").select("estado").eq("id", id).single()).data?.estado;
const rpc = (fn, args) => admin.rpc(fn, args);

/** Deja una tienda con todo el checklist listo, sin pasar por el navegador. */
async function completarChecklist(u) {
  await admin.from("artistas").update({ cobros_activos: true }).eq("id", u.artistaId);
  await admin.from("tiendas").update({
    identidad_mp_declarada: true, despacho_modo: "envio", despacho_costo: 3000, despacho_plazo_min: 2, despacho_plazo_max: 5,
  }).eq("artista_id", u.artistaId);
  await rpc("aceptar_terminos_artista", { p_artista_id: u.artistaId, p_user_id: u.userId, p_version: VERSION });
}

async function limpiar() {
  const { data: artistas } = await admin.from("artistas").select("id").like("slug", `${FAMILIA}%`);
  const ids = (artistas ?? []).map((a) => a.id);
  if (ids.length) {
    await admin.from("productos").delete().in("artista_id", ids);
    await admin.from("artistas").delete().in("id", ids);
  }
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error(`  ! no se pudieron listar usuarios: ${error.message}`);
    return;
  }
  for (const u of (data?.users ?? []).filter((x) => x.email?.startsWith(FAMILIA))) {
    await admin.from("user_roles").delete().eq("user_id", u.id);
    await admin.auth.admin.deleteUser(u.id);
  }
}

// ── Casos ────────────────────────────────────────────────────────────────────

async function casos(A, B, ADMIN) {
  console.log("\n── Alta ──");
  {
    const t = await tienda(A.artistaId);
    check("(t1) Un artista nuevo nace con su tienda 'no_activa'", t?.estado === "no_activa", JSON.stringify(t));
    const a = await artista(A.artistaId);
    check("(t2) Nace con cobro 'centralizado'", a?.cobro === "centralizado", JSON.stringify(a));
  }

  console.log("\n── El artista no puede activarse solo ──");
  for (const [caso, cambio] of [
    ["(a1) estado 'activa'", { estado: "activa" }],
    ["(a2) estado 'solicitada'", { estado: "solicitada" }],
    ["(a3) comentario de moderación", { comentario_moderacion: "yo" }],
    ["(a4) resuelta_por", { resuelta_por: A.userId }],
    ["(a5) fecha de la declaración", { identidad_mp_declarada_at: "2020-01-01T00:00:00Z" }],
  ]) {
    const { error } = await A.cliente.from("tiendas").update(cambio).eq("artista_id", A.artistaId);
    check(`${caso}: el artista lo escribe → rechazado`, rechazo(error), fmt(error));
  }
  check("(a6) Tras los intentos sigue 'no_activa'", (await tienda(A.artistaId)).estado === "no_activa");
  for (const [caso, cambio] of [
    ["(a7) comision", { comision: 0 }],
    ["(a8) tienda_activa", { tienda_activa: true }],
    ["(a9) cobro", { cobro: "marketplace" }],
    ["(a10) cobros_activos", { cobros_activos: true }],
  ]) {
    const { error } = await A.cliente.from("artistas").update(cambio).eq("id", A.artistaId);
    check(`${caso}: el artista la cambia en artistas → rechazado`, rechazo(error), fmt(error));
  }
  {
    const { error } = await A.cliente.from("tiendas").insert({ artista_id: A.artistaId, estado: "activa" });
    check("(a11) Crea una fila en tiendas → rechazado", rechazo(error), fmt(error));
  }
  {
    const { error } = await A.cliente.from("tiendas").delete().eq("artista_id", A.artistaId);
    check("(a12) Borra su fila → rechazado", rechazo(error) && !!(await tienda(A.artistaId)), fmt(error));
  }
  {
    const { error } = await A.cliente.from("terminos_artistas").insert({ artista_id: A.artistaId, version: VERSION, aceptado_por: A.userId });
    check("(a13) Inserta su aceptación con fecha propia → rechazado", rechazo(error), fmt(error));
  }
  for (const [caso, fn, args] of [
    ["(a14) solicitar_tienda", "solicitar_tienda", { p_artista_id: A.artistaId, p_version: VERSION }],
    ["(a15) aprobar_tienda", "aprobar_tienda", { p_artista_id: A.artistaId, p_admin: ADMIN.userId, p_version: VERSION }],
    ["(a16) checklist_tienda", "checklist_tienda", { p_artista_id: A.artistaId, p_version: VERSION }],
    ["(a17) aceptar_terminos_artista", "aceptar_terminos_artista", { p_artista_id: A.artistaId, p_user_id: A.userId, p_version: VERSION }],
  ]) {
    const { error: e1 } = await A.cliente.rpc(fn, args);
    const { error: e2 } = await anon.rpc(fn, args);
    const { error: e3 } = await ADMIN.cliente.rpc(fn, args);
    check(`${caso}: artista, anónimo y admin desde el navegador → rechazado`, rechazo(e1) && rechazo(e2) && rechazo(e3), `${fmt(e1)} · ${fmt(e2)} · ${fmt(e3)}`);
  }

  console.log("\n── Lo que el artista sí edita ──");
  {
    const { error } = await A.cliente.from("tiendas").update({
      despacho_modo: "ambos", despacho_costo: 3500, despacho_plazo_min: 2, despacho_plazo_max: 5, retiro_detalle: "Metro Baquedano",
    }).eq("artista_id", A.artistaId);
    const t = await tienda(A.artistaId);
    check("(b1) Define su despacho y retiro → permitido", !error && t.despacho_costo === 3500 && t.retiro_detalle === "Metro Baquedano", fmt(error));
  }
  {
    const { error } = await A.cliente.from("tiendas").update({ identidad_mp_declarada: true }).eq("artista_id", A.artistaId);
    check("(b2a) Declara su identidad sin cuenta conectada → rechazado, y no queda guardada",
      error?.code === "22023" && !(await tienda(A.artistaId)).identidad_mp_declarada, fmt(error));
    const { error: e2 } = await admin.from("tiendas").update({ identidad_mp_declarada: true }).eq("artista_id", A.artistaId);
    check("(b2b) Tampoco con service role", e2?.code === "22023", fmt(e2));
  }
  {
    // La conexión real: su trigger mantiene cobros_activos.
    const { error: errConexion } = await admin.from("mp_conexiones").insert({
      artista_id: A.artistaId, mp_user_id: 8_000_000_000 + Math.floor(Math.random() * 999_999_999),
      access_token_cifrado: "falso", refresh_token_cifrado: "falso", live_mode: false,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });
    if (errConexion) throw new Error(`Conexión: ${errConexion.message}`);

    const { error } = await A.cliente.from("tiendas").update({ identidad_mp_declarada: true }).eq("artista_id", A.artistaId);
    const t = await tienda(A.artistaId);
    check("(b2) Con la cuenta conectada declara su identidad, y la fecha la pone la base", !error && t.identidad_mp_declarada && !!t.identidad_mp_declarada_at, fmt(error));
    const c = await rpc("checklist_tienda", { p_artista_id: A.artistaId, p_version: VERSION });
    check("(b2c) El checklist la cuenta", c.data?.identidad === true && c.data?.mp === true, JSON.stringify(c.data));

    await admin.from("mp_conexiones").update({ estado: "reconectar" }).eq("artista_id", A.artistaId);
    const c2 = await rpc("checklist_tienda", { p_artista_id: A.artistaId, p_version: VERSION });
    check("(b2d) Conexión en 'reconectar': la declaración se conserva, pero no cuenta en el checklist",
      (await tienda(A.artistaId)).identidad_mp_declarada && c2.data?.identidad === false, JSON.stringify(c2.data));
    await admin.from("mp_conexiones").update({ estado: "conectado" }).eq("artista_id", A.artistaId);

    await A.cliente.from("tiendas").update({ identidad_mp_declarada: false }).eq("artista_id", A.artistaId);
    check("(b3) Quitar la declaración borra la fecha", !(await tienda(A.artistaId)).identidad_mp_declarada_at);

    await A.cliente.from("tiendas").update({ identidad_mp_declarada: true }).eq("artista_id", A.artistaId);
    await admin.from("mp_conexiones").delete().eq("artista_id", A.artistaId);
    const t2 = await tienda(A.artistaId);
    check("(b3a) Desconectar borra la declaración y su fecha", !t2.identidad_mp_declarada && !t2.identidad_mp_declarada_at, JSON.stringify(t2));
  }
  {
    const { error: e1 } = await A.cliente.from("tiendas").update({ despacho_costo: -1 }).eq("artista_id", A.artistaId);
    const { error: e2 } = await A.cliente.from("tiendas").update({ despacho_modo: "dron" }).eq("artista_id", A.artistaId);
    const { error: e3 } = await A.cliente.from("tiendas").update({ despacho_plazo_min: 9, despacho_plazo_max: 3 }).eq("artista_id", A.artistaId);
    check("(b4) Costo negativo, modo inventado o plazo al revés → rechazado por CHECK",
      e1?.code === "23514" && e2?.code === "23514" && e3?.code === "23514", `${fmt(e1)} · ${fmt(e2)} · ${fmt(e3)}`);
  }

  console.log("\n── Lectura ──");
  {
    const { data, error } = await anon.from("tiendas").select("artista_id").eq("artista_id", A.artistaId);
    check("(c1) Anónimo lee tiendas → rechazado", rechazo(error) && !data, fmt(error));
    const { error: e2 } = await anon.from("terminos_artistas").select("id").limit(1);
    check("(c2) Anónimo lee terminos_artistas → rechazado", rechazo(e2), fmt(e2));
  }
  {
    const { data } = await B.cliente.from("tiendas").select("artista_id").eq("artista_id", A.artistaId);
    check("(c3) Otro artista no ve la tienda de A", (data ?? []).length === 0, JSON.stringify(data));
    const { data: upd, error } = await B.cliente.from("tiendas").update({ despacho_costo: 1 }).eq("artista_id", A.artistaId).select("artista_id");
    check("(c4) Otro artista edita el despacho de A → 0 filas", !error && upd.length === 0 && (await tienda(A.artistaId)).despacho_costo === 3500, fmt(error));
  }
  {
    const { data } = await A.cliente.from("tiendas").select("estado").eq("artista_id", A.artistaId);
    check("(c5) El artista lee su tienda", data?.length === 1);
    const { data: adm } = await ADMIN.cliente.from("tiendas").select("artista_id").in("artista_id", [A.artistaId, B.artistaId]);
    check("(c6) El admin lee todas", adm?.length === 2, JSON.stringify(adm));
  }
  {
    const { error } = await anon.from("artistas").select("cobro").eq("id", A.artistaId);
    check("(c7) artistas.cobro es de lectura pública", !error, fmt(error));
  }

  console.log("\n── Términos ──");
  {
    const r1 = await rpc("aceptar_terminos_artista", { p_artista_id: A.artistaId, p_user_id: A.userId, p_version: VERSION });
    const r2 = await rpc("aceptar_terminos_artista", { p_artista_id: A.artistaId, p_user_id: A.userId, p_version: VERSION });
    check("(d1) Aceptar dos veces no mueve la fecha", !r1.error && !r2.error && r1.data === r2.data, `${r1.data} · ${r2.data} · ${fmt(r1.error ?? r2.error)}`);
    const r3 = await rpc("aceptar_terminos_artista", { p_artista_id: A.artistaId, p_user_id: B.userId, p_version: VERSION });
    check("(d2) Aceptar por el artista de otro usuario → rechazado", rechazo(r3.error), fmt(r3.error));
    await rpc("aceptar_terminos_artista", { p_artista_id: A.artistaId, p_user_id: A.userId, p_version: "2.0-prueba" });
    const { count } = await admin.from("terminos_artistas").select("id", { count: "exact", head: true }).eq("artista_id", A.artistaId);
    check("(d3) Una versión nueva agrega una fila, no reemplaza la anterior", count === 2, `filas=${count}`);
  }

  console.log("\n── Solicitar ──");
  const C = await crearUsuario("c", "artista");
  {
    const r = await rpc("solicitar_tienda", { p_artista_id: C.artistaId, p_version: VERSION });
    const faltan = r.error?.message ?? "";
    check("(e1) Sin checklist → rechazado y dice qué falta",
      r.error?.code === "22023" && ["despacho", "identidad", "mp", "producto", "terminos"].every((k) => faltan.includes(k)), fmt(r.error));
    check("(e2) Sigue 'no_activa'", (await tienda(C.artistaId)).estado === "no_activa");
  }
  await completarChecklist(C);
  {
    const r = await rpc("solicitar_tienda", { p_artista_id: C.artistaId, p_version: VERSION });
    check("(e3) Sin un producto en borrador → falta solo 'producto'", /incompleto: producto$/.test(r.error?.message ?? ""), fmt(r.error));
  }
  {
    const r = await rpc("solicitar_tienda", { p_artista_id: C.artistaId, p_version: "9.9-prueba" });
    check("(e4) Con términos aceptados en otra versión → falta 'terminos'", /terminos/.test(r.error?.message ?? ""), fmt(r.error));
  }
  const borrador = await sembrarProducto(C.artistaId, "borrador");
  const aprobadoAjeno = await sembrarProducto(B.artistaId, "borrador");
  {
    const c = await rpc("checklist_tienda", { p_artista_id: C.artistaId, p_version: VERSION });
    check("(e5) checklist_tienda completo", !c.error && Object.values(c.data).every((v) => v === true), JSON.stringify(c.data ?? c.error));
    const r = await rpc("solicitar_tienda", { p_artista_id: C.artistaId, p_version: VERSION });
    const t = await tienda(C.artistaId);
    check("(e6) Con todo listo → 'solicitada' y con fecha", !r.error && t.estado === "solicitada" && !!t.solicitada_at, fmt(r.error));
    const r2 = await rpc("solicitar_tienda", { p_artista_id: C.artistaId, p_version: VERSION });
    check("(e7) Solicitar otra vez → rechazado", r2.error?.code === "22023", fmt(r2.error));
  }
  {
    const { error } = await C.cliente.from("productos").update({ precio: 12000 }).eq("id", borrador);
    check("(e8) Con 'solicitada' sigue editando sus borradores", !error, fmt(error));
    const { error: e2 } = await C.cliente.from("tiendas").update({ despacho_costo: 3200 }).eq("artista_id", C.artistaId);
    check("(e9) Con 'solicitada' sigue editando su despacho", !e2, fmt(e2));
  }

  console.log("\n── Devolver ──");
  {
    const r0 = await rpc("devolver_tienda", { p_artista_id: C.artistaId, p_admin: A.userId, p_comentario: "no" });
    check("(f1) Devolver con un usuario que no es admin → rechazado", rechazo(r0.error), fmt(r0.error));
    const r1 = await rpc("devolver_tienda", { p_artista_id: C.artistaId, p_admin: ADMIN.userId, p_comentario: "   " });
    check("(f2) Devolver sin comentario → rechazado", r1.error?.code === "22023", fmt(r1.error));
    const r2 = await rpc("devolver_tienda", { p_artista_id: C.artistaId, p_admin: ADMIN.userId, p_comentario: "Falta la foto" });
    const t = await tienda(C.artistaId);
    check("(f3) Devolver con comentario → 'devuelta', y queda quién y cuándo",
      !r2.error && t.estado === "devuelta" && t.comentario_moderacion === "Falta la foto" && t.resuelta_por === ADMIN.userId && !!t.resuelta_at, fmt(r2.error));
    const { data } = await C.cliente.from("tiendas").select("comentario_moderacion").eq("artista_id", C.artistaId).single();
    check("(f4) El artista lee el comentario", data?.comentario_moderacion === "Falta la foto", JSON.stringify(data));
    const r3 = await rpc("aprobar_tienda", { p_artista_id: C.artistaId, p_admin: ADMIN.userId, p_version: VERSION });
    check("(f5) Aprobar una tienda devuelta → rechazado", r3.error?.code === "22023", fmt(r3.error));
    const r4 = await rpc("solicitar_tienda", { p_artista_id: C.artistaId, p_version: VERSION });
    const t2 = await tienda(C.artistaId);
    check("(f6) Vuelve a solicitar y se limpia el comentario", !r4.error && t2.estado === "solicitada" && t2.comentario_moderacion === null, fmt(r4.error));
  }

  console.log("\n── Aprobar ──");
  {
    const r0 = await rpc("aprobar_tienda", { p_artista_id: C.artistaId, p_admin: A.userId, p_version: VERSION });
    check("(g1) Aprobar con un usuario que no es admin → rechazado", rechazo(r0.error) && (await tienda(C.artistaId)).estado === "solicitada", fmt(r0.error));
  }
  {
    // Desconectó MP después de solicitar.
    await admin.from("artistas").update({ cobros_activos: false }).eq("id", C.artistaId);
    const r = await rpc("aprobar_tienda", { p_artista_id: C.artistaId, p_admin: ADMIN.userId, p_version: VERSION });
    const a = await artista(C.artistaId);
    check("(g2) Si desconectó MP tras solicitar → rechazado, y nada cambió",
      /incompleto: identidad, mp$/.test(r.error?.message ?? "") && !a.tienda_activa && a.cobro === "centralizado" && (await estadoProducto(borrador)) === "borrador", fmt(r.error));
    await admin.from("artistas").update({ cobros_activos: true }).eq("id", C.artistaId);
  }
  {
    const r = await rpc("aprobar_tienda", { p_artista_id: C.artistaId, p_admin: ADMIN.userId, p_version: VERSION });
    const t = await tienda(C.artistaId);
    const a = await artista(C.artistaId);
    check("(g3) Aprobar → 'activa', con quién y cuándo", !r.error && t.estado === "activa" && t.resuelta_por === ADMIN.userId && !!t.resuelta_at, fmt(r.error));
    check("(g4) Aprobar activa tienda_activa y cobro 'marketplace' en la misma operación", a.tienda_activa === true && a.cobro === "marketplace", JSON.stringify(a));
    check("(g5) Sus borradores pasan a 'en_revision', sin publicarse", (await estadoProducto(borrador)) === "en_revision");
    check("(g6) No toca los borradores de otro artista", (await estadoProducto(aprobadoAjeno)) === "borrador");
    const b = await artista(B.artistaId);
    check("(g7) No toca el cobro de otro artista", b.cobro === "centralizado" && !b.tienda_activa, JSON.stringify(b));
    const { data: modelo } = await admin.from("app_settings").select("value").eq("key", "cobro_modelo").single();
    check("(g8) app_settings.cobro_modelo sigue 'centralizado'", modelo?.value === "centralizado", JSON.stringify(modelo));
    const { error } = await C.cliente.from("tiendas").update({ despacho_costo: 4000 }).eq("artista_id", C.artistaId);
    check("(g9) Con la tienda activa sigue editando su despacho", !error, fmt(error));
    const { error: e2 } = await C.cliente.from("tiendas").update({ estado: "suspendida" }).eq("artista_id", C.artistaId);
    check("(g10) Con la tienda activa tampoco escribe el estado", rechazo(e2), fmt(e2));
  }

  console.log("\n── Suspender y reactivar ──");
  {
    const r0 = await rpc("suspender_tienda", { p_artista_id: C.artistaId, p_admin: ADMIN.userId, p_motivo: " " });
    check("(h1) Suspender sin motivo → rechazado", r0.error?.code === "22023", fmt(r0.error));
    const r = await rpc("suspender_tienda", { p_artista_id: C.artistaId, p_admin: ADMIN.userId, p_motivo: "Reclamos" });
    const t = await tienda(C.artistaId);
    const a = await artista(C.artistaId);
    check("(h2) Suspender → 'suspendida' y apaga tienda_activa", !r.error && t.estado === "suspendida" && a.tienda_activa === false, fmt(r.error));
    check("(h3) El cobro sigue 'marketplace': no vuelve a la cuenta de MuzikChile", a.cobro === "marketplace", JSON.stringify(a));

    const nuevo = await sembrarProducto(C.artistaId, "borrador");
    const r2 = await rpc("aprobar_tienda", { p_artista_id: C.artistaId, p_admin: ADMIN.userId, p_version: VERSION });
    const a2 = await artista(C.artistaId);
    check("(h4) Reactivar → 'activa' y tienda_activa", !r2.error && (await tienda(C.artistaId)).estado === "activa" && a2.tienda_activa === true, fmt(r2.error));
    check("(h5) Reactivar no manda a revisión un borrador nuevo", (await estadoProducto(nuevo)) === "borrador");
  }

  console.log("\n── Baja de la cuenta ──");
  {
    const { error } = await ADMIN.cliente.rpc("dar_de_baja_artista", { p_artista_id: C.artistaId });
    const t = await tienda(C.artistaId);
    check("(i1) La baja deja la tienda 'suspendida' y apagada", !error && t.estado === "suspendida" && !(await artista(C.artistaId)).tienda_activa, fmt(error));
    const { error: e2 } = await ADMIN.cliente.rpc("dar_de_baja_artista", { p_artista_id: C.artistaId, p_revertir: true });
    check("(i2) Revertir la baja no reactiva la tienda", !e2 && (await tienda(C.artistaId)).estado === "suspendida", fmt(e2));
  }

  console.log("\n── Base ──");
  {
    const { error } = await admin.from("tiendas").update({ estado: "inventado" }).eq("artista_id", B.artistaId);
    check("(j1) Un estado que no existe → rechazado por el CHECK, aun con service role", error?.code === "23514", fmt(error));
    const { error: e2 } = await admin.from("artistas").update({ cobro: "inventado" }).eq("id", B.artistaId);
    check("(j2) Un cobro que no existe → rechazado por el CHECK", e2?.code === "23514", fmt(e2));
    const { count } = await admin.from("artistas").select("id", { count: "exact", head: true });
    const { count: filas } = await admin.from("tiendas").select("artista_id", { count: "exact", head: true });
    check("(j3) Todo artista tiene su fila en tiendas", count === filas, `artistas=${count} tiendas=${filas}`);
  }
}

// ── Cómo cobra una tienda (--api) ────────────────────────────────────────────

async function cotizar(items) {
  const res = await fetch(`${API}/api/checkout/cotizar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

/** Cookie de sesión de un usuario, armada por @supabase/ssr (el formato de la app). */
async function cookieDe(u) {
  const frasco = new Map();
  const ssr = createServerClient(URL_BASE, ANON_KEY, {
    cookies: {
      getAll: () => [...frasco].map(([name, value]) => ({ name, value })),
      setAll: (lista) => lista.forEach(({ name, value }) => (value ? frasco.set(name, value) : frasco.delete(name))),
    },
  });
  const { error } = await ssr.auth.signInWithPassword({ email: u.email, password: u.password });
  if (error) throw new Error(`Cookie de sesión: ${error.message}`);
  return [...frasco].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function modeloDe(u) {
  const res = await fetch(`${API}/api/mp/conexion`, { headers: { Cookie: await cookieDe(u) } });
  return (await res.json().catch(() => null))?.modelo;
}

async function propCobro(productoId) {
  const html = await fetch(`${API}/producto/${productoId}`).then((res) => res.text());
  const prop = html.match(/directo\\?":(true|false),\\?"disponible\\?":(true|false)/);
  return prop ? `${prop[1]}/${prop[2]}` : "sin prop";
}

async function cobroPorArtista(ADMIN) {
  console.log(`\n── Cómo cobra una tienda · ${API} ──`);
  const D = await crearUsuario("d", "artista");
  const E = await crearUsuario("e", "artista");
  await sembrarProducto(D.artistaId, "borrador");
  const PD = await sembrarProducto(D.artistaId, "aprobado");
  const PE = await sembrarProducto(E.artistaId, "aprobado");

  {
    const r = await cotizar([{ id: PD, cantidad: 1 }]);
    check("(k1) Antes de aprobar → cotiza 'centralizado'", r.status === 200 && r.data?.cobro === "centralizado", JSON.stringify(r));
    check("(k2) Antes de aprobar → /api/mp/conexion dice 'centralizado'", (await modeloDe(D)) === "centralizado");
  }

  await completarChecklist(D);
  const s = await rpc("solicitar_tienda", { p_artista_id: D.artistaId, p_version: VERSION });
  const a = await rpc("aprobar_tienda", { p_artista_id: D.artistaId, p_admin: ADMIN.userId, p_version: VERSION });
  if (s.error || a.error) throw new Error(`Aprobar: ${fmt(s.error ?? a.error)}`);

  {
    const r = await cotizar([{ id: PD, cantidad: 1 }]);
    check("(k3) Tienda aprobada → cotiza 'marketplace', con el flag global y el piloto sin tocar", r.status === 200 && r.data?.cobro === "marketplace", JSON.stringify(r));
    check("(k4) Tienda aprobada → /api/mp/conexion dice 'marketplace'", (await modeloDe(D)) === "marketplace");
    check("(k5) Tienda aprobada → la ficha cobra directo y está disponible", (await propCobro(PD)) === "true/true", await propCobro(PD));
  }
  {
    const r = await cotizar([{ id: PE, cantidad: 1 }]);
    check("(k6) Otro artista sigue 'centralizado'", r.status === 200 && r.data?.cobro === "centralizado", JSON.stringify(r));
    check("(k7) La ficha de otro artista sigue centralizada", (await propCobro(PE)).startsWith("false"), await propCobro(PE));
  }
  {
    const r = await cotizar([{ id: PD, cantidad: 1 }, { id: PE, cantidad: 1 }]);
    check("(k8) Carrito con una tienda marketplace y otro artista → 422 'pedido aparte'", r.status === 422 && /pedido aparte/.test(r.data?.error ?? ""), JSON.stringify(r));
  }
  {
    // Perdió la conexión: el trigger de mp_conexiones deja cobros_activos en false.
    await admin.from("artistas").update({ cobros_activos: false }).eq("id", D.artistaId);
    const r = await cotizar([{ id: PD, cantidad: 1 }]);
    check("(k9) Sin cuenta conectada → 422 'disponibles pronto', nunca a la cuenta de MuzikChile", r.status === 422 && /disponibles pronto/.test(r.data?.error ?? ""), JSON.stringify(r));
    check("(k10) Sin cuenta conectada → la ficha muestra 'Pronto disponible'", (await propCobro(PD)) === "true/false", await propCobro(PD));
    await admin.from("artistas").update({ cobros_activos: true }).eq("id", D.artistaId);
  }
  {
    const su = await rpc("suspender_tienda", { p_artista_id: D.artistaId, p_admin: ADMIN.userId, p_motivo: "prueba" });
    const r = await cotizar([{ id: PD, cantidad: 1 }]);
    check("(k11) Suspendida: si se cotiza, nunca vuelve a 'centralizado'", !su.error && r.data?.cobro !== "centralizado", JSON.stringify(r));
  }
}

// ── Rutas del panel (--api) ──────────────────────────────────────────────────

async function rutasDelPanel() {
  console.log(`\n── Rutas del panel · ${API} ──`);
  for (const [caso, metodo, ruta] of [
    ["(m1)", "GET", "/api/panel/tienda"],
    ["(m2)", "POST", "/api/panel/tienda/aceptar-terminos"],
    ["(m3)", "POST", "/api/panel/tienda/solicitar"],
  ]) {
    const res = await fetch(`${API}${ruta}`, { method: metodo });
    check(`${caso} ${metodo} ${ruta} sin sesión → 401`, res.status === 401, `status=${res.status}`);
  }

  const F = await crearUsuario("f", "artista");
  const cookie = await cookieDe(F);
  const llamar = async (metodo, ruta, body) => {
    const res = await fetch(`${API}${ruta}`, {
      method: metodo,
      headers: { Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  const leer = async () => (await llamar("GET", "/api/panel/tienda")).data;

  {
    const d = await leer();
    check("(m4) La tienda nueva se lee 'no_activa', con el checklist vacío y la versión vigente",
      d?.estado === "no_activa" && Object.values(d?.checklist ?? { x: true }).every((x) => x === false) && d?.terminos?.version === VERSION_TERMINOS_ARTISTAS,
      JSON.stringify(d));
    check("(m5) Muestra la comisión de la tienda", d?.comision?.porcentaje === 10 && d?.comision?.detalle === null, JSON.stringify(d?.comision));
    check("(m6) No trae tokens", !/token/i.test(JSON.stringify(d)), JSON.stringify(d));
    check("(m7) Sin ventas, tieneOrdenes es false", d?.tieneOrdenes === false);
  }
  {
    await admin.from("artistas").update({ es_founder: true, founder_hasta: null }).eq("id", F.artistaId);
    const d = await leer();
    check("(m8) Founder sin fecha → comisión 0% y su detalle", d?.comision?.porcentaje === 0 && /de por vida/.test(d?.comision?.detalle ?? ""), JSON.stringify(d?.comision));
    await admin.from("artistas").update({ es_founder: false }).eq("id", F.artistaId);
  }
  {
    const r = await llamar("POST", "/api/panel/tienda/solicitar");
    check("(m9) Solicitar con el checklist vacío → 422 con lo que falta", r.status === 422 && /incompleto/.test(r.data?.error ?? ""), JSON.stringify(r));
  }
  {
    const r = await llamar("POST", "/api/panel/tienda/aceptar-terminos", { version: "9.9", artista_id: "cualquiera" });
    const { data: filas } = await admin.from("terminos_artistas").select("version, aceptado_por").eq("artista_id", F.artistaId);
    check("(m10) Aceptar guarda la versión vigente e ignora lo que venga en el body",
      r.status === 200 && filas?.length === 1 && filas[0].version === VERSION_TERMINOS_ARTISTAS && filas[0].aceptado_por === F.userId, JSON.stringify(filas));
    check("(m11) El checklist marca los términos", (await leer())?.checklist?.terminos === true);
  }
  {
    await admin.from("artistas").update({ cobros_activos: true }).eq("id", F.artistaId);
    await F.cliente.from("tiendas").update({
      identidad_mp_declarada: true, despacho_modo: "retiro", retiro_detalle: "Metro Baquedano",
    }).eq("artista_id", F.artistaId);
    const { error } = await F.cliente.from("productos").insert({
      artista_id: F.artistaId, nombre: `${PREFIJO}-panel`, precio: 5000, stock: 1, tipo: "fisico", imagenes: [], estado: "borrador",
    });
    check("(m12) El artista sin tienda activa guarda un producto en borrador", !error, fmt(error));
    const d = await leer();
    check("(m13) Con todo listo, el checklist está completo", Object.values(d?.checklist ?? {}).every((x) => x === true), JSON.stringify(d?.checklist));
    const r = await llamar("POST", "/api/panel/tienda/solicitar");
    check("(m14) Solicitar → 'solicitada'", r.status === 200 && r.data?.estado === "solicitada" && (await leer())?.estado === "solicitada", JSON.stringify(r));
    const r2 = await llamar("POST", "/api/panel/tienda/solicitar");
    check("(m15) Solicitar otra vez → 422", r2.status === 422, JSON.stringify(r2));
  }
  {
    const res = await fetch(`${API}/panel/cobros`, { redirect: "manual", headers: { Cookie: cookie } });
    check("(m16) /panel/cobros redirige a /panel/tienda", /\/panel\/tienda/.test(res.headers.get("location") ?? ""), `status=${res.status} ${res.headers.get("location")}`);
  }
}

// ── Bandeja del admin (--api) ────────────────────────────────────────────────

async function bandejaDelAdmin(ADMIN, ARTISTA) {
  console.log(`\n── Bandeja del admin · ${API} ──`);
  const RUTA = `${API}/api/admin/tiendas`;
  const jsonDe = (res) => res.json().catch(() => null);

  const G = await crearUsuario("g", "artista");
  const cookieAdmin = await cookieDe(ADMIN);
  const cookieArtista = await cookieDe(ARTISTA);
  const leerComo = async (cookie, query = "") => {
    const res = await fetch(`${RUTA}${query}`, { headers: cookie ? { Cookie: cookie } : {} });
    return { status: res.status, data: await jsonDe(res) };
  };
  const actuarComo = async (cookie, body) => {
    const res = await fetch(RUTA, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: await jsonDe(res) };
  };
  const actuar = (body) => actuarComo(cookieAdmin, body);
  const deG = async () => (await leerComo(cookieAdmin)).data?.tiendas?.find((t) => t.artistaId === G.artistaId);

  {
    check("(n1) GET sin sesión → 401", (await leerComo(null)).status === 401);
    check("(n2) GET como artista → 403", (await leerComo(cookieArtista)).status === 403);
    check("(n3) POST sin sesión → 401", (await actuarComo(null, { accion: "aprobar", artista_id: G.artistaId })).status === 401);
    check("(n4) POST como artista → 403, y nada cambia",
      (await actuarComo(cookieArtista, { accion: "aprobar", artista_id: ARTISTA.artistaId })).status === 403 && !(await artista(ARTISTA.artistaId)).tienda_activa);
    check("(n5) POST con acción desconocida → 400", (await actuar({ accion: "activar", artista_id: G.artistaId })).status === 400);
    check("(n6) POST sin artista → 400", (await actuar({ accion: "aprobar" })).status === 400);
    check("(n7) POST con artista inexistente → 404", (await actuar({ accion: "aprobar", artista_id: crypto.randomUUID() })).status === 404);
    check("(n8) Aprobar una tienda 'no_activa' → 422", (await actuar({ accion: "aprobar", artista_id: G.artistaId })).status === 422);
  }

  await completarChecklist(G);
  await rpc("aceptar_terminos_artista", { p_artista_id: G.artistaId, p_user_id: G.userId, p_version: VERSION_TERMINOS_ARTISTAS });
  const borrador = await sembrarProducto(G.artistaId, "borrador");
  const s = await rpc("solicitar_tienda", { p_artista_id: G.artistaId, p_version: VERSION_TERMINOS_ARTISTAS });
  if (s.error) throw new Error(`Solicitar: ${fmt(s.error)}`);

  {
    const r = await leerComo(cookieAdmin, "?estado=solicitada");
    const t = r.data?.tiendas?.find((x) => x.artistaId === G.artistaId);
    check("(n9) La solicitud aparece en la bandeja", r.status === 200 && !!t, JSON.stringify(r).slice(0, 200));
    check("(n10) Trae el checklist en vivo, despacho y productos",
      Object.values(t?.checklist ?? {}).every((x) => x === true) && t?.despacho?.despacho_costo === 3000 && t?.productos?.[0]?.id === borrador, JSON.stringify(t));
    check("(n11) No trae tokens", !/token/i.test(JSON.stringify(r.data)));
    const todas = await leerComo(cookieAdmin);
    check("(n12) Sin filtro trae otras tiendas; nunca al autor editorial",
      todas.data?.tiendas?.some((x) => x.artistaId === ARTISTA.artistaId) && !todas.data?.tiendas?.some((x) => x.slug === "muzikchile"), "");
    const { count } = await anon.from("tiendas").select("artista_id", { count: "exact", head: true }).eq("estado", "solicitada");
    check("(n13) El contador del menú no lo lee un anónimo", count === null);
    const { count: delAdmin, error } = await ADMIN.cliente.from("tiendas").select("artista_id", { count: "exact", head: true }).eq("estado", "solicitada");
    check("(n14) El contador del menú lo lee el admin", !error && delAdmin >= 1, fmt(error));
  }
  {
    const r = await actuar({ accion: "devolver", artista_id: G.artistaId, texto: "  " });
    check("(n15) Devolver sin comentario → 422", r.status === 422, JSON.stringify(r));
    const r2 = await actuar({ accion: "devolver", artista_id: G.artistaId, texto: "Falta la foto" });
    const t = await tienda(G.artistaId);
    check("(n16) Devolver → 'devuelta', y resuelve el admin de la sesión", r2.status === 200 && t.estado === "devuelta" && t.resuelta_por === ADMIN.userId, JSON.stringify(r2));
    await rpc("solicitar_tienda", { p_artista_id: G.artistaId, p_version: VERSION_TERMINOS_ARTISTAS });
  }
  {
    const r = await actuar({ accion: "aprobar", artista_id: G.artistaId, p_admin: G.userId, resuelta_por: G.userId });
    const t = await tienda(G.artistaId);
    const a = await artista(G.artistaId);
    check("(n17) Aprobar → 'activa', cobro 'marketplace'", r.status === 200 && t.estado === "activa" && a.tienda_activa && a.cobro === "marketplace", JSON.stringify(r));
    check("(n18) Ignora quién dice el body que resuelve", t.resuelta_por === ADMIN.userId, t.resuelta_por);
    check("(n19) Su borrador pasa a 'en_revision'", (await estadoProducto(borrador)) === "en_revision");
    check("(n20) La lista refleja el cambio", (await deG())?.estado === "activa");
    check("(n21) Suspender sin motivo → 422", (await actuar({ accion: "suspender", artista_id: G.artistaId })).status === 422);
    const r2 = await actuar({ accion: "suspender", artista_id: G.artistaId, texto: "Reclamos" });
    const a2 = await artista(G.artistaId);
    check("(n22) Suspender apaga la tienda y conserva el cobro", r2.status === 200 && !a2.tienda_activa && a2.cobro === "marketplace", JSON.stringify(a2));
    check("(n23) Se reactiva con la misma acción", (await actuar({ accion: "aprobar", artista_id: G.artistaId })).status === 200 && (await artista(G.artistaId)).tienda_activa);
  }
}

// ── Principal ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Base: ${new URL(URL_BASE).host}`);
  await limpiar();
  try {
    const A = await crearUsuario("a", "artista");
    const B = await crearUsuario("b", "artista");
    const ADMIN = await crearUsuario("admin", "admin");
    await casos(A, B, ADMIN);
    if (API) {
      await cobroPorArtista(ADMIN);
      await rutasDelPanel();
      await bandejaDelAdmin(ADMIN, B);
    }
    else console.log("\n── Cómo cobra una tienda: sin --api no se prueba ──");
  } finally {
    await limpiar();
  }

  const fallidos = resultados.filter((r) => !r.ok);
  console.log("\n" + "─".repeat(60));
  console.log(`Resultado: ${resultados.length - fallidos.length}/${resultados.length} casos OK`);
  if (fallidos.length > 0) {
    for (const f of fallidos) console.log(`  ✗ ${f.caso}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
