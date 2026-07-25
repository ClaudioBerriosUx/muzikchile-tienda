/**
 * URL base pública del sitio, sin barra final.
 *
 * `NEXT_PUBLIC_URL` ya se usa para los `back_urls` de MercadoPago; acá se
 * reutiliza para robots.txt y sitemap.xml. El fallback es el dominio de
 * producción, que es lo que ya estaba hardcodeado en el `generateMetadata` de
 * la ficha de artista.
 */
export const BASE_URL = (
  process.env.NEXT_PUBLIC_URL ?? "https://tienda.muzikchile.cl"
).replace(/\/$/, "");
