import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { BASE_URL } from "@/lib/site";

/** Se regenera cada hora: los artistas nuevos no deberían esperar a un deploy. */
export const revalidate = 3600;

/**
 * Sirve /sitemap.xml.
 *
 * Solo entran artistas con `tienda_activa` o `verificado`: los perfiles recién
 * creados (el layout de /panel crea una fila en `artistas` al primer login)
 * están vacíos y no aportan nada al índice.
 *
 * Usa el cliente anon directo en vez de `lib/supabase/server`: no hace falta
 * sesión para leer perfiles públicos, y evitar `cookies()` deja que la ruta se
 * cachee con el `revalidate` de arriba en vez de volverse dinámica.
 *
 * Igual que robots.ts, esto no surte efecto hasta que se quite el noindex
 * global de `app/layout.tsx` en el lanzamiento.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const estaticas: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      // TODO: /tienda todavía no existe — se crea al mover el catálogo fuera de la home.
      url: `${BASE_URL}/tienda`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: artistas, error } = await supabase
    .from("artistas")
    .select("slug, created_at")
    .or("tienda_activa.eq.true,verificado.eq.true")
    .order("created_at", { ascending: false });

  if (error) {
    // Un sitemap incompleto es preferible a un build roto.
    console.error("[sitemap] error consultando artistas:", error.message);
    return estaticas;
  }

  const fichas: MetadataRoute.Sitemap = (artistas ?? [])
    .filter((a) => Boolean(a.slug))
    .map((a) => ({
      url: `${BASE_URL}/artista/${a.slug}`,
      lastModified: a.created_at ? new Date(a.created_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  return [...estaticas, ...fichas];
}
