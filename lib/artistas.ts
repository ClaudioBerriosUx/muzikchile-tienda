import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Artista por slug, para las rutas públicas.
 *
 * Envuelto en `cache()` de React: `generateMetadata` y el componente de página
 * corren en el mismo request, así que ambos comparten UNA sola consulta en vez
 * de pegarle dos veces a la base.
 *
 * Devuelve null si no existe — el llamador decide si eso es un 404.
 */
export const traerArtistaPorSlug = cache(async (slug: string) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("artistas")
    .select("id, nombre, slug, bio, foto_url, seo_titulo, seo_descripcion, es_editorial")
    .eq("slug", slug)
    // maybeSingle y no single: "no existe" no es un error que loguear.
    .maybeSingle();

  if (error) {
    console.error("[artistas] error cargando por slug:", error.message);
    return null;
  }
  return data;
});
