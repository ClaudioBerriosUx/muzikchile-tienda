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
 * visibilidad='publica'. Los filtros explícitos de acá son defensa en
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

export interface NoticiaLista {
  id: string;
  titular: string;
  bajada: string | null;
  imagen_url: string | null;
  slug: string;
  categoria: string | null;
  /** Fecha visible y de orden. Solo el admin la edita (ver la migración 20261003205430). */
  fecha_publicacion: string;
  artistas: { nombre: string; slug: string } | null;
  /**
   * Texto para la tarjeta: la bajada o, si viene vacía, un extracto del cuerpo.
   * Se calcula acá para que el cuerpo completo no viaje a cada tarjeta.
   */
  resumen: string | null;
}

export interface NoticiaDetalle extends Omit<NoticiaLista, "resumen"> {
  cuerpo: string | null;
  /**
   * El autor. `es_editorial` distingue a la redacción MuzikChile de un artista
   * real: los editoriales no tienen ficha pública, así que su atribución no se
   * enlaza.
   */
  artistas: {
    nombre: string;
    slug: string;
    foto_url: string | null;
    es_editorial: boolean;
  } | null;
}

// `cuerpo` va solo para armar el extracto de respaldo; no sale en NoticiaLista.
const CAMPOS_LISTA =
  "id, titular, bajada, cuerpo, imagen_url, slug, categoria, fecha_publicacion, artistas(nombre, slug)";

/** Largo del extracto de respaldo, en caracteres. */
const LARGO_RESUMEN = 160;

const CAMPOS_DETALLE =
  "id, titular, bajada, cuerpo, imagen_url, slug, categoria, fecha_publicacion, artistas(nombre, slug, foto_url, es_editorial)";

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

/** Todas las noticias publicadas, más recientes primero. */
export async function traerNoticias(limite?: number): Promise<NoticiaLista[]> {
  const supabase = cliente();

  let q = supabase
    .from("publicaciones")
    .select(CAMPOS_LISTA)
    .eq("estado", "publicada")
    .eq("tipo", "noticia")
    .order("fecha_publicacion", { ascending: false });

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
