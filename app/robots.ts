import type { MetadataRoute } from "next";
import { BASE_URL } from "@/lib/site";

/**
 * Sirve /robots.txt — pero HOY NO SE SIRVE.
 *
 * ⚠️ Existe `public/robots.txt` con `Disallow: /`, y los archivos estáticos de
 * `public/` tienen precedencia sobre las rutas generadas del App Router. O sea:
 * este archivo está eclipsado y no se ejecuta.
 *
 * Es intencional: ese estático es parte del mismo bloqueo pre-lanzamiento que
 * el noindex global de `app/layout.tsx`. NO lo borres antes de tiempo.
 *
 * El día del lanzamiento hay que hacer LAS DOS COSAS:
 *   1. borrar `public/robots.txt`  (si no, el sitio sigue sin rastrearse)
 *   2. quitar el noindex de `app/layout.tsx`
 * Hacer solo una deja el sitio bloqueado igual, y es un buen rato de
 * depuración averiguar por qué.
 *
 * Disallow ≠ noindex: bloquear el rastreo no impide que una URL enlazada
 * aparezca en el índice. Por eso /panel y /admin además declaran noindex en
 * sus layouts.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/panel", "/admin", "/api"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
