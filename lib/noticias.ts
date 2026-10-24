import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { aTextoPlano } from "@/lib/embeds";

/**
 * Consultas de noticias públicas, server-side.
 *
 * Usa el cliente anon directo (sin cookies) igual que `app/sitemap.ts`: no hace
 * falta sesión para leer publicaciones públicas, y evitar `cookies()` deja que
 * las rutas puedan cachearse en vez de volverse dinámicas por sesión.
 *
 * El RLS `publicaciones_select_publico` ya limita a estado='publicada' +
 * visibilidad='publica'. Los filtros explícitos de acá (los dos) son defensa en
 * profundidad: si alguien afloja la política, estas queries siguen acotadas.
 *
 * ⚠️ **Un error de Supabase LANZA, nunca se devuelve como lista vacía.** El
 * 2026-10-03 un build corrió mientras Supabase se restauraba de una pausa;
 * `traerNoticias` convirtió el error en `[]` y `/` y `/noticias`, que son
 * estáticas, quedaron congeladas diciendo "Todavía no hay noticias". Es el mismo
 * patrón de los bugs silenciosos de cupones y liquidaciones.
 *
 * Lanzar es lo correcto en los dos momentos en que corre esto:
 * - en el build, el deploy falla y sigue vivo el anterior, que estaba bien;
 * - en una regeneración ISR, Next sigue sirviendo la última versión buena y
 *   reintenta en la próxima petición.
 * "Cero noticias" queda reservado para cuando de verdad no hay ninguna.
 */

/**
 * Origen de una nota: `editorial` = redacción MuzikChile (autor con
 * `es_editorial`); `comunidad` = publicada por un artista y aprobada en
 * moderación. Se muestra como badge "Comunidad" en cada nota; desde el
 * 2026-10-22 ya no filtra /noticias (el filtro es `?categoria=`).
 */
export type OrigenNoticia = "editorial" | "comunidad";

/** Autor de una nota, con lo justo para la firma (`components/noticias/FirmaNoticia`). */
export interface AutorNoticia {
  nombre: string;
  slug: string;
  foto_url: string | null;
  es_editorial: boolean;
  verificado: boolean | null;
  /** Artista de prueba: sus notas no salen en los listados y van con noindex. */
  es_prueba: boolean;
}

export interface NoticiaLista {
  id: string;
  titular: string;
  bajada: string | null;
  imagen_url: string | null;
  slug: string;
  categoria: string | null;
  /** Fecha visible y de orden. Solo el admin la edita (ver la migración 20261003205430). */
  fecha_publicacion: string;
  artistas: AutorNoticia | null;
  /**
   * Texto para la tarjeta: la bajada o, si viene vacía, un extracto del cuerpo.
   * Se calcula acá para que el cuerpo completo no viaje a cada tarjeta.
   */
  resumen: string | null;
}

/**
 * `artistas` es el autor. `es_editorial` distingue a la redacción MuzikChile
 * de un artista real: los editoriales no tienen ficha pública, así que su
 * atribución no se enlaza.
 */
export interface NoticiaDetalle extends Omit<NoticiaLista, "resumen"> {
  cuerpo: string | null;
}

/** Origen de una nota. Sin autor (no debería pasar: `artista_id` es NOT NULL) cuenta como editorial. */
export function origenNoticia(n: { artistas: Pick<AutorNoticia, "es_editorial"> | null }): OrigenNoticia {
  return n.artistas && !n.artistas.es_editorial ? "comunidad" : "editorial";
}

// `cuerpo` va solo para armar el extracto de respaldo; no sale en NoticiaLista.
// `!inner` para poder filtrar por `artistas.es_editorial`; no descarta nada,
// porque `publicaciones.artista_id` es NOT NULL.
const CAMPOS_LISTA =
  "id, titular, bajada, cuerpo, imagen_url, slug, categoria, fecha_publicacion, artistas!inner(nombre, slug, foto_url, es_editorial, verificado, es_prueba)";

/** Largo del extracto de respaldo, en caracteres. */
const LARGO_RESUMEN = 160;

const CAMPOS_DETALLE =
  "id, titular, bajada, cuerpo, imagen_url, slug, categoria, fecha_publicacion, artistas(nombre, slug, foto_url, es_editorial, verificado, es_prueba)";

/**
 * La bajada, o un extracto del cuerpo en texto plano si la bajada está vacía
 * (las noticias migradas del Channel suelen venir sin ella). `aTextoPlano`
 * quita HTML y embeds y corta en palabra completa.
 */
export function resumenNoticia(bajada: string | null, cuerpo: string | null): string | null {
  if (bajada?.trim()) return bajada.trim();
  return cuerpo ? aTextoPlano(cuerpo, LARGO_RESUMEN) || null : null;
}

function cliente() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Sin credenciales es un error de configuración, no "cero noticias".
  if (!url || !key) throw new Error("[noticias] faltan NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY");
  return createClient<Database>(url, key);
}

/**
 * Noticias publicadas, más recientes primero: editoriales y de la comunidad
 * mezcladas, salvo que `origen` acote a una de las dos.
 */
export async function traerNoticias(
  { limite, origen }: { limite?: number; origen?: OrigenNoticia } = {}
): Promise<NoticiaLista[]> {
  const supabase = cliente();

  let q = supabase
    .from("publicaciones")
    .select(CAMPOS_LISTA)
    .eq("estado", "publicada")
    .eq("visibilidad", "publica")
    .eq("tipo", "noticia")
    // Las notas de un artista de prueba no salen en /noticias ni en la portada.
    .eq("artistas.es_prueba", false)
    .order("fecha_publicacion", { ascending: false });

  if (origen) q = q.eq("artistas.es_editorial", origen === "editorial");
  if (limite) q = q.limit(limite);

  const { data, error } = await q;
  if (error) {
    console.error("[noticias] error cargando el listado:", error.message);
    throw new Error(`[noticias] error cargando el listado: ${error.message}`);
  }
  return (data ?? []).map(({ cuerpo, ...n }) => ({
    ...n,
    resumen: resumenNoticia(n.bajada, cuerpo),
  }));
}

/**
 * Noticias publicadas de un artista (`publicaciones.artista_id`), más recientes
 * primero. Para la pestaña "Noticias" de /artista/[slug]. Lanza igual que
 * `traerNoticias`: un error no es "este artista no tiene noticias".
 */
export async function traerNoticiasDeArtista(artistaId: string): Promise<NoticiaLista[]> {
  const supabase = cliente();

  const { data, error } = await supabase
    .from("publicaciones")
    .select(CAMPOS_LISTA)
    .eq("artista_id", artistaId)
    .eq("estado", "publicada")
    .eq("visibilidad", "publica")
    .eq("tipo", "noticia")
    .order("fecha_publicacion", { ascending: false });

  if (error) {
    console.error("[noticias] error cargando las noticias del artista:", error.message);
    throw new Error(`[noticias] error cargando las noticias del artista: ${error.message}`);
  }
  return (data ?? []).map(({ cuerpo, ...n }) => ({
    ...n,
    resumen: resumenNoticia(n.bajada, cuerpo),
  }));
}

/**
 * Una noticia por slug. Devuelve null si no existe o no está publicada —
 * el llamador decide si eso es un 404.
 */
export async function traerNoticiaPorSlug(
  slug: string
): Promise<NoticiaDetalle | null> {
  const supabase = cliente();

  const { data, error } = await supabase
    .from("publicaciones")
    .select(CAMPOS_DETALLE)
    .eq("slug", slug)
    .eq("estado", "publicada")
    .eq("visibilidad", "publica")
    .eq("tipo", "noticia")
    // maybeSingle y no single: "no existe" no es un error que haya que loguear.
    .maybeSingle();

  if (error) {
    // Un error no es "no existe": devolver null acá daría un 404 falso.
    console.error("[noticias] error cargando la noticia:", error.message);
    throw new Error(`[noticias] error cargando la noticia: ${error.message}`);
  }
  return data;
}

export function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
