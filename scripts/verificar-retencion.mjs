/**
 * Verificación de la retención de datos (migración 20261026030000_retencion_datos
 * y /api/cron/retencion).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CORRERLO
 *
 *   npm run verificar:retencion                                  → base
 *   npm run verificar:retencion -- --api=http://localhost:3000   → + el cron
 *
 * Base: permisos de aplicar_retencion y dar_de_baja_artista, simulación sin
 *       efectos, ejecución real sobre filas con fechas antiguas, filas recientes
 *       intactas, baja y reversión, y que un artista no pueda tocar su baja.
 * API:  el cron sin secreto → 401; con CRON_SECRET, la ejecución completa
 *       (incluye borrar el usuario de Auth de la cuenta vencida).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ ESCRIBE EN LA BASE REAL, con el prefijo `rlstest-`, y limpia en el
 * `finally`. aplicar_retencion(false) actúa sobre TODA la base: antes de
 * ejecutarla, el script simula y se detiene si tocaría algo que no sea de
 * prueba.
 */

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON_KEY || !SERVICE_KEY) {
  console.error("Faltan variables de entorno. Corre con: npm run verificar:retencion");
  process.exit(1);
}
const API = process.argv.find((a) => a.startsWith("--api="))?.slice("--api=".length).replace(/\/$/, "");

const FAMILIA = "rlstest-";
const PREFIJO = `${FAMILIA}${Date.now()}`;
const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(URL, SERVICE_KEY, opciones);
const anon = createClient(URL, ANON_KEY, opciones);

const resultados = [];
function check(caso, ok, detalle) {
  resultados.push({ caso, ok });
  console.log(`  ${ok ? "✓" : "✗"} ${caso}`);
  if (detalle) console.log(`      ${detalle}`);
}
const fmt = (e) => (e ? `${e.code ?? ""} ${e.message}`.trim() : "sin error");
const haceDias = (d) => new Date(Date.now() - d * 86400000).toISOString();

async function crearUsuario(sufijo, rol) {
  const email = `${PREFIJO}-${sufijo}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Usuario ${sufijo}: ${error.message}`);
  const { error: rolErr } = await admin.from("user_roles").insert({ user_id: data.user.id, role: rol });
  if (rolErr && rolErr.code !== "23505") throw new Error(`Rol ${sufijo}: ${rolErr.message}`);
  const cliente = createClient(URL, ANON_KEY, opciones);
  const { error: loginErr } = await cliente.auth.signInWithPassword({ email, password });
  if (loginErr) throw new Error(`Login ${sufijo}: ${loginErr.message}`);
  return { userId: data.user.id, cliente };
}

async function crearArtista(sufijo, extra = {}) {
  const u = await crearUsuario(sufijo, "artista");
  const { data, error } = await admin
    .from("artistas")
    .insert({ user_id: u.userId, nombre: `RLS Test ${sufijo}`, slug: `${PREFIJO}-${sufijo}`, ...extra })
    .select("id")
    .single();
  if (error) throw new Error(`Artista ${sufijo}: ${error.message}`);
  return { ...u, artistaId: data.id };
}

async function crearProducto(artistaId, sufijo) {
  const { data, error } = await admin
    .from("productos")
    .insert({ artista_id: artistaId, nombre: `${PREFIJO}-${sufijo}`, precio: 1000, stock: 1, tipo: "fisico", estado: "aprobado", imagenes: [] })
    .select("id")
    .single();
  if (error) throw new Error(`Producto ${sufijo}: ${error.message}`);
  return data.id;
}

async function crearOrden(artistaId, productoId, sufijo, creada) {
  const { data, error } = await admin
    .from("ordenes")
    .insert({
      artista_id: artistaId, producto_id: productoId, cantidad: 1, precio_unitario: 1000,
      monto_artista: 900, comision_monto: 100, estado: "pagado", grupo_id: crypto.randomUUID(),
      comprador_nombre: "RLS Test", comprador_email: `${PREFIJO}-${sufijo}@example.com`,
      direccion_envio: "Calle Falsa 123", ciudad_envio: "Valparaíso", region_envio: "Valparaíso",
      created_at: creada,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Orden ${sufijo}: ${error.message}`);
  return data.id;
}

function filaConexion(artistaId, mpUserId, estado, actualizada) {
  return {
    artista_id: artistaId, mp_user_id: mpUserId, nickname: "RLSTEST", email: `${PREFIJO}-mp@example.com`,
    access_token_cifrado: "x", refresh_token_cifrado: "x", live_mode: false,
    expires_at: new Date(Date.now() + 86400000).toISOString(), estado, updated_at: actualizada,
  };
}
const mpId = () => 9_000_000_000 + Math.floor(Math.random() * 999_999_999);

/** Liquidación con un comprobante real en el bucket privado `comprobantes`. */
async function crearLiquidacion(artistaId, sufijo, fecha) {
  const ruta = `${artistaId}/${PREFIJO}-${sufijo}.pdf`;
  const { error: upErr } = await admin.storage
    .from("comprobantes")
    .upload(ruta, new Blob([`comprobante ${sufijo}`], { type: "application/pdf" }), { contentType: "application/pdf" });
  if (upErr) throw new Error(`Comprobante ${sufijo}: ${upErr.message}`);
  const { data, error } = await admin
    .from("liquidaciones")
    .insert({ artista_id: artistaId, monto: 900, fecha_transferencia: fecha.slice(0, 10), comprobante_url: ruta, numero_comprobante: `${PREFIJO}-${sufijo}` })
    .select("id")
    .single();
  if (error) throw new Error(`Liquidación ${sufijo}: ${error.message}`);
  return { id: data.id, ruta };
}

const existeComprobante = async (ruta) => !(await admin.storage.from("comprobantes").download(ruta)).error;

async function limpiar() {
  console.log("\nLimpiando datos de prueba...");
  const { data: artistas } = await admin.from("artistas").select("id").like("slug", `${FAMILIA}%`);
  for (const a of artistas ?? []) {
    const { data: archivos } = await admin.storage.from("comprobantes").list(a.id, { limit: 100 });
    const rutas = (archivos ?? []).filter((f) => f.name.startsWith(FAMILIA)).map((f) => `${a.id}/${f.name}`);
    if (rutas.length) await admin.storage.from("comprobantes").remove(rutas);
    await admin.from("liquidaciones").delete().eq("artista_id", a.id);
    await admin.from("ordenes").delete().eq("artista_id", a.id);
    await admin.from("productos").delete().eq("artista_id", a.id);
    await admin.from("mp_conexiones").delete().eq("artista_id", a.id);
    await admin.from("artistas").delete().eq("id", a.id);
  }
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const deTest = (lista?.users ?? []).filter((u) => u.email?.startsWith(FAMILIA));
  for (const u of deTest) await admin.auth.admin.deleteUser(u.id);
  console.log(`  Usuarios: ${deTest.length} · artistas: ${artistas?.length ?? 0}`);
}

/** ¿La retención tocaría algo que no sea de prueba? */
function soloDePrueba(sim, esperado) {
  const ajenos = [];
  if (sim.ordenes_anonimizadas !== esperado.ordenes) ajenos.push(`órdenes: ${sim.ordenes_anonimizadas} (de prueba: ${esperado.ordenes})`);
  if (sim.conexiones_borradas !== esperado.conexiones) ajenos.push(`conexiones: ${sim.conexiones_borradas} (de prueba: ${esperado.conexiones})`);
  const otrosArtistas = sim.artistas.filter((a) => !esperado.artistas.includes(a.artista_id));
  if (otrosArtistas.length) ajenos.push(`cuentas: ${otrosArtistas.length} que no son de prueba`);
  const otrosComprobantes = sim.comprobantes.filter((c) => !esperado.comprobantes.includes(c.liquidacion_id));
  if (otrosComprobantes.length) ajenos.push(`comprobantes: ${otrosComprobantes.length} que no son de prueba`);
  return ajenos;
}

async function main() {
  console.log("Verificación · retención de datos");
  console.log(`Proyecto: ${URL}${API ? ` · API: ${API}` : ""}`);
  try {
    await limpiar();
    const ADM = await crearUsuario("admin", "admin");
    const vigente = await crearArtista("vigente");          // cuenta activa
    const bajaReciente = await crearArtista("baja-reciente"); // baja hace 1 mes
    const bajaVencida = await crearArtista("baja-vencida", { rut: "11.111.111-1", banco: "Banco de Prueba", cuenta_bancaria: "000111", bio: "Bio de prueba" });

    const prod = await crearProducto(vigente.artistaId, "prod");
    const ordenVieja = await crearOrden(vigente.artistaId, prod, "vieja", new Date(Date.now() - 7 * 365 * 86400000).toISOString());
    const ordenNueva = await crearOrden(vigente.artistaId, prod, "nueva", haceDias(10));

    await admin.from("mp_conexiones").insert(filaConexion(vigente.artistaId, mpId(), "reconectar", haceDias(91)));
    await admin.from("mp_conexiones").insert(filaConexion(bajaReciente.artistaId, mpId(), "reconectar", haceDias(30)));

    await admin.from("artistas").update({ baja_at: haceDias(30) }).eq("id", bajaReciente.artistaId);
    await admin.from("artistas").update({ baja_at: haceDias(400) }).eq("id", bajaVencida.artistaId);

    const liqVieja = await crearLiquidacion(vigente.artistaId, "comprobante-viejo", new Date(Date.now() - 7 * 365 * 86400000).toISOString());
    const liqNueva = await crearLiquidacion(vigente.artistaId, "comprobante-nuevo", haceDias(10));

    console.log("\n── Permisos ──");
    {
      const r1 = await anon.rpc("aplicar_retencion", { p_simular: true });
      const r2 = await vigente.cliente.rpc("aplicar_retencion", { p_simular: true });
      const r3 = await ADM.cliente.rpc("aplicar_retencion", { p_simular: true });
      check("(r1) aplicar_retencion: anónimo, artista y admin (desde el navegador) → rechazado",
        !!r1.error && !!r2.error && !!r3.error, `anon: ${fmt(r1.error)} · artista: ${fmt(r2.error)} · admin: ${fmt(r3.error)}`);
    }
    {
      const { error } = await vigente.cliente.rpc("dar_de_baja_artista", { p_artista_id: vigente.artistaId });
      check("(r2) Un artista se da de baja a sí mismo por RPC → rechazado (solo admin)", error?.code === "42501", fmt(error));
    }
    {
      const { error } = await vigente.cliente.from("artistas").update({ baja_at: haceDias(1) }).eq("id", vigente.artistaId);
      check("(r3) Un artista escribe su baja_at directo → rechazado (trigger)", error?.code === "42501", fmt(error));
    }

    console.log("\n── Baja y reversión (admin) ──");
    {
      const prodBaja = await crearProducto(bajaReciente.artistaId, "baja");
      await admin.from("artistas").update({ baja_at: null, tienda_activa: true }).eq("id", bajaReciente.artistaId);
      const { error } = await ADM.cliente.rpc("dar_de_baja_artista", { p_artista_id: bajaReciente.artistaId });
      const { data: a } = await admin.from("artistas").select("baja_at, tienda_activa").eq("id", bajaReciente.artistaId).single();
      const { data: p } = await admin.from("productos").select("estado").eq("id", prodBaja).single();
      check("(r4) Admin da de baja → baja_at puesta, tienda apagada, productos pausados",
        !error && !!a?.baja_at && a.tienda_activa === false && p?.estado === "pausado", error ? fmt(error) : JSON.stringify({ ...a, producto: p?.estado }));

      const rev = await ADM.cliente.rpc("dar_de_baja_artista", { p_artista_id: bajaReciente.artistaId, p_revertir: true });
      const { data: a2 } = await admin.from("artistas").select("baja_at").eq("id", bajaReciente.artistaId).single();
      const { data: p2 } = await admin.from("productos").select("estado").eq("id", prodBaja).single();
      check("(r5) Admin revierte → sin baja_at, productos aprobados de nuevo", !rev.error && a2?.baja_at === null && p2?.estado === "aprobado",
        rev.error ? fmt(rev.error) : JSON.stringify({ ...a2, producto: p2?.estado }));
      // Vuelve a dejarla dada de baja hace un mes, para lo que sigue.
      await admin.from("artistas").update({ baja_at: haceDias(30) }).eq("id", bajaReciente.artistaId);
    }

    console.log("\n── Simulación ──");
    const esperado = { ordenes: 1, conexiones: 1, artistas: [bajaVencida.artistaId], comprobantes: [liqVieja.id] };
    const { data: sim, error: simErr } = await admin.rpc("aplicar_retencion", { p_simular: true });
    if (simErr) throw new Error(`Simulación: ${fmt(simErr)}`);
    {
      const ok = sim.simulado === true && sim.artistas.some((a) => a.artista_id === bajaVencida.artistaId && a.user_id === bajaVencida.userId)
        && !sim.artistas.some((a) => a.artista_id === bajaReciente.artistaId)
        && sim.comprobantes.some((c) => c.liquidacion_id === liqVieja.id && c.ruta === liqVieja.ruta)
        && !sim.comprobantes.some((c) => c.liquidacion_id === liqNueva.id);
      const { data: o } = await admin.from("ordenes").select("comprador_email").eq("id", ordenVieja).single();
      check("(r6) Simular cuenta lo vencido (y no la baja reciente) sin cambiar nada", ok && o?.comprador_email?.startsWith(PREFIJO),
        JSON.stringify({ ordenes: sim.ordenes_anonimizadas, conexiones: sim.conexiones_borradas, cuentas: sim.artistas.length, comprobantes: sim.comprobantes.length }));
    }
    const ajenos = soloDePrueba(sim, esperado);
    if (ajenos.length) {
      check("(r7) La ejecución real tocaría solo datos de prueba", false, `Se detiene antes de aplicar: ${ajenos.join(" · ")}`);
      return;
    }
    check("(r7) La ejecución real tocaría solo datos de prueba", true);

    console.log("\n── Ejecución real ──");
    const CRON = process.env.CRON_SECRET;
    if (API && CRON) {
      const sin = await fetch(`${API}/api/cron/retencion`);
      check("(r8) Cron sin CRON_SECRET → 401", sin.status === 401, `status=${sin.status}`);
      const r = await fetch(`${API}/api/cron/retencion`, { headers: { authorization: `Bearer ${CRON}` } });
      const d = await r.json().catch(() => null);
      check("(r9) Cron con CRON_SECRET → aplica y borra el usuario de Auth de la cuenta vencida",
        r.status === 200 && d?.usuarios_borrados === 1, `status=${r.status} ${JSON.stringify(d)}`);
    } else {
      const { error } = await admin.rpc("aplicar_retencion", { p_simular: false });
      check("(r9) aplicar_retencion(false) con la service role → sin error (sin --api no se prueba el cron)", !error, fmt(error));
    }

    {
      const { data: v } = await admin.from("ordenes").select("comprador_nombre, comprador_email, direccion_envio, ciudad_envio, monto_artista").eq("id", ordenVieja).single();
      const { data: n } = await admin.from("ordenes").select("comprador_email, direccion_envio").eq("id", ordenNueva).single();
      check("(r10) Orden de hace 7 años anonimizada (monto intacto); la de hace 10 días intacta",
        v?.comprador_nombre === "Anonimizado" && v.comprador_email === "anonimizado@invalid" && v.direccion_envio === null && v.ciudad_envio === null && v.monto_artista === 900
          && n?.comprador_email?.startsWith(PREFIJO) && n.direccion_envio === "Calle Falsa 123",
        JSON.stringify({ vieja: v, nueva: n }));
    }
    {
      const { data: c1 } = await admin.from("mp_conexiones").select("artista_id").eq("artista_id", vigente.artistaId);
      const { data: c2 } = await admin.from("mp_conexiones").select("artista_id").eq("artista_id", bajaReciente.artistaId);
      check("(r11) Conexión en 'reconectar' de hace 91 días borrada; la de hace 30 días sigue", (c1 ?? []).length === 0 && (c2 ?? []).length === 1,
        `91 días: ${(c1 ?? []).length} · 30 días: ${(c2 ?? []).length}`);
    }
    {
      const { data: a } = await admin.from("artistas").select("nombre, rut, banco, cuenta_bancaria, bio, user_id, tienda_activa, datos_eliminados_at").eq("id", bajaVencida.artistaId).single();
      const { data: r } = await admin.from("artistas").select("rut, user_id, datos_eliminados_at").eq("id", bajaReciente.artistaId).single();
      check("(r12) Baja de hace 400 días: sin RUT, banco, bio ni user_id, con datos_eliminados_at; el nombre queda",
        a?.rut === null && a.banco === null && a.cuenta_bancaria === null && a.bio === null && a.user_id === null && !!a.datos_eliminados_at && a.nombre?.startsWith("RLS Test"),
        JSON.stringify(a));
      check("(r13) Baja de hace 30 días: intacta", r?.user_id === bajaReciente.userId && r.datos_eliminados_at === null, JSON.stringify(r));
    }
    {
      const rev = await ADM.cliente.rpc("dar_de_baja_artista", { p_artista_id: bajaVencida.artistaId, p_revertir: true });
      check("(r14) Revertir una baja con los datos ya eliminados → rechazado", !!rev.error, fmt(rev.error));
    }
    {
      const { data: lv } = await admin.from("liquidaciones").select("comprobante_url, numero_comprobante, monto").eq("id", liqVieja.id).single();
      const { data: ln } = await admin.from("liquidaciones").select("comprobante_url").eq("id", liqNueva.id).single();
      const archivoViejo = await existeComprobante(liqVieja.ruta);
      const archivoNuevo = await existeComprobante(liqNueva.ruta);
      const detalle = JSON.stringify({ vieja: { url: lv?.comprobante_url, archivo: archivoViejo }, nueva: { url: ln?.comprobante_url, archivo: archivoNuevo } });
      if (API && process.env.CRON_SECRET) {
        check("(r15) Comprobante de hace 7 años: archivo borrado y comprobante_url limpia (la liquidación queda); el de hace 10 días intacto",
          !archivoViejo && lv?.comprobante_url === null && lv.monto === 900 && archivoNuevo && ln?.comprobante_url === liqNueva.ruta, detalle);
      } else {
        // Sin el cron, la función SQL solo lista: no puede ni debe tocar los archivos.
        check("(r15) Sin el cron, los comprobantes siguen intactos (SQL solo los lista)",
          archivoViejo && lv?.comprobante_url === liqVieja.ruta && archivoNuevo, detalle);
      }
    }
  } catch (err) {
    console.error("\nError montando o ejecutando la verificación:");
    console.error(`  ${err.message}`);
    resultados.push({ caso: "ejecución del script", ok: false });
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
