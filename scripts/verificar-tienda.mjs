/**
 * Verificación de la activación de tienda: permisos, estados y aprobación.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CORRERLO
 *
 *   npm run verificar:tienda
 *   npm run verificar:tienda -- --api=http://localhost:3000
 *                         → + cómo cobra una tienda (cotizar, ficha, /api/mp/conexion).
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
  await admin.from("tiendas").update({
    identidad_mp_declarada: true, despacho_modo: "envio", despacho_costo: 3000, despacho_plazo_min: 2, despacho_plazo_max: 5,
  }).eq("artista_id", u.artistaId);
  await admin.from("artistas").update({ cobros_activos: true }).eq("id", u.artistaId);
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
    const t = await tienda(A.artistaId);
    check("(b2) Declara su identidad de MP y la fecha la pone la base", !error && t.identidad_mp_declarada && !!t.identidad_mp_declarada_at, fmt(error));
    await A.cliente.from("tiendas").update({ identidad_mp_declarada: false }).eq("artista_id", A.artistaId);
    check("(b3) Quitar la declaración borra la fecha", !(await tienda(A.artistaId)).identidad_mp_declarada_at);
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
      /incompleto: mp$/.test(r.error?.message ?? "") && !a.tienda_activa && a.cobro === "centralizado" && (await estadoProducto(borrador)) === "borrador", fmt(r.error));
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

// ── Principal ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Base: ${new URL(URL_BASE).host}`);
  await limpiar();
  try {
    const A = await crearUsuario("a", "artista");
    const B = await crearUsuario("b", "artista");
    const ADMIN = await crearUsuario("admin", "admin");
    await casos(A, B, ADMIN);
    if (API) await cobroPorArtista(ADMIN);
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
