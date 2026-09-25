/**
 * Verificación end-to-end del alta de artistas: la Edge Function
 * `invitar-artista` y la política `artista_insert_own` de `artistas`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CORRERLO
 *
 *   npm run verificar:invitar
 *   npm run verificar:invitar -- --sin-invitacion   (salta el caso c)
 *
 * Necesita en el entorno:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Sale con código 0 si todos los casos pasan, 1 si alguno falla. Un caso (c)
 * frenado por el rate limit del SMTP se reporta aparte y NO cuenta como fallo.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ ESCRIBE EN LA BASE REAL Y MANDA UN CORREO REAL.
 * El caso (c) invita a `raices.berrios+rlstest-<ts>@gmail.com`: llega un correo
 * de invitación por corrida (ignorarlo). El SMTP integrado de Supabase tiene un
 * rate limit bajo por hora; si hace falta repetir, usar --sin-invitacion.
 *
 * Usuarios, roles y filas de `artistas` de prueba se borran en el `finally`,
 * barriendo por prefijo (email que empieza con `rlstest-` o contiene
 * `+rlstest-`; slug que empieza con `rlstest-`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTÁ HECHO ASÍ
 *
 * (a) y (b) mandan un email con formato INVÁLIDO a propósito. La función debe
 * rechazar por identidad (401/403) antes de mirar el email; si en cambio llega a
 * validar el email (400), significa que no hay control de acceso — y se
 * demuestra sin mandar ningún correo.
 *
 * Todas las invocaciones van por `functions.invoke` de supabase-js, igual que
 * `/admin/artistas`: así el caso (c) también prueba que el cliente manda el JWT
 * de la sesión.
 */

import { createClient } from "@supabase/supabase-js";

const URL          = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON_KEY || !SERVICE_KEY) {
  console.error(
    "Faltan variables de entorno. Corre con:\n" +
    "  node --env-file=.env.local scripts/verificar-invitar-artista.mjs"
  );
  process.exit(1);
}

const SIN_INVITACION = process.argv.includes("--sin-invitacion");

const FAMILIA = "rlstest-";
const TS = Date.now();
const PREFIJO = `${FAMILIA}${TS}`;
const EMAIL_INVITADO = `raices.berrios+${FAMILIA}${TS}@gmail.com`;
const EMAIL_INVALIDO = "esto-no-es-un-email";

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const nuevoCliente = () =>
  createClient(URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// ── Reporte ──────────────────────────────────────────────────────────────────

const resultados = [];
const avisos = [];

function check(caso, ok, detalle) {
  resultados.push({ caso, ok, detalle });
  console.log(`  ${ok ? "✓" : "✗"} ${caso}`);
  if (detalle) console.log(`      ${detalle}`);
}

function esRechazoRLS(error) {
  if (!error) return false;
  return error.code === "42501" || /row-level security/i.test(error.message ?? "");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Invoca la función y devuelve { status, cuerpo }, haya error o no. */
async function invocar(cliente, email) {
  const { data, error } = await cliente.functions.invoke("invitar-artista", {
    body: { email },
  });
  if (!error) return { status: 200, cuerpo: data };
  const res = error.context;
  if (res && typeof res.status === "number") {
    let cuerpo = null;
    try { cuerpo = await res.json(); } catch { /* sin cuerpo JSON */ }
    return { status: res.status, cuerpo };
  }
  return { status: 0, cuerpo: { error: error.message } };
}

async function rolesDe(userId) {
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role);
}

async function crearUsuario(sufijo, rol) {
  const email = `${PREFIJO}-${sufijo}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw new Error(`No se pudo crear el usuario ${sufijo}: ${error.message}`);
  const userId = data.user.id;

  if (rol) {
    const { error: rolErr } = await admin.from("user_roles").insert({ user_id: userId, role: rol });
    if (rolErr && rolErr.code !== "23505") {
      throw new Error(`No se pudo asignar el rol ${rol} a ${sufijo}: ${rolErr.message}`);
    }
  }

  const cliente = nuevoCliente();
  const { error: loginErr } = await cliente.auth.signInWithPassword({ email, password });
  if (loginErr) throw new Error(`No se pudo iniciar sesión como ${sufijo}: ${loginErr.message}`);
  return { userId, email, cliente };
}

// ── Limpieza ─────────────────────────────────────────────────────────────────

const esDeTest = (email) =>
  !!email && (email.startsWith(FAMILIA) || email.includes(`+${FAMILIA}`));

async function limpiar() {
  console.log("\nLimpiando datos de prueba...");

  const { data: artistasTest } = await admin
    .from("artistas")
    .select("id")
    .like("slug", `${FAMILIA}%`);
  for (const a of artistasTest ?? []) {
    await admin.from("artistas").delete().eq("id", a.id);
  }

  const { data: lista, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error("  ! no se pudo listar usuarios:", error.message);
    return;
  }
  const deTest = (lista?.users ?? []).filter((u) => esDeTest(u.email));
  for (const u of deTest) {
    // Con la FK ON DELETE CASCADE esto sobra; antes de la migración no.
    await admin.from("user_roles").delete().eq("user_id", u.id);
    const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
    if (delErr) console.error(`  ! usuario ${u.email}:`, delErr.message);
  }

  console.log(`  Artistas de prueba eliminados: ${artistasTest?.length ?? 0}`);
  console.log(`  Usuarios de prueba eliminados: ${deTest.length}`);
}

// ── Casos ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Verificación · alta de artistas (invitar-artista + artista_insert_own)");
  console.log(`Proyecto: ${URL}`);
  console.log(`Prefijo de datos de prueba: ${PREFIJO}`);
  if (SIN_INVITACION) console.log("Modo --sin-invitacion: se salta el caso (c).");
  console.log("");

  try {
    console.log("Montando escenario (service role)...");
    const ART = await crearUsuario("artista", "artista");
    const ADM = await crearUsuario("admin", "admin");
    console.log(`  Artista: ${ART.userId}`);
    console.log(`  Admin:   ${ADM.userId}\n`);

    console.log("Casos:");

    // (a) Sin sesión → 401.
    {
      const { status, cuerpo } = await invocar(nuevoCliente(), EMAIL_INVALIDO);
      check(
        "(a) Sin sesión → 401",
        status === 401,
        status === 401 ? null : `Respondió ${status}: ${JSON.stringify(cuerpo)}`
      );
    }

    // (b) Sesión de artista → 403.
    {
      const { status, cuerpo } = await invocar(ART.cliente, EMAIL_INVALIDO);
      check(
        "(b) Sesión de artista → 403",
        status === 403,
        status === 403 ? null : `Respondió ${status}: ${JSON.stringify(cuerpo)}`
      );
    }

    // (c) Sesión de admin → invita y el invitado queda con rol artista.
    if (SIN_INVITACION) {
      console.log("  – (c) Sesión de admin → invita (saltado por --sin-invitacion)");
    } else {
      const { status, cuerpo } = await invocar(ADM.cliente, EMAIL_INVITADO);
      const texto = JSON.stringify(cuerpo ?? {});
      if (status === 429 || /rate limit/i.test(texto)) {
        avisos.push(`(c) frenado por rate limit del SMTP (${status}: ${texto}). No es un fallo de seguridad.`);
        console.log("  ⚠ (c) Sesión de admin → invita: RATE LIMIT del SMTP, no evaluable");
        console.log(`      ${status}: ${texto}`);
      } else {
        const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const invitado = (lista?.users ?? []).find((u) => u.email === EMAIL_INVITADO);
        const roles = invitado ? await rolesDe(invitado.id) : [];
        const ok = status === 200 && !!invitado && roles.includes("artista");
        check(
          "(c) Sesión de admin → invita, y el invitado queda con rol artista",
          ok,
          ok ? null : `Respondió ${status}: ${texto}; usuario ${invitado ? "creado" : "NO creado"}, roles: ${roles.join(",") || "ninguno"}`
        );
      }
    }

    // (d) Un usuario sin rol NO puede darse de alta como artista insertando su
    // fila en `artistas` (antes, el trigger le regalaba el rol).
    {
      const U = await crearUsuario("sin-rol", null);
      const rolesAntes = await rolesDe(U.userId);
      const { error } = await U.cliente
        .from("artistas")
        .insert({ user_id: U.userId, nombre: "RLS Test sin rol", slug: `${PREFIJO}-sin-rol` });
      const rolesDespues = await rolesDe(U.userId);
      const ok = esRechazoRLS(error) && !rolesDespues.includes("artista");
      check(
        "(d) Usuario sin rol inserta su fila en artistas → rechazado, sigue sin rol",
        ok,
        ok ? null :
          `Insert ${error ? `rechazado (${error.message})` : "PERMITIDO"}; ` +
          `roles antes: ${rolesAntes.join(",") || "ninguno"}, después: ${rolesDespues.join(",") || "ninguno"}`
      );
    }

    // (e) Un artista invitado (tiene el rol, aún no su fila) sí puede crearla:
    // es lo que hace PanelShell.ensureArtistaRecord en su primer acceso.
    {
      const U = await crearUsuario("invitado", "artista");
      const { error } = await U.cliente
        .from("artistas")
        .insert({ user_id: U.userId, nombre: "RLS Test invitado", slug: `${PREFIJO}-invitado` });
      check(
        "(e) Artista invitado crea su fila en artistas → permitido",
        !error,
        error ? `Falló: ${error.message}` : null
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
  for (const a of avisos) console.log(`⚠ ${a}`);

  if (fallidos.length > 0) {
    console.log("\nFallaron:");
    for (const f of fallidos) console.log(`  ✗ ${f.caso}`);
    process.exit(1);
  }

  console.log("Todas las verificaciones pasaron.");
  process.exit(0);
}

main();
