import type { MetadataRoute } from "next";
import { BASE_URL } from "@/lib/site";

/**
 * Sirve /robots.txt. No agregues un `public/robots.txt`: este archivo es la
 * única fuente (hubo uno con `Disallow: /` hasta el lanzamiento, y producción
 * servía este de todas formas).
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
