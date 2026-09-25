/**
 * Verificación end-to-end de las políticas de `storage.objects` en los buckets
 * `artistas` y `productos`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CORRERLO
 *
 *   npm run verificar:rls-storage
 *   (= node --env-file=.env.local scripts/verificar-rls-storage.mjs)
 *
 * Necesita en el entorno:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Sale con código 0 si todos los casos pasan, 1 si alguno falla.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ ESCRIBE EN LA BASE Y EL STORAGE REALES (no hay entorno de test).
 * Crea tres usuarios (artistas A y B, y un admin), dos filas en `artistas` y
 * archivos cuyo nombre empieza con `rlstest-`. Todo se borra en el `finally`,
 * barriendo por ese prefijo. Solo se borran archivos `rlstest-*`: nunca se toca
 * un archivo real aunque viva en la misma carpeta (p. ej. la del editorial).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTÁ HECHO ASÍ
 *
 * Igual que verificar-rls-publicaciones: la service role solo monta, observa y
 * limpia. Las acciones bajo prueba se hacen con clientes autenticados.
 *
 * Diferencia importante con las tablas: en Storage **el error no es fiable**.
 * `remove()` devuelve éxito aunque el RLS no le deje borrar nada, y `update()`
 * sobre un archivo que el RLS esconde puede fallar con un mensaje que no es de
 * RLS. Por eso cada caso se decide mirando el estado real del bucket con la
 * service role (¿el archivo existe?, ¿qué contiene?), no por el error.
 *
 * Rutas (las mismas que usa la app):
 *   artistas/{user_id}/…               foto de perfil del artista
 *   artistas/{artistas.id}/…           foto subida por el admin
 *   productos/{artistas.id}/…          imágenes de productos
 *   productos/{artistas.id}/publicaciones/…
 */

import { createClient } from "@supabase/supabase-js";

const URL          = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON_KEY || !SERVICE_KEY) {
  console.error(
    "Faltan variables de entorno. Corre con:\n" +
    "  node --env-file=.env.local scripts/verificar-rls-storage.mjs"
  );
  process.exit(1);
}

const FAMILIA = "rlstest-";
const PREFIJO = `${FAMILIA}${Date.now()}`;

// Cliente con service role: solo para montar, observar y limpiar.
const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Reporte ──────────────────────────────────────────────────────────────────

const resultados = [];

function check(caso, ok, detalle) {
  resultados.push({ caso, ok, detalle });
  console.log(`  ${ok ? "✓" : "✗"} ${caso}`);
  if (detalle) console.log(`      ${detalle}`);
}

// ── Storage helpers ──────────────────────────────────────────────────────────

const archivo = (texto) => new Blob([texto], { type: "image/jpeg" });

/** Contenido real del archivo según la service role, o null si no existe. */
async function leer(bucket, ruta) {
  const { data, error } = await admin.storage.from(bucket).download(ruta);
  if (error || !data) return null;
  return await data.text();
}

async function sembrar(bucket, ruta, texto) {
  const { error } = await admin.storage
    .from(bucket)
    .upload(ruta, archivo(texto), { upsert: true });
  if (error) throw new Error(`No se pudo sembrar ${bucket}/${ruta}: ${error.message}`);
}

const msg = (error) => (error ? `error: ${error.message}` : "sin error");

// ── Escenario ────────────────────────────────────────────────────────────────

async function crearUsuario(sufijo) {
  const email = `${PREFIJO}-${sufijo}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`No se pudo crear el usuario ${sufijo}: ${error.message}`);

  const cliente = createClient(URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { userId: data.user.id, email, password, cliente };
}

async function iniciarSesion(u, sufijo) {
  const { error } = await u.cliente.auth.signInWithPassword({
    email: u.email,
    password: u.password,
  });
  if (error) throw new Error(`No se pudo iniciar sesión como ${sufijo}: ${error.message}`);
}

async function crearArtistaDePrueba(sufijo) {
  const u = await crearUsuario(sufijo);

  const { data: artista, error: artErr } = await admin
    .from("artistas")
    .insert({ user_id: u.userId, nombre: `RLS Test ${sufijo}`, slug: `${PREFIJO}-${sufijo}` })
    .select("id")
    .single();
  if (artErr) throw new Error(`No se pudo crear el artista ${sufijo}: ${artErr.message}`);

  // El trigger trg_assign_artista_role ya asigna el rol; el 23505 no es fallo.
  const { error: rolErr } = await admin
    .from("user_roles")
    .insert({ user_id: u.userId, role: "artista" });
  if (rolErr && rolErr.code !== "23505") {
    throw new Error(`No se pudo asignar el rol a ${sufijo}: ${rolErr.message}`);
  }

  await iniciarSesion(u, sufijo);
  return { ...u, artistaId: artista.id };
}

async function crearAdminDePrueba() {
  const u = await crearUsuario("admin");
  const { error } = await admin.from("user_roles").insert({ user_id: u.userId, role: "admin" });
  if (error && error.code !== "23505") {
    throw new Error(`No se pudo asignar el rol admin: ${error.message}`);
  }
  await iniciarSesion(u, "admin");
  return u;
}

async function idEditorial() {
  const { data, error } = await admin
    .from("artistas")
    .select("id")
    .eq("es_editorial", true)
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("No se encontró el perfil editorial (es_editorial = true)");
  return data.id;
}

/**
 * Limpieza por PREFIJO, no por el estado en memoria (ver el mismo comentario en
 * verificar-rls-publicaciones.mjs). Primero Storage —necesita los ids de los
 * artistas de prueba para saber qué carpetas mirar— y después las filas.
 */
async function borrarArchivosDeTest(bucket, carpeta) {
  const { data } = await admin.storage.from(bucket).list(carpeta, { limit: 1000 });
  const rutas = (data ?? [])
    .filter((o) => o.id && o.name.startsWith(FAMILIA))
    .map((o) => `${carpeta}/${o.name}`);
  if (rutas.length) await admin.storage.from(bucket).remove(rutas);
  return rutas.length;
}

async function limpiar() {
  console.log("\nLimpiando datos de prueba...");
  let archivos = 0;

  const { data: artistasTest } = await admin
    .from("artistas")
    .select("id, user_id")
    .like("slug", `${FAMILIA}%`);

  const { data: lista, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) console.error("  ! no se pudo listar usuarios:", listErr.message);
  const usuariosTest = (lista?.users ?? []).filter((u) => u.email?.startsWith(FAMILIA));

  // Carpetas donde pudo quedar algo: las de los artistas y usuarios de prueba,
  // y la del editorial (solo sus archivos rlstest-*).
  const carpetas = new Set();
  for (const a of artistasTest ?? []) {
    carpetas.add(`artistas|${a.id}`);
    carpetas.add(`productos|${a.id}`);
    carpetas.add(`productos|${a.id}/publicaciones`);
    if (a.user_id) carpetas.add(`artistas|${a.user_id}`);
  }
  for (const u of usuariosTest) carpetas.add(`artistas|${u.id}`);
  try {
    const ed = await idEditorial();
    carpetas.add(`productos|${ed}/publicaciones`);
  } catch { /* sin editorial no hay nada que barrer ahí */ }

  for (const c of carpetas) {
    const [bucket, carpeta] = c.split("|");
    archivos += await borrarArchivosDeTest(bucket, carpeta);
  }

  for (const a of artistasTest ?? []) {
    await admin.from("artistas").delete().eq("id", a.id);
  }
  for (const u of usuariosTest) {
    await admin.from("user_roles").delete().eq("user_id", u.id);
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) console.error(`  ! usuario ${u.email}:`, error.message);
  }

  console.log(`  Archivos de prueba eliminados: ${archivos}`);
  console.log(`  Artistas de prueba eliminados: ${artistasTest?.length ?? 0}`);
  console.log(`  Usuarios de prueba eliminados: ${usuariosTest.length}`);
}

// ── Casos ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Verificación de RLS · storage (buckets artistas y productos)");
  console.log(`Proyecto: ${URL}`);
  console.log(`Prefijo de datos de prueba: ${PREFIJO}\n`);

  try {
    console.log("Montando escenario (service role)...");
    const A = await crearArtistaDePrueba("a");
    const B = await crearArtistaDePrueba("b");
    const ADM = await crearAdminDePrueba();
    const editorial = await idEditorial();
    console.log(`  Artista A: ${A.artistaId} (user ${A.userId})`);
    console.log(`  Artista B: ${B.artistaId} (user ${B.userId})`);
    console.log(`  Admin:     user ${ADM.userId}`);
    console.log(`  Editorial: ${editorial}\n`);

    const R = {
      fotoA:      `${A.userId}/${FAMILIA}foto.jpg`,
      fotoB:      `${B.userId}/${FAMILIA}foto.jpg`,
      fotoAdmB:   `${B.artistaId}/${FAMILIA}foto-admin.jpg`,
      prodA:      `${A.artistaId}/${FAMILIA}prod.jpg`,
      prodB:      `${B.artistaId}/${FAMILIA}prod.jpg`,
      pubA:       `${A.artistaId}/publicaciones/${FAMILIA}pub.jpg`,
      pubB:       `${B.artistaId}/publicaciones/${FAMILIA}pub.jpg`,
      intrusoArt: `${B.userId}/${FAMILIA}intruso.jpg`,
      intrusoPrd: `${B.artistaId}/${FAMILIA}intruso.jpg`,
      editorial:  `${editorial}/publicaciones/${FAMILIA}editorial.jpg`,
    };

    await sembrar("artistas", R.fotoA, "A-original");
    await sembrar("artistas", R.fotoB, "B-original");
    await sembrar("artistas", R.fotoAdmB, "B-original");
    await sembrar("productos", R.prodA, "A-original");
    await sembrar("productos", R.prodB, "B-original");
    await sembrar("productos", R.pubA, "A-original");
    await sembrar("productos", R.pubB, "B-original");

    console.log("Casos:");

    // (a) A NO puede sobrescribir la foto de perfil de B.
    {
      const { error } = await A.cliente.storage.from("artistas").update(R.fotoB, archivo("pisado-por-A"));
      const c = await leer("artistas", R.fotoB);
      check(
        "(a) A sobrescribe la foto de B (artistas) → rechazado",
        c === "B-original",
        c === "B-original" ? null : `La foto de B ahora contiene "${c}" (${msg(error)})`
      );
    }

    // (b) A sí puede actualizar su propia foto.
    {
      const { error } = await A.cliente.storage.from("artistas").update(R.fotoA, archivo("A-nuevo"));
      const c = await leer("artistas", R.fotoA);
      check(
        "(b) A actualiza su propia foto (artistas) → permitido",
        c === "A-nuevo",
        c === "A-nuevo" ? null : `Contenido "${c}" (${msg(error)})`
      );
    }

    // (c) A NO puede sobrescribir un archivo de B en productos.
    {
      const { error } = await A.cliente.storage.from("productos").update(R.prodB, archivo("pisado-por-A"));
      const c = await leer("productos", R.prodB);
      check(
        "(c) A sobrescribe un archivo de B (productos) → rechazado",
        c === "B-original",
        c === "B-original" ? null : `El archivo de B ahora contiene "${c}" (${msg(error)})`
      );
    }

    // (d) A sí puede actualizar su propio archivo en productos.
    {
      const { error } = await A.cliente.storage.from("productos").update(R.prodA, archivo("A-nuevo"));
      const c = await leer("productos", R.prodA);
      check(
        "(d) A actualiza su propio archivo (productos) → permitido",
        c === "A-nuevo",
        c === "A-nuevo" ? null : `Contenido "${c}" (${msg(error)})`
      );
    }

    // (e) A NO puede borrar la imagen de publicación de B.
    {
      const { error } = await A.cliente.storage.from("productos").remove([R.pubB]);
      const c = await leer("productos", R.pubB);
      check(
        "(e) A borra la imagen de publicación de B → sigue ahí",
        c === "B-original",
        c === "B-original" ? null : `El archivo de B desapareció (${msg(error)})`
      );
    }

    // (f) A sí puede borrar su propia imagen de publicación (lib/storage.ts).
    {
      const { error } = await A.cliente.storage.from("productos").remove([R.pubA]);
      const c = await leer("productos", R.pubA);
      check(
        "(f) A borra su propia imagen de publicación → desaparece",
        c === null,
        c === null ? null : `El archivo sigue ahí aunque remove() dio ${msg(error)}`
      );
    }

    // (g) El admin puede reemplazar la foto de un artista (admin/artistas/[id]/editar).
    {
      const { error } = await ADM.cliente.storage
        .from("artistas")
        .upload(R.fotoAdmB, archivo("admin-nuevo"), { upsert: true });
      const c = await leer("artistas", R.fotoAdmB);
      check(
        "(g) Admin reemplaza la foto de un artista (upsert) → permitido",
        c === "admin-nuevo",
        c === "admin-nuevo" ? null : `Contenido "${c}" (${msg(error)})`
      );
    }

    // (h) A NO puede crear archivos nuevos en la carpeta de B (artistas).
    {
      const { error } = await A.cliente.storage.from("artistas").upload(R.intrusoArt, archivo("intruso"));
      const c = await leer("artistas", R.intrusoArt);
      check(
        "(h) A sube un archivo nuevo en la carpeta de B (artistas) → rechazado",
        c === null,
        c === null ? null : `El archivo se creó (${msg(error)})`
      );
    }

    // (i) A NO puede crear archivos nuevos en la carpeta de B (productos).
    {
      const { error } = await A.cliente.storage.from("productos").upload(R.intrusoPrd, archivo("intruso"));
      const c = await leer("productos", R.intrusoPrd);
      check(
        "(i) A sube un archivo nuevo en la carpeta de B (productos) → rechazado",
        c === null,
        c === null ? null : `El archivo se creó (${msg(error)})`
      );
    }

    // (j) El admin puede subir la imagen de una publicación editorial. La
    // carpeta del editorial no tiene dueño (user_id null): solo la cubre la
    // política de admin.
    {
      const { error } = await ADM.cliente.storage.from("productos").upload(R.editorial, archivo("editorial"));
      const c = await leer("productos", R.editorial);
      check(
        "(j) Admin sube la imagen de una publicación editorial → permitido",
        c === "editorial",
        c === "editorial" ? null : `No quedó el archivo (${msg(error)})`
      );
    }
  } catch (err) {
    console.error("\nError montando o ejecutando la verificación:");
    console.error(`  ${err.message}`);
    resultados.push({ caso: "ejecución del script", ok: false, detalle: err.message });
  } finally {
    await limpiar();
  }

  // ── Resumen ────────────────────────────────────────────────────────────────
  const fallidos = resultados.filter((r) => !r.ok);
  console.log("\n" + "─".repeat(60));
  console.log(`Resultado: ${resultados.length - fallidos.length}/${resultados.length} casos OK`);

  if (fallidos.length > 0) {
    console.log("\nFallaron:");
    for (const f of fallidos) console.log(`  ✗ ${f.caso}`);
    process.exit(1);
  }

  console.log("Todas las políticas se comportan como se espera.");
  process.exit(0);
}

main();
