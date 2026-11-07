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
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Qué conserva del volcado:
 *   public y private   todo, porque ahí está el esquema de la app.
 *   storage            solo las políticas: las tablas las pone Supabase.
 *   auth               solo los triggers (auth.users → user_roles).
 *
 * Después agrega supabase/pruebas/seed.sql, marca como aplicadas las migraciones
 * hasta --hasta y aplica las posteriores.
 *
 * El archivo aborta al inicio si la base ya tiene la tabla `artistas`: por eso
 * no se puede cargar por error en producción ni en una base ya preparada.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const opcion = (nombre) =>
  process.argv.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3);

const CARPETA = "supabase/migrations";
const BASELINE = opcion("baseline") ?? "supabase/schema_baseline.sql";
const SALIDA = opcion("salida") ?? "supabase/.temp/base-pruebas.sql";
const HASTA = opcion("hasta");

function fallar(mensaje) {
  console.error(`\nNo se generó nada: ${mensaje}`);
  process.exit(1);
}

if (!/^\d{14}$/.test(HASTA ?? "")) {
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

const migraciones = readdirSync(CARPETA).filter((f) => /^\d{14}_.*\.sql$/.test(f)).sort();
if (!migraciones.some((f) => f.startsWith(`${HASTA}_`))) {
  fallar(`no hay ninguna migración con el timestamp ${HASTA}.`);
}
const version = (f) => f.slice(0, 14);
const incluidas = migraciones.filter((f) => version(f) <= HASTA);
const posteriores = migraciones.filter((f) => version(f) > HASTA);
const historial = (f) =>
  `INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${version(f)}', '${f.slice(15, -4)}') ON CONFLICT (version) DO NOTHING;`;

const salida = [
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
  "SELECT pg_catalog.set_config('search_path', '', false);",
  "",
  ...conservadas.map((s) => s.cuerpo),
  "SELECT pg_catalog.set_config('search_path', 'public, extensions', false);",
  "SET check_function_bodies = true;",
  "",
  "CREATE SCHEMA IF NOT EXISTS supabase_migrations;",
  "CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, statements text[], name text);",
  ...incluidas.map(historial),
  "",
  ...posteriores.flatMap((f) => [`-- ${f}`, readFileSync(join(CARPETA, f), "utf8"), historial(f), ""]),
  readFileSync("supabase/pruebas/seed.sql", "utf8"),
].join("\n");

mkdirSync(SALIDA.replace(/[\\/][^\\/]*$/, ""), { recursive: true });
writeFileSync(SALIDA, salida);

const porEsquema = {};
for (const s of conservadas) porEsquema[s.esquema] = (porEsquema[s.esquema] ?? 0) + 1;
console.log(`Generado: ${SALIDA}`);
console.log(`Secciones del volcado: ${JSON.stringify(porEsquema)}`);
console.log(`Migraciones ya incluidas: ${incluidas.length}. A aplicar: ${posteriores.length}.`);
console.log(`\nPara cargarlo en el proyecto de PRUEBAS (la URL va sin contraseña; psql la pide):`);
console.log(`  psql "<URL de conexión de pruebas>" --single-transaction -f ${SALIDA}`);
