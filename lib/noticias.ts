import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

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
 */

export interface NoticiaLista {
  id: string;
  titular: string;
  bajada: string | null;
  imagen_url: string | null;
  slug: string;
  categoria: string | null;
  created_at: string;
  artistas: { nombre: string; slug: string } | null;
}

export interface NoticiaDetalle extends NoticiaLista {
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

const CAMPOS_LISTA =
  "id, titular, bajada, imagen_url, slug, categoria, created_at, artistas(nombre, slug)";

const CAMPOS_DETALLE =
  "id, titular, bajada, cuerpo, imagen_url, slug, categoria, created_at, artistas(nombre, slug, foto_url, es_editorial)";

function cliente() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key);
}

/** Todas las noticias publicadas, más recientes primero. */
export async function traerNoticias(limite?: number): Promise<NoticiaLista[]> {
  const supabase = cliente();
  if (!supabase) return [];

  let q = supabase
    .from("publicaciones")
    .select(CAMPOS_LISTA)
    .eq("estado", "publicada")
    .eq("tipo", "noticia")
    .order("created_at", { ascending: false });

  if (limite) q = q.limit(limite);

  const { data, error } = await q;
  if (error) {
    // Un feed vacío es preferible a una página caída.
    console.error("[noticias] error cargando el listado:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Una noticia por slug. Devuelve null si no existe o no está publicada —
 * el llamador decide si eso es un 404.
 */
export async function traerNoticiaPorSlug(
  slug: string
): Promise<NoticiaDetalle | null> {
  const supabase = cliente();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("publicaciones")
    .select(CAMPOS_DETALLE)
    .eq("slug", slug)
    .eq("estado", "publicada")
    .eq("tipo", "noticia")
    // maybeSingle y no single: "no existe" no es un error que haya que loguear.
    .maybeSingle();

  if (error) {
    console.error("[noticias] error cargando la noticia:", error.message);
    return null;
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
