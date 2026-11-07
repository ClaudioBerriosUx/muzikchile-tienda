/**
 * Arma el SQL que deja un proyecto de Supabase NUEVO igual a producción, para
 * correr ahí las pruebas que escriben. No se conecta a ninguna base: solo
 * genera un archivo, que después se carga con psql.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CORRERLO
 *
 *   npm run pruebas:preparar -- --hasta=<timestamp de la última migración que
 *                                         ya está incluida en el volcado>
 *
 * Toma supabase/schema_baseline.sql, que tiene que venir de un volcado con
 * private y auth y con permisos (ver "Base de pruebas" en PROGRESS.md), y deja
 * el resultado en supabase/.temp/base-pruebas.sql (ignorado por git).
 *
 *   npm run pruebas:preparar -- --solo-permisos
 *
 * Para una base de pruebas ya cargada: deja permisos y seed como en el volcado,
 * sin tocar tablas ni filas. Resultado en supabase/.temp/permisos-pruebas.sql.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Qué conserva del volcado:
 *   public y private   todo, porque ahí está el esquema de la app.
 *   storage            solo las políticas: las tablas las pone Supabase.
 *   auth               solo los triggers (auth.users → user_roles).
 *
 * Permisos: un proyecto nuevo da todo a anon, authenticated y service_role sobre
 * cada objeto que se crea en public (default privileges). Un volcado solo trae
 * los GRANT que existen, no quita los que el destino agrega solo. Sin apagar
 * esos permisos durante la carga, la base queda más abierta que producción y
 * las pruebas de permisos fallan.
 *
 * Los dos archivos abortan al inicio si la base no es la esperada: el completo
 * si ya tiene la tabla `artistas`, el de permisos si no tiene el token falso del
 * seed. Por eso ninguno se puede cargar por error en producción.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const opcion = (nombre) =>
  process.argv.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3);

const CARPETA = "supabase/migrations";
const BASELINE = opcion("baseline") ?? "supabase/schema_baseline.sql";
const SOLO_PERMISOS = process.argv.includes("--solo-permisos");
const SALIDA = opcion("salida") ??
  (SOLO_PERMISOS ? "supabase/.temp/permisos-pruebas.sql" : "supabase/.temp/base-pruebas.sql");
const HASTA = opcion("hasta");
const ROLES_API = "anon, authenticated, service_role";

function fallar(mensaje) {
  console.error(`\nNo se generó nada: ${mensaje}`);
  process.exit(1);
}

if (!SOLO_PERMISOS && !/^\d{14}$/.test(HASTA ?? "")) {
  fallar("falta --hasta=<timestamp>, la última migración incluida en el volcado.");
}

const volcado = readFileSync(BASELINE, "utf8").replace(/\r\n/g, "\n");

// Sin esto, las políticas "admin manage …" no cargan.
if (!/CREATE FUNCTION private\.has_role/.test(volcado)) {
  fallar(`${BASELINE} no trae private.has_role. Regenera el volcado con --schema=private (ver PROGRESS.md).`);
}

/** Corta el volcado por sus encabezados `-- Name: …; Type: …; Schema: …`. */
function secciones(texto) {
  const encabezado = /^--\n-- (?:Data for )?Name: (.*?); Type: (.*?); Schema: (.*?); Owner: .*\n--\n/gm;
  const marcas = [...texto.matchAll(encabezado)];
  return marcas.map((m, i) => ({
    nombre: m[1],
    tipo: m[2],
    esquema: m[3],
    cuerpo: texto.slice(m.index, marcas[i + 1]?.index ?? texto.length),
  }));
}

function seQueda({ nombre, tipo, esquema }) {
  if (tipo === "DEFAULT ACL") return false;
  // Solo el esquema private lo crea el volcado: los otros ya existen.
  if (esquema === "-") return /\bprivate$/.test(nombre);
  if (esquema === "public" || esquema === "private") return true;
  if (esquema === "storage") return tipo === "POLICY";
  if (esquema === "auth") return tipo === "TRIGGER";
  return false;
}

const conservadas = secciones(volcado).filter(seQueda);
if (conservadas.length === 0) fallar(`${BASELINE} no tiene secciones reconocibles.`);

const seed = readFileSync("supabase/pruebas/seed.sql", "utf8");

/** ALTER DEFAULT PRIVILEGES para los objetos que crea postgres en public. */
const privilegiosPorDefecto = (accion) =>
  ["TABLES", "FUNCTIONS", "SEQUENCES"].map((clase) =>
    accion === "REVOKE"
      ? `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON ${clase} FROM ${ROLES_API};`
      : `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ${clase} TO ${ROLES_API};`
  );

function archivoPermisos() {
  const acl = conservadas.filter((s) => s.tipo === "ACL").map((s) => s.cuerpo);
  if (acl.length === 0) fallar(`${BASELINE} no trae permisos: regenera el volcado sin --no-privileges.`);

  // No se le quita nada a PUBLIC: los REVOKE … FROM PUBLIC ya vienen en el
  // volcado para las funciones que lo necesitan.
  const revocar = (["public", "private"]).flatMap((esquema) => [
    `REVOKE ALL ON ALL TABLES IN SCHEMA ${esquema} FROM ${ROLES_API};`,
    `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ${esquema} FROM ${ROLES_API};`,
    `REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${esquema} FROM ${ROLES_API};`,
  ]);

  return [
    "\\set ON_ERROR_STOP on",
    "",
    "DO $freno$",
    "BEGIN",
    "  IF NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'mp_access_token' AND value = 'TEST-falso') THEN",
    "    RAISE EXCEPTION 'Esta no es la base de pruebas: no tiene el token falso del seed';",
    "  END IF;",
    "END $freno$;",
    "",
    "SET client_min_messages = warning;",
    ...revocar,
    "SELECT pg_catalog.set_config('search_path', '', false);",
    "",
    ...acl,
    "SELECT pg_catalog.set_config('search_path', 'public, extensions', false);",
    "",
    seed,
  ].join("\n");
}

function archivoCompleto() {
  const migraciones = readdirSync(CARPETA).filter((f) => /^\d{14}_.*\.sql$/.test(f)).sort();
  if (!migraciones.some((f) => f.startsWith(`${HASTA}_`))) {
    fallar(`no hay ninguna migración con el timestamp ${HASTA}.`);
  }
  const version = (f) => f.slice(0, 14);
  const incluidas = migraciones.filter((f) => version(f) <= HASTA);
  const posteriores = migraciones.filter((f) => version(f) > HASTA);
  const historial = (f) =>
    `INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${version(f)}', '${f.slice(15, -4)}') ON CONFLICT (version) DO NOTHING;`;

  console.log(`Migraciones ya incluidas: ${incluidas.length}. A aplicar: ${posteriores.length}.`);

  return [
    "\\set ON_ERROR_STOP on",
    "",
    "DO $freno$",
    "BEGIN",
    "  IF to_regclass('public.artistas') IS NOT NULL THEN",
    "    RAISE EXCEPTION 'Esta base ya tiene artistas: el archivo es solo para un proyecto nuevo';",
    "  END IF;",
    "END $freno$;",
    "",
    "SET client_min_messages = warning;",
    "SET check_function_bodies = false;",
    ...privilegiosPorDefecto("REVOKE"),
    "SELECT pg_catalog.set_config('search_path', '', false);",
    "",
    ...conservadas.map((s) => s.cuerpo),
    "SELECT pg_catalog.set_config('search_path', 'public, extensions', false);",
    "SET check_function_bodies = true;",
    // Como en producción: lo que creen las migraciones siguientes recibe estos permisos.
    ...privilegiosPorDefecto("GRANT"),
    "",
    "CREATE SCHEMA IF NOT EXISTS supabase_migrations;",
    "CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, statements text[], name text);",
    ...incluidas.map(historial),
    "",
    ...posteriores.flatMap((f) => [`-- ${f}`, readFileSync(join(CARPETA, f), "utf8"), historial(f), ""]),
    seed,
  ].join("\n");
}

const salida = SOLO_PERMISOS ? archivoPermisos() : archivoCompleto();

mkdirSync(SALIDA.replace(/[\\/][^\\/]*$/, ""), { recursive: true });
writeFileSync(SALIDA, salida);

const porEsquema = {};
for (const s of conservadas) porEsquema[s.esquema] = (porEsquema[s.esquema] ?? 0) + 1;
console.log(`Generado: ${SALIDA}`);
console.log(`Secciones del volcado: ${JSON.stringify(porEsquema)}`);
console.log(`\nPara cargarlo en el proyecto de PRUEBAS (la URL va sin contraseña; psql la pide):`);
console.log(`  psql "<URL de conexión de pruebas>" --single-transaction -f ${SALIDA}`);
