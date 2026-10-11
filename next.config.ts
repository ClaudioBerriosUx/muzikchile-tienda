import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "rgskspvuvzwmvmsccoez.supabase.co",
      },
      {
        // Supabase del Channel: las noticias migradas siguen sirviendo sus
        // imágenes desde su bucket `blog-images`. Solo lo público de Storage.
        protocol: "https",
        hostname: "yxqhtljhoceopnbcwdiy.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  /**
   * Lanzamiento: www.muzikchile.cl es el dominio canónico. Hereda las URLs del
   * Channel (que antes vivía en www) y de tienda.muzikchile.cl.
   *
   * /, /noticias y /noticias/:slug no necesitan redirect: los paths del Channel
   * coinciden con los de acá y las noticias migradas conservan el slug.
   */
  async redirects() {
    return [
      // tienda.muzikchile.cl → www, salvo /api: las preferencias de MercadoPago
      // creadas antes del cambio tienen la notification_url con el host viejo,
      // y MP no sigue redirecciones en el POST del webhook.
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: "tienda.muzikchile.cl" }],
        destination: "https://www.muzikchile.cl/:path",
        permanent: true,
      },
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
      { source: "/bootstrap-admin", destination: "https://tv.muzikchile.cl/bootstrap-admin", permanent: true },
      { source: "/reset-password",  destination: "https://tv.muzikchile.cl/reset-password",  permanent: true },
      { source: "/admin/settings",  destination: "https://tv.muzikchile.cl/admin/settings",  permanent: true },
      { source: "/admin/instagram", destination: "https://tv.muzikchile.cl/admin/instagram", permanent: true },
      // Las noticias ahora se administran acá. Temporal (302) por si cambia.
      { source: "/admin/noticias/:rest*", destination: "/admin/publicaciones", permanent: false },
    ];
  },
};

export default nextConfig;
