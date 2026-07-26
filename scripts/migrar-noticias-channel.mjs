/**
 * Migra las noticias publicadas del blog del Channel a `publicaciones` de la
 * Tienda, atribuidas al autor editorial MuzikChile.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CORRERLO
 *
 *   node --env-file=.env.local scripts/migrar-noticias-channel.mjs
 *
 * Con --dry-run no escribe nada, solo muestra qué haría:
 *
 *   node --env-file=.env.local scripts/migrar-noticias-channel.mjs --dry-run
 *
 * Necesita en el entorno:
 *   NEXT_PUBLIC_CHANNEL_SUPABASE_URL / _ANON_KEY   (origen, solo lectura)
 *   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  (destino)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ES IDEMPOTENTE: antes de insertar compara por `slug` contra lo que ya existe
 * en la Tienda y salta lo repetido. Correrlo dos veces no duplica nada.
 *
 * NO TOCA EL CHANNEL. Solo hace SELECT sobre su tabla `noticias`.
 *
 * Sobre la autoría: `publicaciones` NO tiene columna `es_editorial` —ese flag
 * vive en `artistas`— y `artista_id` es NOT NULL. Por eso las noticias se
 * atribuyen apuntando `artista_id` al perfil editorial MuzikChile
 * (slug 'muzikchile', es_editorial = true), que es exactamente para lo que se
 * creó ese perfil.
 */

import { createClient } from "@supabase/supabase-js";

const CH_URL = process.env.NEXT_PUBLIC_CHANNEL_SUPABASE_URL;
const CH_KEY = process.env.NEXT_PUBLIC_CHANNEL_SUPABASE_ANON_KEY;
const TI_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const TI_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DRY_RUN = process.argv.includes("--dry-run");

if (!CH_URL || !CH_KEY || !TI_URL || !TI_KEY) {
  console.error(
    "Faltan variables de entorno. Corre con:\n" +
    "  node --env-file=.env.local scripts/migrar-noticias-channel.mjs"
  );
  process.exit(1);
}

/** Tope del CHECK `publicaciones_titular_check`. */
const TITULAR_MAX = 200;

const channel = createClient(CH_URL, CH_KEY, { auth: { persistSession: false } });
// Service role: esto es una operación administrativa de migración, no una
// sesión de usuario. Salta el RLS a propósito.
const tienda = createClient(TI_URL, TI_KEY, { auth: { persistSession: false } });

/**
 * Añade los artistas mencionados al final del cuerpo.
 *
 * En el Channel eso vivía en una columna aparte (`artista_relacionado`) que en
 * la Tienda no tiene equivalente: acá el autor ES el artista. Se conserva como
 * texto para no perder el dato.
 */
function agregarArtistasMencionados(cuerpo, relacionado) {
  const valor = (relacionado ?? "").trim();
  if (!valor) return cuerpo ?? "";

  // "Artista mencionado" en singular cuando es uno solo.
  const etiqueta = valor.includes(",") ? "Artistas mencionados" : "Artista mencionado";
  return `${cuerpo ?? ""}<p><em>${etiqueta}: ${valor}</em></p>`;
}

async function main() {
  console.log("Migración de noticias · Channel → Tienda");
  console.log(`Origen:  ${CH_URL}`);
  console.log(`Destino: ${TI_URL}`);
  if (DRY_RUN) console.log("MODO DRY-RUN: no se escribe nada.");
  console.log("");

  // ── Autor editorial ────────────────────────────────────────────────────────
  const { data: editorial, error: errAutor } = await tienda
    .from("artistas")
    .select("id, nombre")
    .eq("slug", "muzikchile")
    .eq("es_editorial", true)
    .maybeSingle();

  if (errAutor) {
    console.error("Error buscando el autor editorial:", errAutor.message);
    process.exit(1);
  }
  if (!editorial) {
    console.error(
      "No existe el perfil editorial (artistas con slug 'muzikchile' y\n" +
      "es_editorial = true). Lo crea la migración 20260725230520."
    );
    process.exit(1);
  }
  console.log(`Autor editorial: ${editorial.nombre} (${editorial.id})\n`);

  // ── Origen ─────────────────────────────────────────────────────────────────
  const { data: noticias, error: errCh } = await channel
    .from("noticias")
    .select("titulo, slug, resumen, contenido, imagen_destacada, fecha_publicacion, artista_relacionado")
    .eq("estado", "publicado")
    .order("fecha_publicacion", { ascending: true });

  if (errCh) {
    console.error("Error leyendo el Channel:", errCh.message);
    process.exit(1);
  }
  console.log(`Encontradas en el Channel (estado='publicado'): ${noticias.length}`);

  // ── Slugs ya migrados ──────────────────────────────────────────────────────
  const { data: existentes, error: errEx } = await tienda
    .from("publicaciones")
    .select("slug");

  if (errEx) {
    console.error("Error leyendo las publicaciones existentes:", errEx.message);
    process.exit(1);
  }
  const yaEstan = new Set((existentes ?? []).map((p) => p.slug));
  console.log(`Publicaciones ya en la Tienda: ${yaEstan.size}\n`);

  // ── Migración ──────────────────────────────────────────────────────────────
  let insertadas = 0, saltadas = 0, fallidas = 0;

  for (const n of noticias) {
    const etiqueta = (n.slug ?? "(sin slug)").slice(0, 56);

    if (!n.titulo?.trim() || !n.slug?.trim()) {
      console.log(`  ✗ ${etiqueta} — le falta titulo o slug, se omite`);
      fallidas++;
      continue;
    }

    if (n.titulo.length > TITULAR_MAX) {
      // No se trunca por cuenta propia: el CHECK lo rechazaría y truncar un
      // titular es una decisión editorial, no técnica.
      console.log(`  ✗ ${etiqueta} — titular de ${n.titulo.length} chars, excede ${TITULAR_MAX}`);
      fallidas++;
      continue;
    }

    if (yaEstan.has(n.slug)) {
      console.log(`  · ${etiqueta} — ya existe, se salta`);
      saltadas++;
      continue;
    }

    const fila = {
      artista_id:  editorial.id,
      tipo:        "noticia",
      categoria:   "general",
      titular:     n.titulo,
      bajada:      n.resumen?.trim() || null,
      cuerpo:      agregarArtistasMencionados(n.contenido, n.artista_relacionado),
      // La imagen queda apuntando al bucket del Channel: no se copia el archivo.
      imagen_url:  n.imagen_destacada || null,
      slug:        n.slug,
      estado:      "publicada",
      visibilidad: "publica",
      // Preservar la fecha original importa: es el orden del feed y de la portada.
      created_at:  n.fecha_publicacion,
    };

    if (DRY_RUN) {
      console.log(`  → ${etiqueta} — se insertaría (${n.titulo.length} chars)`);
      insertadas++;
      continue;
    }

    const { error } = await tienda.from("publicaciones").insert(fila);

    if (error) {
      // Una que falle no detiene al resto.
      console.log(`  ✗ ${etiqueta} — ${error.message}`);
      fallidas++;
    } else {
      console.log(`  ✓ ${etiqueta}`);
      insertadas++;
    }
  }

  // ── Resumen ────────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  console.log(`Encontradas: ${noticias.length}`);
  console.log(`Insertadas:  ${insertadas}${DRY_RUN ? " (simulado)" : ""}`);
  console.log(`Saltadas:    ${saltadas} (ya existían)`);
  console.log(`Fallidas:    ${fallidas}`);

  if (fallidas > 0) {
    console.log("\nAlgunas no se migraron. Revisa los mensajes de arriba.");
    process.exit(1);
  }
  console.log("\nListo. Se ven en /noticias.");
}

main().catch((err) => {
  console.error("Error inesperado:", err.message);
  process.exit(1);
});
