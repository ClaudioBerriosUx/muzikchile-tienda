/**
 * Verificación de la seguridad del cobro (commit 1 del cambio a marketplace).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CORRERLO
 *
 *   npm run verificar:cobro                        → fase 1 (migración 20261022200000)
 *   npm run verificar:cobro -- --fase2             → + fase 2 (20261022200100)
 *   npm run verificar:cobro -- --api=http://localhost:3000
 *                                                  → + API (cotizar, preferencia, webhook)
 *
 * Fase 1: trigger de columnas protegidas, datos_bancarios(), permisos de
 *         incrementar_usos_cupon y confirmar_pago (idempotencia, concurrencia,
 *         stock atómico).
 * Fase 2: lectura de `artistas` por columna y cupones sin lectura pública.
 *         Artistas de prueba (20261024204929): fuera de /tienda y del sitemap.
 * API:    precio desde la base, cupón validado en el servidor, stock, webhook.
 *         ⚠️ Crea UNA preferencia real en la cuenta de MercadoPago configurada
 *         en app_settings (sin pagar: no mueve plata).
 * (mk):   cobro marketplace en piloto (20261024211159), solo con --api y contra
 *         un servidor LOCAL: la conexión de prueba se cifra con la
 *         MP_TOKENS_KEY de .env.local. Mete al artista de prueba A en
 *         app_settings.marketplace_piloto unos segundos y deja el valor como
 *         estaba al terminar (también si el script falla).
 *
 * Sale con código 0 si todos los casos pasan, 1 si alguno falla.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ ESCRIBE EN LA BASE DE DATOS REAL (el proyecto no tiene entorno de test).
 * Todo lo que crea lleva el prefijo `rlstest-` (cupones: `RLSTEST-`) y se borra
 * en el `finally`. Los productos de prueba quedan `aprobado` unos segundos, así
 * que pueden asomarse en /tienda mientras corre.
 *
 * Como en verificar-rls-publicaciones.mjs, la service role key solo monta y
 * desmonta el escenario; las aserciones de permisos se hacen con clientes
 * autenticados como los usuarios de prueba o con el cliente anónimo.
 * confirmar_pago() es la excepción: solo el service role puede llamarla, así
 * que se prueba con él.
 */

import { createClient } from "@supabase/supabase-js";
// Node 24 importa TypeScript sin compilar (solo quita los tipos).
import { comisionEfectiva, founderVigente, textoFounder } from "../lib/comision.ts";
import { cifrar } from "../lib/mp/cifrado.ts";

const URL          = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON_KEY || !SERVICE_KEY) {
  console.error("Faltan variables de entorno. Corre con: npm run verificar:cobro");
  process.exit(1);
}

const FASE2 = process.argv.includes("--fase2");
const API   = process.argv.find((a) => a.startsWith("--api="))?.slice("--api=".length).replace(/\/$/, "");

const FAMILIA = "rlstest-";
const PREFIJO = `${FAMILIA}${Date.now()}`;
const CUPON_FAMILIA = "RLSTEST-";
const CUPON = (s) => `${CUPON_FAMILIA}${Date.now()}-${s}`.toUpperCase();

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

async function crearUsuario(sufijo, rol) {
  const email = `${PREFIJO}-${sufijo}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`No se pudo crear el usuario ${sufijo}: ${error.message}`);
  const userId = data.user.id;

  // El trigger de auth.users ya pone un rol; el 23505 de la unique no es fallo.
  const { error: rolErr } = await admin.from("user_roles").insert({ user_id: userId, role: rol });
  if (rolErr && rolErr.code !== "23505") throw new Error(`Rol ${rol} para ${sufijo}: ${rolErr.message}`);

  const cliente = createClient(URL, ANON_KEY, opciones);
  const { error: loginErr } = await cliente.auth.signInWithPassword({ email, password });
  if (loginErr) throw new Error(`Login ${sufijo}: ${loginErr.message}`);
  return { userId, cliente };
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

async function crearProducto(artistaId, sufijo, extra = {}) {
  const { data, error } = await admin
    .from("productos")
    .insert({
      artista_id: artistaId,
      nombre: `${PREFIJO}-${sufijo}`,
      precio: 10000,
      stock: 10,
      tipo: "fisico",
      estado: "aprobado",
      imagenes: [],
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Producto ${sufijo}: ${error.message}`);
  return data.id;
}

async function crearCupon(sufijo, campos) {
  const codigo = CUPON(sufijo);
  const { data, error } = await admin
    .from("cupones")
    .insert({ codigo, tipo_descuento: "porcentaje", valor: 10, activo: true, ...campos })
    .select("id, codigo")
    .single();
  if (error) throw new Error(`Cupón ${sufijo}: ${error.message}`);
  return data;
}

/** Inserta un grupo de órdenes como lo haría crear-preferencia. */
async function crearGrupo(artistaId, lineas, estado = "pendiente") {
  const grupo = crypto.randomUUID();
  const { error } = await admin.from("ordenes").insert(
    lineas.map((l) => ({
      artista_id: artistaId,
      producto_id: l.producto,
      cantidad: l.cantidad,
      precio_unitario: 10000,
      monto_artista: 9000 * l.cantidad,
      comision_monto: 1000 * l.cantidad,
      comprador_nombre: "RLS Test",
      comprador_email: `${PREFIJO}-comprador@example.com`,
      estado,
      grupo_id: grupo,
      cupon_id: l.cupon ?? null,
    }))
  );
  if (error) throw new Error(`Órdenes: ${error.message}`);
  return grupo;
}

const stockDe = async (id) => (await admin.from("productos").select("stock").eq("id", id).single()).data?.stock;
const usosDe  = async (id) => (await admin.from("cupones").select("usos_actuales").eq("id", id).single()).data?.usos_actuales;
const estadosDe = async (grupo) =>
  ((await admin.from("ordenes").select("estado").eq("grupo_id", grupo)).data ?? []).map((o) => o.estado);

let nPago = 0;
const pagoId = () => `${PREFIJO}-pago-${++nPago}`;
const confirmar = (grupo, pago) =>
  admin.rpc("confirmar_pago", { p_grupo_id: grupo, p_payment_id: pago, p_monto: 1 });

// ── Limpieza (por prefijo, como en verificar-rls-publicaciones.mjs) ──────────

async function limpiar() {
  console.log("\nLimpiando datos de prueba...");

  const { data: productos } = await admin.from("productos").select("id").like("nombre", `${FAMILIA}%`);
  const ids = (productos ?? []).map((p) => p.id);

  if (ids.length) {
    const { data: ordenes } = await admin.from("ordenes").select("grupo_id").in("producto_id", ids);
    const grupos = [...new Set((ordenes ?? []).map((o) => o.grupo_id).filter(Boolean))];
    if (grupos.length) await admin.from("pagos_mp").delete().in("grupo_id", grupos);
    await admin.from("ordenes").delete().in("producto_id", ids);
  }
  await admin.from("pagos_mp").delete().like("mp_payment_id", `${FAMILIA}%`);
  await admin.from("ordenes").delete().like("comprador_email", `${FAMILIA}%`);
  if (ids.length) await admin.from("productos").delete().in("id", ids);
  await admin.from("cupones").delete().like("codigo", `${CUPON_FAMILIA}%`);

  const { data: artistas } = await admin.from("artistas").select("id, user_id").like("slug", `${FAMILIA}%`);
  for (const a of artistas ?? []) {
    await admin.from("mp_conexiones").delete().eq("artista_id", a.id);
    await admin.from("productos").delete().eq("artista_id", a.id);
    await admin.from("cupones").delete().eq("artista_id", a.id);
    await admin.from("artistas").delete().eq("id", a.id);
  }

  const { data: lista, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error("  ! no se pudo listar usuarios:", error.message);
  } else {
    const deTest = (lista?.users ?? []).filter((u) => u.email?.startsWith(FAMILIA));
    for (const u of deTest) {
      await admin.from("user_roles").delete().eq("user_id", u.id);
      await admin.auth.admin.deleteUser(u.id);
    }
    console.log(`  Usuarios: ${deTest.length} · artistas: ${artistas?.length ?? 0} · productos: ${ids.length}`);
  }
}

// ── Regla de comisión (lib/comision.ts, sin base de datos) ────────────────────

function reglaComision() {
  console.log("\n── Regla de comisión ──");
  const hoy = "2026-10-23";
  const casos = [
    ["No founder → su comisión", { comision: 12, es_founder: false, founder_hasta: null }, 12],
    ["Founder sin fecha → 0% de por vida", { comision: 10, es_founder: true, founder_hasta: null }, 0],
    ["Founder hasta mañana → 0%", { comision: 10, es_founder: true, founder_hasta: "2026-10-24" }, 0],
    ["Founder hasta hoy → 0% (inclusive)", { comision: 10, es_founder: true, founder_hasta: "2026-10-23" }, 0],
    ["Founder hasta ayer → su comisión", { comision: 10, es_founder: true, founder_hasta: "2026-10-22" }, 10],
    ["Fecha sin founder → su comisión", { comision: 8, es_founder: false, founder_hasta: "2099-01-01" }, 8],
  ];
  for (const [caso, datos, esperado] of casos) {
    const r = comisionEfectiva(datos, hoy);
    check(`(com) ${caso}`, r === esperado, `obtuvo ${r}`);
  }
  check("(com) Texto de por vida", textoFounder(null) === "Comisión 0% de por vida", textoFounder(null));
  check("(com) Texto con fecha", textoFounder("2027-12-31") === "Comisión 0% hasta 31-12-2027", textoFounder("2027-12-31"));
  check("(com) founderVigente sin founder → false", founderVigente({ es_founder: false, founder_hasta: null }, hoy) === false);
}

// ── Fase 1 ───────────────────────────────────────────────────────────────────

async function fase1(A, B, ADMIN) {
  console.log("\n── Fase 1 · columnas protegidas ──");

  for (const [campo, valor] of [["comision", 0], ["es_founder", true], ["founder_hasta", "2099-12-31"], ["tienda_activa", true], ["verificado", true], ["cobros_activos", true], ["es_prueba", true]]) {
    const { error } = await A.cliente.from("artistas").update({ [campo]: valor }).eq("id", A.artistaId);
    check(`(a) Artista cambia su propio ${campo} → rechazado`, error?.code === "42501", fmt(error));
  }

  {
    const { error } = await A.cliente.from("artistas").update({ bio: "bio de prueba" }).eq("id", A.artistaId);
    check("(b) Artista cambia su propia bio → permitido (sin regresión)", !error, fmt(error));
  }

  {
    const { error } = await ADMIN.cliente.from("artistas").update({ comision: 15, founder_hasta: "2027-12-31", es_prueba: true }).eq("id", A.artistaId);
    const { data } = await admin.from("artistas").select("comision, founder_hasta, es_prueba").eq("id", A.artistaId).single();
    check("(c) Admin cambia comision, founder_hasta y es_prueba de un artista → permitido", !error && Number(data?.comision) === 15 && data?.founder_hasta === "2027-12-31" && data?.es_prueba === true, fmt(error));
    await admin.from("artistas").update({ comision: 10, founder_hasta: null, es_prueba: false }).eq("id", A.artistaId);
  }

  {
    // Usuario nuevo sin fila en artistas, como en el primer login del panel.
    const N = await crearUsuario("nuevo", "artista");
    const { error } = await N.cliente.from("artistas").insert({
      user_id: N.userId, nombre: "RLS Test nuevo", slug: `${PREFIJO}-nuevo`,
      comision: 0, es_founder: true, founder_hasta: "2099-12-31", tienda_activa: true, verificado: true, cobros_activos: true,
      es_prueba: true,
    });
    const { data } = await admin
      .from("artistas")
      .select("comision, es_founder, founder_hasta, tienda_activa, verificado, cobros_activos, es_prueba")
      .eq("user_id", N.userId)
      .maybeSingle();
    const { data: ajuste } = await admin.from("app_settings").select("value").eq("key", "comision_default").maybeSingle();
    const porDefecto = Number(ajuste?.value ?? 10);
    const neutralizado = data && Number(data.comision) === porDefecto && !data.es_founder && data.founder_hasta === null
      && !data.tienda_activa && !data.verificado && !data.cobros_activos && !data.es_prueba;
    check(
      `(d) Artista se da de alta como founder/0%/verificado → valores por defecto (comision = comision_default = ${porDefecto})`,
      !error && neutralizado,
      error ? fmt(error) : `quedó: ${JSON.stringify(data)}`
    );
  }

  console.log("\n── Fase 1 · datos bancarios ──");
  {
    const { data, error } = await A.cliente.rpc("datos_bancarios", { p_artista_id: A.artistaId });
    check("(e) Artista lee sus datos bancarios", !error && data?.[0]?.rut === "11.111.111-1", fmt(error));
  }
  {
    const { data, error } = await A.cliente.rpc("datos_bancarios", { p_artista_id: B.artistaId });
    check("(f) Artista lee los datos bancarios de otro → 0 filas", !error && data?.length === 0, error ? fmt(error) : `${data?.length} filas`);
  }
  {
    const { data, error } = await A.cliente.rpc("datos_bancarios");
    check("(g) Artista sin filtro → solo los suyos", !error && data?.length === 1 && data[0].artista_id === A.artistaId, error ? fmt(error) : `${data?.length} filas`);
  }
  {
    const { data, error } = await ADMIN.cliente.rpc("datos_bancarios");
    const ids = new Set((data ?? []).map((d) => d.artista_id));
    check("(h) Admin lee los datos bancarios de todos", !error && ids.has(A.artistaId) && ids.has(B.artistaId), fmt(error));
  }
  {
    const { error } = await anon.rpc("datos_bancarios");
    check("(i) Anónimo llama datos_bancarios → rechazado", !!error, fmt(error));
  }

  console.log("\n── Fase 1 · funciones solo para el servidor ──");
  {
    const cupon = await crearCupon("burn", { artista_id: A.artistaId });
    const r1 = await anon.rpc("incrementar_usos_cupon", { cupon_id: cupon.id });
    const r2 = await A.cliente.rpc("incrementar_usos_cupon", { cupon_id: cupon.id });
    const usos = await usosDe(cupon.id);
    check("(j) Anónimo/artista ejecutan incrementar_usos_cupon → rechazado", !!r1.error && !!r2.error && usos === 0, `anon: ${fmt(r1.error)} · artista: ${fmt(r2.error)} · usos=${usos}`);
  }
  {
    const grupo = crypto.randomUUID();
    const r1 = await anon.rpc("confirmar_pago", { p_grupo_id: grupo, p_payment_id: pagoId(), p_monto: 1 });
    const r2 = await A.cliente.rpc("confirmar_pago", { p_grupo_id: grupo, p_payment_id: pagoId(), p_monto: 1 });
    check("(k) Anónimo/artista ejecutan confirmar_pago → rechazado", !!r1.error && !!r2.error, `anon: ${fmt(r1.error)} · artista: ${fmt(r2.error)}`);
  }
  {
    const { data, error } = await anon.from("pagos_mp").select("*");
    check("(l) Anónimo lee pagos_mp → nada", !!error || data?.length === 0, error ? fmt(error) : `${data?.length} filas`);
  }

  console.log("\n── Fase 1 · confirmar_pago ──");
  const P = await crearProducto(A.artistaId, "fisico", { stock: 10 });
  const D = await crearProducto(A.artistaId, "digital", { tipo: "digital", stock: 0 });
  const C = await crearCupon("pago", { artista_id: A.artistaId });

  const g1 = await crearGrupo(A.artistaId, [
    { producto: P, cantidad: 2, cupon: C.id },
    { producto: P, cantidad: 1, cupon: C.id },
    { producto: D, cantidad: 1, cupon: C.id },
  ]);
  const pago1 = pagoId();
  {
    const { data, error } = await confirmar(g1, pago1);
    const [stockP, stockD, usos, estados] = [await stockDe(P), await stockDe(D), await usosDe(C.id), await estadosDe(g1)];
    check(
      "(m) Primer aviso → 'procesado': órdenes pagadas, stock físico −3, digital intacto, cupón +1",
      !error && data === "procesado" && stockP === 7 && stockD === 0 && usos === 1 && estados.every((e) => e === "pagado"),
      error ? fmt(error) : `resultado=${data} stockP=${stockP} stockD=${stockD} usos=${usos} estados=${estados}`
    );
  }
  {
    const { data, error } = await confirmar(g1, pago1);
    const [stockP, usos] = [await stockDe(P), await usosDe(C.id)];
    check("(n) Mismo aviso repetido → 'duplicado', sin tocar stock ni cupón", !error && data === "duplicado" && stockP === 7 && usos === 1, error ? fmt(error) : `resultado=${data} stockP=${stockP} usos=${usos}`);
  }
  {
    const { data, error } = await confirmar(g1, pagoId());
    const stockP = await stockDe(P);
    check("(o) Otro pago para un grupo ya pagado → 'sin_ordenes', sin tocar stock", !error && data === "sin_ordenes" && stockP === 7, error ? fmt(error) : `resultado=${data} stockP=${stockP}`);
  }
  {
    const g2 = await crearGrupo(A.artistaId, [{ producto: P, cantidad: 1 }]);
    const pago2 = pagoId();
    const respuestas = await Promise.all(Array.from({ length: 5 }, () => confirmar(g2, pago2)));
    const datos = respuestas.map((r) => r.data ?? fmt(r.error));
    const procesados = datos.filter((d) => d === "procesado").length;
    const stockP = await stockDe(P);
    check("(p) 5 avisos simultáneos del mismo pago → un solo 'procesado', stock −1", procesados === 1 && stockP === 6, `respuestas=${datos.join(",")} stockP=${stockP}`);
  }
  {
    const g3 = await crearGrupo(A.artistaId, [{ producto: P, cantidad: 1 }], "cancelado");
    const { data, error } = await confirmar(g3, pagoId());
    const [stockP, estados] = [await stockDe(P), await estadosDe(g3)];
    check("(q) Grupo cancelado por un rechazo y luego pagado → 'procesado' y pagado", !error && data === "procesado" && stockP === 5 && estados.every((e) => e === "pagado"), error ? fmt(error) : `resultado=${data} stockP=${stockP} estados=${estados}`);
  }
  {
    const { data, error } = await confirmar(crypto.randomUUID(), pagoId());
    check("(r) Pago de un grupo inexistente → 'sin_ordenes'", !error && data === "sin_ordenes", error ? fmt(error) : `resultado=${data}`);
  }
  {
    const P2 = await crearProducto(A.artistaId, "poco-stock", { stock: 1 });
    const g4 = await crearGrupo(A.artistaId, [{ producto: P2, cantidad: 3 }]);
    await confirmar(g4, pagoId());
    const stock = await stockDe(P2);
    check("(s) Stock nunca queda negativo", stock === 0, `stock=${stock}`);
  }
}

// ── Fase 2 ───────────────────────────────────────────────────────────────────

async function fase2(A, B, ADMIN) {
  console.log("\n── Fase 2 · lectura de artistas por columna ──");

  for (const col of ["rut", "banco", "cuenta_bancaria", "tipo_cuenta", "user_id", "comision", "es_founder", "auth_provider"]) {
    const { error } = await anon.from("artistas").select(`id, ${col}`).limit(1);
    check(`(t) Anónimo lee artistas.${col} → rechazado`, error?.code === "42501", fmt(error));
  }
  {
    const { error } = await anon.from("artistas").select("*").limit(1);
    check("(u) Anónimo hace select(*) de artistas → rechazado", error?.code === "42501", fmt(error));
  }
  {
    const { data, error } = await anon
      .from("artistas")
      .select("id, nombre, slug, ciudad, region, color_acento, foto_url, bio, bio_completa, redes, verificado, generos, seo_titulo, seo_descripcion, es_editorial, tienda_activa, cobros_activos, created_at")
      .limit(3);
    check("(v) Anónimo lee las columnas públicas (ficha del artista) → permitido", !error && data?.length > 0, fmt(error));
  }
  {
    const { error } = await anon
      .from("publicaciones")
      .select("id, slug, artistas!inner(nombre, slug, foto_url, es_editorial, verificado)")
      .limit(1);
    check("(w) Anónimo: noticias con el artista embebido → permitido", !error, fmt(error));
  }
  {
    const { error } = await A.cliente.from("artistas").select("id, rut").eq("id", B.artistaId);
    check("(x) Artista lee el rut de otro artista → rechazado", error?.code === "42501", fmt(error));
  }
  {
    const { data, error } = await A.cliente.from("artistas").select("id, nombre").eq("user_id", A.userId).single();
    check("(y) Panel: artista se busca por user_id → permitido", !error && data?.id === A.artistaId, fmt(error));
  }
  {
    // Las políticas de productos consultan artistas por debajo: tienen que
    // seguir funcionando con los grants por columna.
    const { error } = await A.cliente.from("productos").insert({
      artista_id: A.artistaId, nombre: `${PREFIJO}-desde-panel`, precio: 5000, estado: "en_revision", imagenes: [],
    });
    check("(z) Artista sube un producto (política con subconsulta a artistas) → permitido", !error, fmt(error));
  }

  console.log("\n── Fase 2 · consultas de cada pantalla, con su rol ──");
  // Copia literal de los select() que hacen las pantallas sobre artistas (o
  // que lo embeben). Si una deja de calzar con los grants por columna, falla
  // acá y no en producción. Al tocar un select en la app, actualizarlo aquí.
  const PERFIL = "id, user_id, nombre, slug, foto_url, bio, bio_completa, ciudad, region, color_acento, redes, generos, seo_titulo, seo_descripcion";
  const pantallas = [
    // Públicas (anon)
    ["anon", "ficha del artista (ArtistaClient)", (c) => c.from("artistas").select("id, nombre, slug, ciudad, region, color_acento, foto_url, bio, bio_completa, redes, verificado, generos").eq("slug", `${PREFIJO}-a`).single()],
    ["anon", "metadata del artista (lib/artistas)", (c) => c.from("artistas").select("id, nombre, slug, bio, foto_url, seo_titulo, seo_descripcion, es_editorial, es_prueba").eq("slug", `${PREFIJO}-a`).maybeSingle()],
    ["anon", "ficha de producto (ProductoClient)", (c) => c.from("productos").select("*, artistas(id, nombre, slug, ciudad, foto_url, color_acento, verificado, generos), categorias(id, nombre, slug)").limit(1)],
    ["anon", "metadata de producto (lib/productos)", (c) => c.from("productos").select("id, nombre, descripcion, imagenes, precio, artistas(nombre, slug, es_prueba)").limit(1)],
    ["anon", "sitemap", (c) => c.from("artistas").select("slug, created_at").eq("es_editorial", false).eq("es_prueba", false).or("tienda_activa.eq.true,verificado.eq.true").limit(1)],
    ["anon", "sitemap (noticias)", (c) => c.from("publicaciones").select("slug, fecha_publicacion, updated_at, artistas!inner(es_prueba)").eq("estado", "publicada").eq("tipo", "noticia").eq("artistas.es_prueba", false).limit(1)],
    ["anon", "/tienda", (c) => c.from("productos").select("id, nombre, precio, imagenes, tipo, stock, artista_id, categoria_id, artistas!inner (id, nombre, slug, ciudad, region, color_acento, verificado), categorias (id, nombre, slug, padre_id)").eq("estado", "aprobado").eq("artistas.es_prueba", false).limit(1)],
    ["anon", "noticias (lib/noticias, listado)", (c) => c.from("publicaciones").select("id, titular, bajada, cuerpo, imagen_url, slug, categoria, fecha_publicacion, artistas!inner(nombre, slug, foto_url, es_editorial, verificado, es_prueba)").eq("estado", "publicada").eq("visibilidad", "publica").eq("tipo", "noticia").eq("artistas.es_prueba", false).limit(1)],
    ["anon", "noticia (lib/noticias, detalle)", (c) => c.from("publicaciones").select("id, titular, bajada, cuerpo, imagen_url, slug, categoria, fecha_publicacion, artistas(nombre, slug, foto_url, es_editorial, verificado, es_prueba)").limit(1)],
    ["anon", "revalidar noticias", (c) => c.from("publicaciones").select("slug, artistas(slug, es_editorial)").limit(1)],
    // Panel (artista)
    ["artista", "PanelShell: ¿existe mi fila?", (c) => c.from("artistas").select("id").eq("user_id", A.userId).maybeSingle()],
    ["artista", "panel: mi id y nombre", (c) => c.from("artistas").select("id, nombre, slug").eq("user_id", A.userId).single()],
    ["artista", "/panel/perfil", (c) => c.from("artistas").select(PERFIL).eq("user_id", A.userId).maybeSingle()],
    ["artista", "/panel/perfil: ¿slug ocupado?", (c) => c.from("artistas").select("id").eq("slug", "slug-que-no-existe").neq("id", A.artistaId).maybeSingle()],
    ["artista", "/panel/liquidaciones: datos bancarios", (c) => c.rpc("datos_bancarios", { p_artista_id: A.artistaId })],
    // Admin
    ["admin", "/admin (cuenta de tiendas)", (c) => c.from("artistas").select("id", { count: "exact", head: true }).eq("tienda_activa", true).eq("es_prueba", false)],
    ["admin", "/admin (ventas)", (c) => c.from("ordenes").select("artista_id, monto_artista, comision_monto, precio_unitario, artistas!inner(nombre)").eq("estado", "pagado").eq("artistas.es_prueba", false).limit(1)],
    ["admin", "/admin (productos aprobados)", (c) => c.from("productos").select("id, artistas!inner(es_prueba)", { count: "exact", head: true }).eq("estado", "aprobado").eq("artistas.es_prueba", false)],
    ["admin", "/admin (órdenes del mes)", (c) => c.from("ordenes").select("id, artistas!inner(es_prueba)", { count: "exact", head: true }).gte("created_at", "2026-01-01").eq("artistas.es_prueba", false)],
    ["admin", "/admin/artistas", (c) => c.from("artistas").select("id, nombre, slug, foto_url, bio, ciudad, region, comision, es_founder, founder_hasta, tienda_activa, verificado, es_prueba").order("nombre").limit(5)],
    ["admin", "/admin/artistas/[id]/editar", (c) => c.from("artistas").select(PERFIL).eq("id", A.artistaId).maybeSingle()],
    ["admin", "/admin/liquidaciones (artistas)", (c) => c.from("artistas").select("id, nombre, foto_url, ordenes(id, monto_artista, estado, liquidado, created_at)").order("nombre").limit(5)],
    ["admin", "/admin/liquidaciones (bancos)", (c) => c.rpc("datos_bancarios")],
    ["admin", "/admin/liquidaciones (historial)", (c) => c.from("liquidaciones").select("*, artistas(nombre)").limit(1)],
    ["admin", "/admin/ordenes", (c) => c.from("ordenes").select("*, artistas(nombre), productos(nombre)").limit(1)],
    ["admin", "/admin/cupones", (c) => c.from("cupones").select("*, artistas(nombre)").limit(1)],
    ["admin", "/admin/productos", (c) => c.from("productos").select("id, nombre, precio, imagenes, tipo, estado, descripcion, zonas_envio, artista_id, artistas(nombre, slug), categorias(nombre)").limit(1)],
    ["admin", "/admin/publicaciones", (c) => c.from("publicaciones").select("*, artistas(nombre, es_editorial)").limit(1)],
    ["admin", "/admin/publicaciones/nueva", (c) => c.from("artistas").select("id, nombre").eq("slug", "muzikchile").eq("es_editorial", true).maybeSingle()],
  ];
  const clientes = { anon, artista: A.cliente, admin: ADMIN.cliente };
  for (const [rol, nombre, consulta] of pantallas) {
    const { error } = await consulta(clientes[rol]);
    check(`(cc) [${rol}] ${nombre}`, !error, fmt(error));
  }
  {
    // Guardar el perfil escribe columnas que el artista ya no puede leer:
    // UPDATE sigue permitido, y lo nuevo se ve por la RPC.
    const { error } = await A.cliente
      .from("artistas")
      .update({ user_id: A.userId, nombre: "RLS Test a", banco: "Banco Nuevo", cuenta_bancaria: "999", tipo_cuenta: "Cuenta RUT", rut: "11.111.111-1" })
      .eq("id", A.artistaId);
    const { data } = await A.cliente.rpc("datos_bancarios", { p_artista_id: A.artistaId });
    check("(dd) /panel/perfil guarda sus datos bancarios", !error && data?.[0]?.banco === "Banco Nuevo", error ? fmt(error) : JSON.stringify(data?.[0]));
  }

  console.log("\n── Fase 2 · artistas de prueba ──");
  {
    // A queda normal y B pasa a ser de prueba, cada uno con un producto aprobado.
    const visible = await crearProducto(A.artistaId, "visible");
    const oculto  = await crearProducto(B.artistaId, "oculto");
    await admin.from("artistas").update({ es_prueba: true, tienda_activa: true }).eq("id", B.artistaId);
    await admin.from("artistas").update({ tienda_activa: true }).eq("id", A.artistaId);

    const { data: tienda, error } = await anon
      .from("productos")
      .select("id, artistas!inner(id)")
      .eq("estado", "aprobado")
      .eq("artistas.es_prueba", false)
      .in("id", [visible, oculto]);
    const ids = (tienda ?? []).map((p) => p.id);
    check("(ee1) /tienda: el producto de un artista de prueba no aparece; el de uno normal sí",
      !error && ids.includes(visible) && !ids.includes(oculto), error ? fmt(error) : `ids=${JSON.stringify(ids)}`);

    const { data: directo } = await anon.from("productos").select("id, artistas(es_prueba)").eq("id", oculto).maybeSingle();
    check("(ee2) Su producto sigue abriendo por URL directa y trae es_prueba (para el noindex)",
      directo?.id === oculto && directo.artistas?.es_prueba === true, JSON.stringify(directo));

    const { data: fichas } = await anon
      .from("artistas")
      .select("id")
      .eq("es_editorial", false)
      .eq("es_prueba", false)
      .or("tienda_activa.eq.true,verificado.eq.true")
      .in("id", [A.artistaId, B.artistaId]);
    const enSitemap = (fichas ?? []).map((a) => a.id);
    check("(ee3) Sitemap: la ficha de un artista de prueba no entra; la de uno normal sí",
      enSitemap.includes(A.artistaId) && !enSitemap.includes(B.artistaId), `ids=${JSON.stringify(enSitemap)}`);

    await admin.from("artistas").update({ es_prueba: false, tienda_activa: false }).in("id", [A.artistaId, B.artistaId]);
  }

  console.log("\n── Fase 2 · cupones ──");
  const propio = await crearCupon("propio", { artista_id: A.artistaId });
  await crearCupon("global", { artista_id: null });
  {
    const { data, error } = await anon.from("cupones").select("id, codigo");
    check("(aa) Anónimo lista cupones → nada", !error && data?.length === 0, error ? fmt(error) : `${data?.length} filas`);
  }
  {
    const { data, error } = await A.cliente.from("cupones").select("id, artista_id");
    const ajenos = (data ?? []).filter((c) => c.artista_id !== A.artistaId);
    check("(bb) Artista ve sus cupones y no los de otros", !error && data?.some((c) => c.id === propio.id) && ajenos.length === 0, error ? fmt(error) : `ajenos=${ajenos.length}`);
  }
}

// ── API ──────────────────────────────────────────────────────────────────────

async function post(ruta, body) {
  const res = await fetch(`${API}${ruta}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data };
}

async function api(A, B) {
  console.log(`\n── API · ${API} ──`);
  // Independiente de lo que haya pasado en la fase 1: A cobra 10% y no es founder.
  await admin.from("artistas").update({ comision: 10, es_founder: false }).eq("id", A.artistaId);
  const P  = await crearProducto(A.artistaId, "api", { stock: 10 });
  const P3 = await crearProducto(A.artistaId, "api-3", { stock: 3 });
  const R  = await crearProducto(A.artistaId, "api-revision", { estado: "en_revision" });
  const cA = await crearCupon("api-a", { artista_id: A.artistaId, valor: 10 });
  const cB = await crearCupon("api-b", { artista_id: B.artistaId, valor: 10 });
  const cG = await crearCupon("api-g", { artista_id: null, tipo_descuento: "fijo", valor: 3000 });
  const cVencido = await crearCupon("api-vencido", { artista_id: null, expira_at: new Date(Date.now() - 86400000).toISOString() });
  const cAgotado = await crearCupon("api-agotado", { artista_id: null, usos_maximos: 1, usos_actuales: 1 });
  const cInactivo = await crearCupon("api-inactivo", { artista_id: null, activo: false });

  {
    const r = await post("/api/checkout/cotizar", { items: [{ id: P, cantidad: 2, precio: 1, nombre: "hackeado" }] });
    check("(api-1) Precio adulterado en el body → se cobra el de la base", r.status === 200 && r.data?.total === 20000, `status=${r.status} total=${r.data?.total}`);
  }
  {
    const r = await post("/api/checkout/cotizar", { items: [{ id: P, cantidad: 2 }], cupon_codigo: cA.codigo.toLowerCase() });
    check("(api-2) Cupón del artista, 10% → 18.000", r.status === 200 && r.data?.descuento === 2000 && r.data?.total === 18000, `status=${r.status} ${JSON.stringify(r.data)}`);
  }
  {
    const r = await post("/api/checkout/cotizar", { items: [{ id: P, cantidad: 2 }], cupon_codigo: cG.codigo });
    check("(api-3) Cupón global de $3.000 → 17.000", r.status === 200 && r.data?.total === 17000, `status=${r.status} ${JSON.stringify(r.data)}`);
  }
  for (const [caso, cupon] of [["de otro artista", cB], ["vencido", cVencido], ["agotado", cAgotado], ["inactivo", cInactivo], ["inexistente", { codigo: "NO-EXISTE-XYZ" }]]) {
    const r = await post("/api/checkout/cotizar", { items: [{ id: P, cantidad: 1 }], cupon_codigo: cupon.codigo });
    check(`(api-4) Cupón ${caso} → 422`, r.status === 422 && r.data?.campo === "cupon", `status=${r.status} ${r.data?.error}`);
  }
  {
    const r = await post("/api/checkout/cotizar", { items: [{ id: P3, cantidad: 4 }] });
    check("(api-5) Más unidades que el stock → 422", r.status === 422, `status=${r.status} ${r.data?.error}`);
  }
  {
    const r = await post("/api/checkout/cotizar", { items: [{ id: R, cantidad: 1 }] });
    check("(api-6) Producto en revisión → 422", r.status === 422, `status=${r.status} ${r.data?.error}`);
  }
  for (const cantidad of [0, -1, 1.5, "2"]) {
    const r = await post("/api/checkout/cotizar", { items: [{ id: P, cantidad }] });
    check(`(api-7) Cantidad inválida (${JSON.stringify(cantidad)}) → 400`, r.status === 400, `status=${r.status}`);
  }
  {
    // Founder vencido ayer: tiene que cobrar su comisión (10%), no 0%.
    await admin.from("artistas").update({ es_founder: true, founder_hasta: "2020-01-01" }).eq("id", A.artistaId);
    const r = await post("/api/mercadopago/crear-preferencia", {
      items: [{ id: P, cantidad: 2, precio: 1 }],
      comprador: { nombre: "RLS Test", email: `${PREFIJO}-comprador@example.com` },
      cupon_codigo: cA.codigo,
    });
    const grupo = r.data?.external_reference;
    const { data: ordenes } = grupo
      ? await admin.from("ordenes").select("precio_unitario, cantidad, monto_artista, comision_monto, comision_porcentaje, cupon_id").eq("grupo_id", grupo)
      : { data: [] };
    const o = ordenes?.[0];
    const ok = r.status === 200 && !!r.data?.init_point && ordenes?.length === 1
      && o.precio_unitario === 10000 && o.monto_artista + o.comision_monto === 18000
      && o.comision_monto === 1800 && Number(o.comision_porcentaje) === 10 && o.cupon_id === cA.id;
    check("(api-8) crear-preferencia: precio de la base, cupón y comisión sobre lo cobrado (founder vencido → 10% de 18.000)", ok, `status=${r.status} ${r.data?.error ?? ""} orden=${JSON.stringify(o)}`);
  }
  for (const [caso, body] of [
    ["id inexistente", { type: "payment", data: { id: "1" } }],
    ["id no numérico", { type: "payment", data: { id: "../users/me" } }],
    ["merchant_order", { topic: "merchant_order", id: "123" }],
  ]) {
    const r = await post("/api/mercadopago/webhook", body);
    check(`(api-9) Webhook con ${caso} → 200 sin efectos`, r.status === 200, `status=${r.status}`);
  }
  {
    // Pago real rechazado del 2026-07-01 (cc_rejected_high_risk): ejercita la
    // consulta a la API de MP con el token real. El grupo ya está cancelado.
    const r = await post("/api/mercadopago/webhook", { type: "payment", data: { id: "166576770280" } });
    const { data } = await admin.from("ordenes").select("estado").eq("mercadopago_id", "166576770280");
    const { data: pagos } = await admin.from("pagos_mp").select("mp_payment_id").eq("mp_payment_id", "166576770280");
    check("(api-10) Webhook con un pago real rechazado → 200, no se registra como pagado", r.status === 200 && (pagos ?? []).length === 0 && (data ?? []).every((o) => o.estado !== "pagado"), `status=${r.status}`);
  }
}

// ── Marketplace en piloto (mk) ───────────────────────────────────────────────

/** Cifra con una llave distinta de MP_TOKENS_KEY (como un token conectado desde otro entorno). */
function cifrarConOtraLlave(texto) {
  const llave = process.env.MP_TOKENS_KEY;
  process.env.MP_TOKENS_KEY = Buffer.alloc(32, 7).toString("base64");
  try { return cifrar(texto); } finally { process.env.MP_TOKENS_KEY = llave; }
}

const get = async (ruta) => {
  const res = await fetch(`${API}${ruta}`);
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data };
};

async function marketplace(A, B, ADMIN) {
  console.log(`\n── (mk) Marketplace en piloto · ${API} ──`);

  // Base de datos, sin la API.
  {
    const g = await crearGrupo(A.artistaId, [{ producto: await crearProducto(A.artistaId, "mk-default"), cantidad: 1 }]);
    const { data } = await admin.from("ordenes").select("cobro, mp_collector_id").eq("grupo_id", g);
    const { error } = await admin.from("ordenes").update({ cobro: "otro" }).eq("grupo_id", g);
    check("(mk-1) ordenes.cobro: por defecto 'centralizado' y no acepta otro valor (CHECK)",
      data?.every((o) => o.cobro === "centralizado" && o.mp_collector_id === null) && error?.code === "23514",
      `filas=${JSON.stringify(data)} · ${fmt(error)}`);
  }

  const { data: fila } = await admin.from("app_settings").select("value").eq("key", "marketplace_piloto").maybeSingle();
  const pilotoOriginal = fila?.value ?? null;
  {
    let lista = null;
    try { lista = JSON.parse(pilotoOriginal ?? "null"); } catch { /* queda null */ }
    check("(mk-2) app_settings.marketplace_piloto existe y es una lista JSON de ids", Array.isArray(lista), `valor=${pilotoOriginal}`);
  }

  // Escenario: A en el piloto con una conexión (tokens falsos, cifrados con la
  // llave local); B fuera del piloto. Los dos cobran 10%.
  await admin.from("artistas").update({ comision: 10, es_founder: false, founder_hasta: null }).in("id", [A.artistaId, B.artistaId]);
  const PA = await crearProducto(A.artistaId, "mk-a", { stock: 10 });
  const PB = await crearProducto(B.artistaId, "mk-b", { stock: 10 });
  const cA = await crearCupon("mk-a", { artista_id: A.artistaId, valor: 10 });
  const cG = await crearCupon("mk-g", { artista_id: null, tipo_descuento: "fijo", valor: 3000 });
  const mpUserA = 9_000_000_000 + Math.floor(Math.random() * 999_999_999);
  const conectarA = () => admin.from("mp_conexiones").insert({
    artista_id: A.artistaId,
    mp_user_id: mpUserA,
    nickname: "RLSTEST_VENDEDOR",
    access_token_cifrado: cifrar("APP_USR-falso-access"),
    refresh_token_cifrado: cifrar("TG-falso-refresh"),
    live_mode: false,
    expires_at: new Date(Date.now() + 180 * 86400000).toISOString(),
  });

  try {
    {
      // Con el piloto como está (sin A): A cobra centralizado.
      const r = await post("/api/checkout/cotizar", { items: [{ id: PA, cantidad: 1 }] });
      check("(mk-3) Artista fuera del piloto → cotiza 'centralizado'", r.status === 200 && r.data?.cobro === "centralizado", `status=${r.status} cobro=${r.data?.cobro}`);
    }

    const { error: conErr } = await conectarA();
    if (conErr) throw new Error(`Conexión de prueba: ${conErr.message}`);
    const piloto = JSON.parse(pilotoOriginal ?? "[]");
    await admin.from("app_settings").update({ value: JSON.stringify([...piloto, A.artistaId]) }).eq("key", "marketplace_piloto");

    {
      const r = await post("/api/checkout/cotizar", { items: [{ id: PA, cantidad: 2 }] });
      check("(mk-4) Artista en el piloto → cotiza 'marketplace' con el mismo total", r.status === 200 && r.data?.cobro === "marketplace" && r.data?.total === 20000, `status=${r.status} ${JSON.stringify(r.data)}`);
    }
    {
      const r = await post("/api/checkout/cotizar", { items: [{ id: PB, cantidad: 1 }] });
      check("(mk-5) El piloto no se extiende a otro artista → B sigue 'centralizado'", r.status === 200 && r.data?.cobro === "centralizado", `status=${r.status} cobro=${r.data?.cobro}`);
    }
    {
      const r = await post("/api/checkout/cotizar", { items: [{ id: PA, cantidad: 1 }, { id: PB, cantidad: 1 }] });
      check("(mk-6) Carrito con A (piloto) y B → 422 'pedido aparte'", r.status === 422 && /pedido aparte/.test(r.data?.error ?? ""), `status=${r.status} ${r.data?.error}`);
    }
    {
      const r = await post("/api/checkout/cotizar", { items: [{ id: PA, cantidad: 1 }], cupon_codigo: cG.codigo });
      check("(mk-7) Cupón global en un carrito marketplace → no aplica (422 del cupón)", r.status === 422 && r.data?.campo === "cupon", `status=${r.status} ${r.data?.error}`);
    }
    {
      const r = await post("/api/checkout/cotizar", { items: [{ id: PA, cantidad: 2 }], cupon_codigo: cA.codigo });
      check("(mk-8) Cupón del propio artista en marketplace → aplica (18.000)", r.status === 200 && r.data?.total === 18000, `status=${r.status} ${JSON.stringify(r.data)}`);
    }
    {
      const r = await post("/api/checkout/cotizar", { items: [{ id: PB, cantidad: 2 }], cupon_codigo: cG.codigo });
      check("(mk-9) Cupón global en un carrito centralizado → sigue aplicando (17.000)", r.status === 200 && r.data?.total === 17000, `status=${r.status} ${JSON.stringify(r.data)}`);
    }
    {
      // Token del artista falso: MP lo rechaza. Lo que importa es que NO se
      // cobre con el token de MuzikChile (eso daría 200) y que no queden órdenes.
      const r = await post("/api/mercadopago/crear-preferencia", {
        items: [{ id: PA, cantidad: 1 }],
        comprador: { nombre: "RLS Test", email: `${PREFIJO}-comprador@example.com` },
      });
      const { data: ords } = await admin.from("ordenes").select("id").eq("producto_id", PA);
      check("(mk-10) crear-preferencia en marketplace usa el token del artista (falso → MP lo rechaza, sin órdenes)",
        r.status !== 200 && (ords ?? []).length === 0, `status=${r.status} ${r.data?.error ?? ""} órdenes=${ords?.length}`);
    }
    {
      // Conexión cifrada con otra llave (la de un preview, por ejemplo): el
      // artista no puede cobrar acá, y tiene que ser 422, no un 500.
      const { error: e1 } = await admin.from("mp_conexiones").update({
        access_token_cifrado: cifrarConOtraLlave("APP_USR-falso-access"),
      }).eq("artista_id", A.artistaId);
      const r = await post("/api/mercadopago/crear-preferencia", {
        items: [{ id: PA, cantidad: 1 }],
        comprador: { nombre: "RLS Test", email: `${PREFIJO}-comprador@example.com` },
      });
      const { data: ords } = await admin.from("ordenes").select("id").eq("producto_id", PA);
      check("(mk-18) Token cifrado con otra MP_TOKENS_KEY → crear-preferencia 422 'no puede recibir pagos', sin órdenes",
        !e1 && r.status === 422 && /no puede recibir pagos/.test(r.data?.error ?? "") && (ords ?? []).length === 0,
        `status=${r.status} ${r.data?.error ?? ""} órdenes=${ords?.length}`);
      await admin.from("mp_conexiones").update({ access_token_cifrado: cifrar("APP_USR-falso-access") }).eq("artista_id", A.artistaId);
    }
    {
      // Un grupo marketplace como lo dejaría crear-preferencia.
      const g = await crearGrupo(A.artistaId, [{ producto: PA, cantidad: 1 }]);
      await admin.from("ordenes").update({ cobro: "marketplace", mp_collector_id: mpUserA }).eq("grupo_id", g);
      const res = await fetch(`${API}/api/mercadopago/webhook?grupo=${g}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "payment", data: { id: "123456789" } }),
      });
      const [estados, { data: pagos }] = [await estadosDe(g), await admin.from("pagos_mp").select("mp_payment_id").eq("grupo_id", g)];
      check("(mk-11) Webhook ?grupo= marketplace con el token (falso) del artista → 200 sin confirmar nada",
        res.status === 200 && estados.every((e) => e === "pendiente") && (pagos ?? []).length === 0, `status=${res.status} estados=${estados}`);

      const e1 = await get(`/api/checkout/estado?ref=${g}`);
      const e2 = await get(`/api/checkout/estado?ref=${crypto.randomUUID()}`);
      const e3 = await get("/api/checkout/estado?ref=no-es-uuid");
      check("(mk-12) /api/checkout/estado: 'pendiente' para el grupo, null si no existe, 400 si no es UUID",
        e1.data?.estado === "pendiente" && e2.status === 200 && e2.data?.estado === null && e3.status === 400,
        `grupo=${JSON.stringify(e1.data)} inexistente=${JSON.stringify(e2.data)} inválido=${e3.status}`);

      // Liquidaciones del admin: la copia literal de su select, con el filtro.
      await admin.from("ordenes").update({ estado: "pagado" }).eq("grupo_id", g);
      const gc = await crearGrupo(A.artistaId, [{ producto: PA, cantidad: 1 }], "pagado");
      const { data: liq, error } = await ADMIN.cliente
        .from("artistas")
        .select("id, nombre, foto_url, ordenes(id, monto_artista, estado, liquidado, created_at)")
        .eq("ordenes.cobro", "centralizado")
        .eq("id", A.artistaId)
        .single();
      const grupos = new Set(((await admin.from("ordenes").select("id, grupo_id").in("id", (liq?.ordenes ?? []).map((o) => o.id))).data ?? []).map((o) => o.grupo_id));
      check("(mk-13) /admin/liquidaciones: la orden marketplace no entra en el saldo; la centralizada sí",
        !error && grupos.has(gc) && !grupos.has(g), error ? fmt(error) : `grupos=${JSON.stringify([...grupos])}`);

      // Sin conexión, el webhook no puede consultar el pago: pide reintento.
      await admin.from("mp_conexiones").delete().eq("artista_id", A.artistaId);
      await admin.from("ordenes").update({ estado: "pendiente" }).eq("grupo_id", g);
      const res2 = await fetch(`${API}/api/mercadopago/webhook?grupo=${g}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "payment", data: { id: "123456789" } }),
      });
      check("(mk-14) Webhook ?grupo= marketplace con el artista desconectado → 500 (MP reintenta), nada confirmado",
        res2.status === 500 && (await estadosDe(g)).every((e) => e === "pendiente"), `status=${res2.status}`);
    }
    {
      // Desconectado (cobros_activos = false por el trigger): "Pronto disponible".
      const r = await post("/api/checkout/cotizar", { items: [{ id: PA, cantidad: 1 }] });
      check("(mk-15) Artista del piloto sin cuenta conectada → 422 'disponibles pronto'", r.status === 422 && /disponibles pronto/.test(r.data?.error ?? ""), `status=${r.status} ${r.data?.error}`);
    }
    {
      // La ficha se pinta en el cliente: lo que se verifica es la prop que le
      // pasa el servidor (va serializada en el HTML, con comillas escapadas).
      const html = await fetch(`${API}/producto/${PA}`).then((res) => res.text());
      const prop = html.match(/directo\\?":(true|false),\\?"disponible\\?":(true|false)/);
      check("(mk-16) Ficha del producto del piloto sin conexión → cobro { directo: true, disponible: false } ('Pronto disponible')",
        prop?.[1] === "true" && prop?.[2] === "false", prop ? prop[0] : "la prop cobro no está en el HTML");
    }
  } finally {
    // El piloto vuelve a como estaba, pase lo que pase.
    await admin.from("app_settings").update({ value: pilotoOriginal ?? "[]" }).eq("key", "marketplace_piloto");
    const { data: tras } = await admin.from("app_settings").select("value").eq("key", "marketplace_piloto").maybeSingle();
    check("(mk-17) marketplace_piloto quedó como estaba", tras?.value === (pilotoOriginal ?? "[]"), `antes=${pilotoOriginal} después=${tras?.value}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Verificación · seguridad del cobro");
  console.log(`Proyecto: ${URL}`);
  console.log(`Fases: 1${FASE2 ? " + 2" : ""}${API ? ` + API (${API})` : ""}`);

  try {
    await limpiar(); // restos de una corrida anterior
    const A = await crearArtista("a", { banco: "Banco de Prueba", cuenta_bancaria: "000111", tipo_cuenta: "Cuenta Vista", rut: "11.111.111-1" });
    const B = await crearArtista("b", { banco: "Banco de Prueba", cuenta_bancaria: "000222", tipo_cuenta: "Cuenta Vista", rut: "22.222.222-2" });
    const ADMIN = await crearUsuario("admin", "admin");

    reglaComision();
    await fase1(A, B, ADMIN);
    if (FASE2) await fase2(A, B, ADMIN);
    if (API) await api(A, B);
    if (API) await marketplace(A, B, ADMIN);
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
