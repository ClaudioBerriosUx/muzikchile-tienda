/**
 * URL base pública del sitio, sin barra final.
 *
 * `NEXT_PUBLIC_URL` ya se usa para los `back_urls` de MercadoPago; acá se
 * reutiliza para robots.txt, sitemap.xml y las URLs de OpenGraph. El fallback
 * es el dominio canónico de producción (www; muzikchile.cl y
 * tienda.muzikchile.cl redirigen ahí).
 */
export const BASE_URL = (
  process.env.NEXT_PUBLIC_URL ?? "https://www.muzikchile.cl"
).replace(/\/$/, "");

/**
 * Casilla pública de contacto (reenviada con Cloudflare Email Routing). La usan
 * /contacto y /privacidad: si cambia, cambia en un solo lugar.
 */
export const CORREO_CONTACTO = "hola@muzikchile.cl";
