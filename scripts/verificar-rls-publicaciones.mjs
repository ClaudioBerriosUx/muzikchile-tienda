/**
 * Verificación end-to-end del RLS de `publicaciones`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CORRERLO
 *
 *   node --env-file=.env.local scripts/verificar-rls-publicaciones.mjs
 *
 * Necesita en el entorno:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Sale con código 0 si todos los casos pasan, 1 si alguno falla.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ ESCRIBE EN LA BASE DE DATOS REAL (el proyecto no tiene entorno de test).
 * Crea dos usuarios de auth, dos filas en `artistas` y varias en `publicaciones`,
 * todos con el prefijo `rlstest-`, y los borra en el `finally`. Si el script
 * muere de forma abrupta, buscar y limpiar por ese prefijo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTÁ HECHO ASÍ
 *
 * La service role key se usa SOLO para montar y desmontar el escenario (crear
 * usuarios, sembrar filas, limpiar). Todas las aserciones de RLS se hacen con
 * clientes autenticados como los artistas de prueba, o con el cliente anónimo.
 *
 * Probar RLS con la service role key no probaría nada: esa llave se salta el
 * RLS por diseño.
 */

import { createClient } from "@supabase/supabase-js";

const URL          = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON_KEY || !SERVICE_KEY) {
  console.error(
    "Faltan variables de entorno. Corre con:\n" +
    "  node --env-file=.env.local scripts/verificar-rls-publicaciones.mjs"
  );
  process.exit(1);
}

const PREFIJO = `rlstest-${Date.now()}`;

// Cliente con service role: solo para montar/limpiar el escenario.
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

/** Un rechazo por RLS es 42501; PostgREST lo devuelve como error con ese code. */
function esRechazoRLS(error) {
  if (!error) return false;
  return error.code === "42501" || /row-level security/i.test(error.message ?? "");
}

// ── Escenario ────────────────────────────────────────────────────────────────

async function crearArtistaDePrueba(sufijo) {
  const email = `${PREFIJO}-${sufijo}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;

  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userErr) throw new Error(`No se pudo crear el usuario ${sufijo}: ${userErr.message}`);
  const userId = userData.user.id;

  const { data: artista, error: artErr } = await admin
    .from("artistas")
    .insert({
      user_id: userId,
      nombre: `RLS Test ${sufijo}`,
      slug: `${PREFIJO}-${sufijo}`,
    })
    .select("id")
    .single();
  if (artErr) throw new Error(`No se pudo crear el artista ${sufijo}: ${artErr.message}`);

  // Ojo: la base tiene un trigger en auth.users que ya crea la fila en
  // user_roles al dar de alta el usuario. Por eso el insert puede chocar con
  // la unique (23505), y eso no es un fallo: el rol ya está puesto.
  const { error: rolErr } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role: "artista" });
  if (rolErr && rolErr.code !== "23505") {
    throw new Error(`No se pudo asignar el rol a ${sufijo}: ${rolErr.message}`);
  }

  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const tieneArtista = (roles ?? []).some((r) => r.role === "artista");
  if (!tieneArtista) {
    throw new Error(
      `El usuario ${sufijo} no quedó con rol 'artista' (tiene: ${(roles ?? []).map((r) => r.role).join(", ") || "ninguno"})`
    );
  }

  // Cliente autenticado COMO ese artista: acá es donde el RLS sí aplica.
  const cliente = createClient(URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: loginErr } = await cliente.auth.signInWithPassword({ email, password });
  if (loginErr) throw new Error(`No se pudo iniciar sesión como ${sufijo}: ${loginErr.message}`);

  return { userId, artistaId: artista.id, email, cliente };
}

/**
 * Admin de prueba: usuario de auth con rol 'admin' y sin fila en `artistas`.
 * Lo barre `limpiar()` por el prefijo del email.
 */
async function crearAdminDePrueba() {
  const email = `${PREFIJO}-admin@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;

  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userErr) throw new Error(`No se pudo crear el admin: ${userErr.message}`);
  const userId = userData.user.id;

  const { error: rolErr } = await admin.from("user_roles").insert({ user_id: userId, role: "admin" });
  if (rolErr && rolErr.code !== "23505") throw new Error(`No se pudo dar rol admin: ${rolErr.message}`);

  const cliente = createClient(URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: loginErr } = await cliente.auth.signInWithPassword({ email, password });
  if (loginErr) throw new Error(`No se pudo iniciar sesión como admin: ${loginErr.message}`);

  return { userId, cliente };
}

/** ¿`iso` cae dentro de los últimos `min` minutos? Para fechas que fija now(). */
function esReciente(iso, min = 5) {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && Math.abs(Date.now() - t) < min * 60_000;
}

/**
 * Limpieza por PREFIJO, no por el estado en memoria.
 *
 * Si el montaje falla a medias (por ejemplo: el usuario de auth se creó pero la
 * fila de `artistas` no), las referencias en memoria quedan incompletas y una
 * limpieza basada en ellas deja huérfanos. Barrer por prefijo se autorepara:
 * arrastra también lo que dejó una corrida anterior que murió a mitad.
 *
 * Barre toda la familia `rlstest-`, no solo la corrida actual. Ningún dato real
 * usa ese prefijo. La contrapartida es que dos corridas simultáneas se pisarían;
 * no se corren en paralelo.
 */
const FAMILIA = "rlstest-";

async function limpiar() {
  console.log("\nLimpiando datos de prueba...");

  const { error: pubErr } = await admin
    .from("publicaciones")
    .delete()
    .like("slug", `${FAMILIA}%`);
  if (pubErr) console.error("  ! publicaciones:", pubErr.message);

  // Los artistas de prueba se identifican por su slug.
  const { data: artistasTest } = await admin
    .from("artistas")
    .select("id, user_id")
    .like("slug", `${FAMILIA}%`);

  for (const a of artistasTest ?? []) {
    // Por si alguna publicación quedó con otro slug pero el mismo artista.
    await admin.from("publicaciones").delete().eq("artista_id", a.id);
    await admin.from("artistas").delete().eq("id", a.id);
    if (a.user_id) await admin.from("user_roles").delete().eq("user_id", a.user_id);
  }

  // Usuarios de auth: se buscan por email, así se barren también los que
  // quedaron sin fila en `artistas`.
  const { data: lista, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error("  ! no se pudo listar usuarios:", listErr.message);
  } else {
    const deTest = (lista?.users ?? []).filter((u) => u.email?.startsWith(FAMILIA));
    for (const u of deTest) {
      await admin.from("user_roles").delete().eq("user_id", u.id);
      const { error } = await admin.auth.admin.deleteUser(u.id);
      if (error) console.error(`  ! usuario ${u.email}:`, error.message);
    }
    console.log(`  Usuarios de prueba eliminados: ${deTest.length}`);
  }

  console.log(`  Artistas de prueba eliminados: ${artistasTest?.length ?? 0}`);
}

// ── Casos ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Verificación de RLS · tabla publicaciones");
  console.log(`Proyecto: ${URL}`);
  console.log(`Prefijo de datos de prueba: ${PREFIJO}\n`);

  let A = null;
  let B = null;

  try {
    console.log("Montando escenario (service role)...");
    A = await crearArtistaDePrueba("a");
    B = await crearArtistaDePrueba("b");
    console.log(`  Artista A: ${A.artistaId}`);
    console.log(`  Artista B: ${B.artistaId}\n`);

    console.log("Casos:");

    // (a) El artista puede insertar a su propio nombre.
    const { data: propia, error: errA } = await A.cliente
      .from("publicaciones")
      .insert({
        artista_id: A.artistaId,
        tipo: "noticia",
        categoria: "general",
        titular: "Publicación de prueba A",
        cuerpo: "Contenido de prueba para verificar el RLS.",
        slug: `${PREFIJO}-propia`,
        estado: "borrador",
      })
      .select("id")
      .single();
    check(
      "(a) Artista INSERT con su propio artista_id → permitido",
      !errA && !!propia,
      errA ? `Falló inesperadamente: ${errA.message}` : null
    );

    // (b) El artista NO puede insertar a nombre de otro.
    const { error: errB } = await A.cliente
      .from("publicaciones")
      .insert({
        artista_id: B.artistaId,
        tipo: "noticia",
        categoria: "general",
        titular: "Suplantación",
        cuerpo: "Esto no debería poder insertarse nunca.",
        slug: `${PREFIJO}-suplantacion`,
        estado: "borrador",
      });
    check(
      "(b) Artista INSERT con artista_id ajeno → rechazado",
      esRechazoRLS(errB),
      errB ? null : "NO fue rechazado: un artista puede publicar a nombre de otro."
    );

    // (c) El artista puede editar el contenido de su borrador.
    let errC = null;
    let filasC = 0;
    if (propia) {
      const { data, error } = await A.cliente
        .from("publicaciones")
        .update({ titular: "Titular corregido" })
        .eq("id", propia.id)
        .select("id");
      errC = error;
      filasC = data?.length ?? 0;
    }
    check(
      "(c) Artista UPDATE de contenido en su borrador → permitido",
      !errC && filasC === 1,
      errC ? `Falló inesperadamente: ${errC.message}` : filasC !== 1 ? `Afectó ${filasC} filas` : null
    );

    // (d) CRÍTICO: el artista NO puede autopublicarse.
    let errD = null;
    let filasD = 0;
    if (propia) {
      const { data, error } = await A.cliente
        .from("publicaciones")
        .update({ estado: "publicada" })
        .eq("id", propia.id)
        .select("id");
      errD = error;
      filasD = data?.length ?? 0;
    }
    check(
      "(d) Artista UPDATE de su borrador a estado 'publicada' → rechazado (WITH CHECK)",
      esRechazoRLS(errD) && filasD === 0,
      esRechazoRLS(errD)
        ? null
        : "CRÍTICO: el artista logró autopublicarse. La moderación es evitable.",
    );

    // (e) Aislamiento entre artistas.
    const { data: ajena, error: errSeedB } = await admin
      .from("publicaciones")
      .insert({
        artista_id: B.artistaId,
        tipo: "noticia",
        categoria: "general",
        titular: "Borrador privado de B",
        cuerpo: "A no debería ver esto.",
        slug: `${PREFIJO}-de-b`,
        estado: "borrador",
      })
      .select("id")
      .single();
    if (errSeedB) throw new Error(`No se pudo sembrar la publicación de B: ${errSeedB.message}`);

    const { data: vistas } = await A.cliente
      .from("publicaciones")
      .select("id")
      .eq("id", ajena.id);
    const { data: tocadas } = await A.cliente
      .from("publicaciones")
      .update({ titular: "Editado por A" })
      .eq("id", ajena.id)
      .select("id");
    check(
      "(e) Artista no ve ni edita publicaciones de otro → vacío",
      (vistas?.length ?? 0) === 0 && (tocadas?.length ?? 0) === 0,
      `SELECT devolvió ${vistas?.length ?? 0} fila(s), UPDATE afectó ${tocadas?.length ?? 0}`
    );

    // (f) El rol anónimo solo ve publicada + publica.
    await admin.from("publicaciones").insert([
      {
        artista_id: A.artistaId,
        tipo: "noticia", categoria: "general",
        titular: "Publicada y pública",
        cuerpo: "Anon debería ver esta.",
        slug: `${PREFIJO}-visible`,
        estado: "publicada", visibilidad: "publica",
      },
      {
        artista_id: A.artistaId,
        tipo: "noticia", categoria: "general",
        titular: "Publicada pero solo para artistas",
        cuerpo: "Anon NO debería ver esta.",
        slug: `${PREFIJO}-restringida`,
        estado: "publicada", visibilidad: "solo_artistas",
      },
    ]);

    const anon = createClient(URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: vistasAnon } = await anon
      .from("publicaciones")
      .select("slug, estado, visibilidad")
      .like("slug", `${PREFIJO}%`);

    const slugs = (vistasAnon ?? []).map((p) => p.slug);
    const soloLaPublica =
      slugs.length === 1 && slugs[0] === `${PREFIJO}-visible`;
    check(
      "(f) Anon solo ve publicada + publica",
      soloLaPublica,
      soloLaPublica ? null : `Anon vio: ${slugs.length ? slugs.join(", ") : "(nada)"}`
    );

    // ── Editoriales y fecha_publicacion (migración 20261003205430) ───────────
    //
    // Las editoriales de prueba cuelgan del perfil MuzikChile REAL (no hay otro
    // editorial), pero llevan slug con el prefijo rlstest-: `limpiar()` las
    // borra por slug y nunca toca el perfil ni las noticias reales.

    const { data: perfilEditorial, error: errPerfil } = await admin
      .from("artistas")
      .select("id")
      .eq("slug", "muzikchile")
      .eq("es_editorial", true)
      .single();
    if (errPerfil) throw new Error(`No se encontró el perfil editorial: ${errPerfil.message}`);
    const EDITORIAL = perfilEditorial.id;

    const ADM = await crearAdminDePrueba();
    const base = { tipo: "noticia", categoria: "general", cuerpo: "Contenido de prueba editorial." };

    // (g) Un artista NO puede crear una publicación a nombre del editorial.
    const { error: errG } = await A.cliente.from("publicaciones").insert({
      ...base,
      artista_id: EDITORIAL,
      titular: "Suplantación editorial",
      slug: `${PREFIJO}-suplanta-editorial`,
      estado: "borrador",
    });
    check(
      "(g) Artista INSERT con artista_id del perfil editorial → rechazado",
      esRechazoRLS(errG),
      errG ? null : "NO fue rechazado: un artista puede firmar como MuzikChile."
    );

    // (h) Un artista NO puede editar una editorial.
    const { data: semilla, error: errSemilla } = await admin
      .from("publicaciones")
      .insert({ ...base, artista_id: EDITORIAL, titular: "Editorial sembrada", slug: `${PREFIJO}-editorial-semilla`, estado: "borrador" })
      .select("id")
      .single();
    if (errSemilla) throw new Error(`No se pudo sembrar la editorial: ${errSemilla.message}`);
    const { data: tocadaH } = await A.cliente
      .from("publicaciones")
      .update({ titular: "Editada por un artista" })
      .eq("id", semilla.id)
      .select("id");
    check(
      "(h) Artista UPDATE de una editorial → 0 filas",
      (tocadaH?.length ?? 0) === 0,
      `UPDATE afectó ${tocadaH?.length ?? 0} fila(s)`
    );

    // (i) Un artista que manda fecha_publicacion al crear: se ignora, queda now().
    const { data: conFecha, error: errI } = await A.cliente
      .from("publicaciones")
      .insert({
        ...base,
        artista_id: A.artistaId,
        titular: "Con fecha retroactiva",
        slug: `${PREFIJO}-fecha-retro`,
        estado: "borrador",
        fecha_publicacion: "2020-01-01T00:00:00Z",
      })
      .select("id, fecha_publicacion")
      .single();
    check(
      "(i) Artista INSERT con fecha_publicacion del pasado → se guarda now()",
      !errI && esReciente(conFecha?.fecha_publicacion),
      errI ? `Falló el insert: ${errI.message}` : `Quedó ${conFecha?.fecha_publicacion}`
    );

    // (j) Un artista NO puede cambiar fecha_publicacion de su borrador.
    let errJ = null;
    let fechaJ = null;
    if (conFecha) {
      ({ error: errJ } = await A.cliente
        .from("publicaciones")
        .update({ fecha_publicacion: "2021-06-01T00:00:00Z" })
        .eq("id", conFecha.id));
      ({ data: { fecha_publicacion: fechaJ } } = await admin
        .from("publicaciones").select("fecha_publicacion").eq("id", conFecha.id).single());
    }
    check(
      "(j) Artista UPDATE de fecha_publicacion → rechazado (trigger)",
      esRechazoRLS(errJ) && fechaJ === conFecha?.fecha_publicacion,
      esRechazoRLS(errJ) ? null : `NO fue rechazado (${errJ?.message ?? "sin error"}); fecha quedó ${fechaJ}`
    );

    // (k) El admin publica una editorial directo, sin moderación.
    const { data: directa, error: errK } = await ADM.cliente
      .from("publicaciones")
      .insert({ ...base, artista_id: EDITORIAL, titular: "Editorial directa", slug: `${PREFIJO}-editorial-directa`, estado: "publicada", visibilidad: "publica" })
      .select("id, estado")
      .single();
    check(
      "(k) Admin INSERT de editorial como 'publicada' → permitido",
      !errK && directa?.estado === "publicada",
      errK ? `Falló: ${errK.message}` : null
    );

    // (l) El admin puede fijar fecha_publicacion.
    let errL = null;
    let fechaL = null;
    if (directa) {
      const { data, error } = await ADM.cliente
        .from("publicaciones")
        .update({ fecha_publicacion: "2025-09-28T19:23:00Z" })
        .eq("id", directa.id)
        .select("fecha_publicacion")
        .single();
      errL = error;
      fechaL = data?.fecha_publicacion;
    }
    check(
      "(l) Admin UPDATE de fecha_publicacion → permitido",
      !errL && fechaL && new Date(fechaL).toISOString() === "2025-09-28T19:23:00.000Z",
      errL ? `Falló: ${errL.message}` : `Quedó ${fechaL}`
    );

    // (m) Publicar un borrador sin tocar la fecha → toma now().
    const { data: viejo, error: errSemM } = await admin
      .from("publicaciones")
      .insert({ ...base, artista_id: EDITORIAL, titular: "Borrador viejo", slug: `${PREFIJO}-borrador-viejo`, estado: "borrador", fecha_publicacion: "2025-01-15T12:00:00Z" })
      .select("id")
      .single();
    if (errSemM) throw new Error(`No se pudo sembrar el borrador viejo: ${errSemM.message}`);
    const { data: publicadoM, error: errM } = await ADM.cliente
      .from("publicaciones")
      .update({ estado: "publicada" })
      .eq("id", viejo.id)
      .select("fecha_publicacion")
      .single();
    check(
      "(m) Admin publica un borrador sin tocar la fecha → fecha = now()",
      !errM && esReciente(publicadoM?.fecha_publicacion),
      errM ? `Falló: ${errM.message}` : `Quedó ${publicadoM?.fecha_publicacion}`
    );

    // (n) Ni el admin puede poner una fecha futura (no hay programación).
    let errN = null;
    if (directa) {
      ({ error: errN } = await ADM.cliente
        .from("publicaciones")
        .update({ fecha_publicacion: new Date(Date.now() + 86_400_000).toISOString() })
        .eq("id", directa.id));
    }
    check(
      "(n) Admin UPDATE con fecha_publicacion futura → rechazado",
      errN?.code === "22007",
      errN ? (errN.code === "22007" ? null : `Error inesperado: ${errN.message}`) : "NO fue rechazado"
    );
  } catch (err) {
    console.error("\nError montando o ejecutando la verificación:");
    console.error(`  ${err.message}`);
    resultados.push({ caso: "ejecución del script", ok: false, detalle: err.message });
  } finally {
    // A y B no se pasan a propósito: la limpieza barre por prefijo, así también
    // recoge lo que quedó de una corrida que murió durante el montaje.
    void A; void B;
    await limpiar();
  }

  // ── Resumen ────────────────────────────────────────────────────────────────
  const fallidos = resultados.filter((r) => !r.ok);
  console.log("\n" + "─".repeat(60));
  console.log(`Resultado: ${resultados.length - fallidos.length}/${resultados.length} casos OK`);

  if (fallidos.length > 0) {
    console.log("\nFallaron:");
    for (const f of fallidos) console.log(`  ✗ ${f.caso}`);

    // Solo se advierte del caso crítico si es ese el que falló.
    if (fallidos.some((f) => f.caso.startsWith("(d)"))) {
      console.log(
        "\n⚠️ FALLÓ EL CASO CRÍTICO (d): un artista puede autopublicarse sin pasar\n" +
        "por revisión. La moderación es evitable. Arreglar la política antes de seguir."
      );
    }
    process.exit(1);
  }

  console.log("Todas las políticas se comportan como se espera.");
  process.exit(0);
}

main();
