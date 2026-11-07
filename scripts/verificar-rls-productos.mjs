/**
 * Verificación end-to-end del RLS de `productos`: el artista no puede aprobarse.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CORRERLO
 *
 *   npm run verificar:rls-productos
 *
 * Lee `.env.pruebas` (no versionado), que apunta a una base que NO es producción:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * La base tiene que tener aplicada la migración
 * 20261107153047_productos_estado_y_rls_artista.
 *
 * Sale con código 0 si todos los casos pasan, 1 si alguno falla.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ ESCRIBE EN LA BASE: crea usuarios, artistas y productos con el prefijo
 * `rlsprod-` y los borra al terminar. Por eso se niega a correr contra
 * producción, sin opción para saltarse el chequeo.
 *
 * La service role key solo monta y limpia el escenario. Las aserciones de RLS
 * se hacen con clientes autenticados o anónimos: esa llave se salta el RLS.
 */

import { createClient } from "@supabase/supabase-js";

const REF_PRODUCCION = "rgskspvuvzwmvmsccoez";

const URL_BASE    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !ANON_KEY || !SERVICE_KEY) {
  console.error("Faltan variables de entorno. Corre con: npm run verificar:rls-productos");
  process.exit(1);
}
if (URL_BASE.includes(REF_PRODUCCION)) {
  console.error("Este script escribe en la base y esa URL es la de producción. No se corre.");
  process.exit(1);
}

const FAMILIA = "rlsprod-";
const PREFIJO = `${FAMILIA}${Date.now()}`;
const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(URL_BASE, SERVICE_KEY, opciones);
const anon  = createClient(URL_BASE, ANON_KEY, opciones);

// ── Reporte ──────────────────────────────────────────────────────────────────

const resultados = [];

function check(caso, ok, detalle) {
  resultados.push({ caso, ok });
  console.log(`  ${ok ? "✓" : "✗"} ${caso}`);
  if (!ok && detalle) console.log(`      ${detalle}`);
}

const esRechazo = (error) => error?.code === "42501";
const fmt = (error) => (error ? `${error.code}: ${error.message}` : "sin error");

// ── Escenario ────────────────────────────────────────────────────────────────

async function crearUsuario(sufijo, rol) {
  const email = `${PREFIJO}-${sufijo}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Usuario ${sufijo}: ${error.message}`);
  const userId = data.user.id;

  // Un trigger de auth.users puede haber puesto ya el rol. Se deja el pedido.
  await admin.from("user_roles").delete().eq("user_id", userId);
  const { error: rolError } = await admin.from("user_roles").insert({ user_id: userId, role: rol });
  if (rolError) throw new Error(`Rol ${sufijo}: ${rolError.message}`);

  let artistaId = null;
  if (rol === "artista") {
    const { data: artista, error: artistaError } = await admin
      .from("artistas")
      .insert({ user_id: userId, nombre: `RLS ${sufijo}`, slug: `${PREFIJO}-${sufijo}` })
      .select("id")
      .single();
    if (artistaError) throw new Error(`Artista ${sufijo}: ${artistaError.message}`);
    artistaId = artista.id;
  }

  const cliente = createClient(URL_BASE, ANON_KEY, opciones);
  const { error: loginError } = await cliente.auth.signInWithPassword({ email, password });
  if (loginError) throw new Error(`Login ${sufijo}: ${loginError.message}`);

  return { cliente, artistaId, userId };
}

let nProducto = 0;
const fila = (artistaId, estado) => ({
  artista_id: artistaId,
  nombre: `${PREFIJO}-${++nProducto}`,
  precio: 10000,
  stock: 5,
  tipo: "fisico",
  imagenes: [],
  estado,
});

/** Siembra con service role, en cualquier estado. */
async function sembrar(artistaId, estado) {
  const { data, error } = await admin.from("productos").insert(fila(artistaId, estado)).select("id").single();
  if (error) throw new Error(`Producto ${estado}: ${error.message}`);
  return data.id;
}

const leer = async (id) =>
  (await admin.from("productos").select("estado, precio").eq("id", id).single()).data;

async function limpiar() {
  await admin.from("productos").delete().like("nombre", `${FAMILIA}%`);
  await admin.from("artistas").delete().like("slug", `${FAMILIA}%`);
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
  console.log("\n── Crear ──");
  for (const [caso, estado] of [["(a1)", "borrador"], ["(a2)", "en_revision"]]) {
    const { error } = await A.cliente.from("productos").insert(fila(A.artistaId, estado));
    check(`${caso} Artista crea un producto en '${estado}' → permitido`, !error, fmt(error));
  }
  for (const [caso, estado] of [["(a3)", "aprobado"], ["(a4)", "rechazado"], ["(a5)", "pausado"]]) {
    const { error } = await A.cliente.from("productos").insert(fila(A.artistaId, estado));
    check(`${caso} Artista crea un producto en '${estado}' → rechazado`, esRechazo(error), fmt(error));
  }
  {
    const { error } = await A.cliente.from("productos").insert(fila(B.artistaId, "borrador"));
    check("(a6) Artista crea un producto a nombre de otro → rechazado", esRechazo(error), fmt(error));
  }

  console.log("\n── Editar ──");
  {
    const id = await sembrar(A.artistaId, "borrador");
    const { error } = await A.cliente.from("productos").update({ precio: 12000 }).eq("id", id);
    const p = await leer(id);
    check("(b1) Edita su borrador y sigue en borrador → permitido", !error && p.estado === "borrador" && Number(p.precio) === 12000, fmt(error));
  }
  {
    const id = await sembrar(A.artistaId, "borrador");
    const { error } = await A.cliente.from("productos").update({ estado: "en_revision" }).eq("id", id);
    check("(b2) Manda su borrador a revisión → permitido", !error && (await leer(id)).estado === "en_revision", fmt(error));
  }
  for (const [caso, desde] of [["(b3)", "borrador"], ["(b4)", "en_revision"], ["(b5)", "rechazado"]]) {
    const id = await sembrar(A.artistaId, desde);
    const { error } = await A.cliente.from("productos").update({ estado: "aprobado" }).eq("id", id);
    check(`${caso} Pasa su producto de '${desde}' a 'aprobado' → rechazado`, esRechazo(error) && (await leer(id)).estado === desde, fmt(error));
  }
  {
    const id = await sembrar(A.artistaId, "aprobado");
    const { error } = await A.cliente.from("productos").update({ precio: 1 }).eq("id", id);
    const p = await leer(id);
    check("(b6) Cambia el precio de un aprobado sin mandarlo a revisión → rechazado", esRechazo(error) && Number(p.precio) === 10000, fmt(error));
  }
  {
    const id = await sembrar(A.artistaId, "aprobado");
    const { error } = await A.cliente.from("productos").update({ precio: 11000, estado: "en_revision" }).eq("id", id);
    const p = await leer(id);
    check("(b7) Edita un aprobado y vuelve a revisión (lo que hace el panel) → permitido", !error && p.estado === "en_revision" && Number(p.precio) === 11000, fmt(error));
  }
  {
    const id = await sembrar(A.artistaId, "rechazado");
    const { error } = await A.cliente.from("productos").update({ estado: "en_revision" }).eq("id", id);
    check("(b8) Reenvía un rechazado a revisión → permitido", !error && (await leer(id)).estado === "en_revision", fmt(error));
  }
  {
    const id = await sembrar(A.artistaId, "pausado");
    const { data, error } = await A.cliente.from("productos").update({ estado: "en_revision" }).eq("id", id).select("id");
    check("(b9) Saca de la pausa un producto de una baja → 0 filas", !error && data.length === 0 && (await leer(id)).estado === "pausado", fmt(error));
  }
  {
    const id = await sembrar(B.artistaId, "borrador");
    const { data, error } = await A.cliente.from("productos").update({ precio: 1 }).eq("id", id).select("id");
    check("(b10) Edita un producto de otro artista → 0 filas", !error && data.length === 0 && Number((await leer(id)).precio) === 10000, fmt(error));
  }
  {
    const id = await sembrar(A.artistaId, "borrador");
    const { error } = await A.cliente.from("productos").update({ artista_id: B.artistaId }).eq("id", id);
    check("(b11) Traspasa su producto a otro artista → rechazado", esRechazo(error), fmt(error));
  }
  {
    const id = await sembrar(A.artistaId, "borrador");
    const { data, error } = await A.cliente.from("productos").delete().eq("id", id).select("id");
    check("(b12) Borra su borrador → permitido", !error && data.length === 1, fmt(error));
  }

  console.log("\n── Admin ──");
  {
    const id = await sembrar(A.artistaId, "en_revision");
    const { error } = await ADMIN.cliente.from("productos").update({ estado: "aprobado" }).eq("id", id);
    check("(c1) Admin aprueba un producto en revisión → permitido", !error && (await leer(id)).estado === "aprobado", fmt(error));
  }
  {
    const id = await sembrar(A.artistaId, "en_revision");
    const { error } = await ADMIN.cliente.from("productos").update({ estado: "rechazado", motivo_rechazo: "prueba" }).eq("id", id);
    check("(c2) Admin rechaza un producto en revisión → permitido", !error && (await leer(id)).estado === "rechazado", fmt(error));
  }

  console.log("\n── Lectura ──");
  {
    const aprobado = await sembrar(A.artistaId, "aprobado");
    const borrador = await sembrar(A.artistaId, "borrador");
    const revision = await sembrar(A.artistaId, "en_revision");
    const ids = [aprobado, borrador, revision];
    const visibles = async (c) => ((await c.from("productos").select("id").in("id", ids)).data ?? []).map((p) => p.id);

    const publico = await visibles(anon);
    check("(d1) Anónimo solo ve el aprobado", publico.length === 1 && publico[0] === aprobado, JSON.stringify(publico));
    const otro = await visibles(B.cliente);
    check("(d2) Otro artista solo ve el aprobado", otro.length === 1 && otro[0] === aprobado, JSON.stringify(otro));
    check("(d3) El dueño ve los tres", (await visibles(A.cliente)).length === 3);
  }
  {
    const { error } = await anon.from("productos").insert(fila(A.artistaId, "borrador"));
    check("(d4) Anónimo crea un producto → rechazado", esRechazo(error), fmt(error));
  }

  console.log("\n── Base ──");
  {
    const { error } = await admin.from("productos").insert(fila(A.artistaId, "inventado"));
    check("(e1) Un estado que no existe → rechazado por el CHECK, aun con service role", error?.code === "23514", fmt(error));
  }
  {
    const { data, error } = await admin.from("productos").insert({ ...fila(A.artistaId, "en_revision"), estado: undefined }).select("estado").single();
    check("(e2) Sin estado explícito → queda 'en_revision'", !error && data.estado === "en_revision", fmt(error));
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
