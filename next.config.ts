import type { NextConfig } from "next";
import { REMOTE_PATTERNS } from "./lib/imagenes-remotas";

const nextConfig: NextConfig = {
  images: {
    // La lista vive en lib/imagenes-remotas.ts: ImagenNoticia la usa para no
    // pasar por el optimizador una URL de otro host.
    remotePatterns: REMOTE_PATTERNS.map((p) => ({ ...p })),
  },

  /**
   * Lanzamiento: www.muzikchile.cl es el dominio canónico. Hereda las URLs del
   * Channel (que antes vivía en www) y de tienda.muzikchile.cl.
   *
   * tienda.muzikchile.cl no pasa por acá: desde el 2026-10-25 es un redirect
   * de dominio en Vercel (308 → www, /api incluido).
   *
   * /, /noticias y /noticias/:slug no necesitan redirect: los paths del Channel
   * coinciden con los de acá y las noticias migradas conservan el slug.
   */
  async redirects() {
    return [
      // La portada vieja de la tienda filtraba con /?categoria=; hoy / es la
      // portada y el catálogo vive en /tienda.
      {
        source: "/",
        has: [{ type: "query", key: "categoria", value: "(?<cat>.+)" }],
        destination: "/tienda?categoria=:cat",
        permanent: true,
      },
      // Channel: el reproductor sigue en tv. (el Hero de la portada lo embebe).
      { source: "/tv", destination: "https://tv.muzikchile.cl/tv", permanent: true },
      // Channel: utilitarias y admin sin equivalente acá. /admin y
      // /admin/suscriptores no se redirigen: chocan con los de la Tienda.
      // (/admin/instagram tampoco: el Channel lo eliminó.)
      { source: "/bootstrap-admin", destination: "https://tv.muzikchile.cl/bootstrap-admin", permanent: true },
      { source: "/reset-password",  destination: "https://tv.muzikchile.cl/reset-password",  permanent: true },
      { source: "/admin/settings",  destination: "https://tv.muzikchile.cl/admin/settings",  permanent: true },
      // Las noticias ahora se administran acá. Temporal (302) por si cambia.
      { source: "/admin/noticias/:rest*", destination: "/admin/publicaciones", permanent: false },
    ];
  },
};

export default nextConfig;
