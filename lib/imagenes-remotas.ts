/**
 * Hosts de imágenes permitidos. Lo importan `next.config.ts`
 * (images.remotePatterns), `ImagenNoticia` y `lib/sanitizar.ts` (el `src` de
 * las <img> del cuerpo de una noticia), para que la lista viva en un solo lugar.
 *
 * Sin imports: este archivo lo cargan next.config.ts y, vía sanitizar.ts, el
 * script de verificación con Node pelado.
 */
export const REMOTE_PATTERNS = [
  {
    // Supabase de la tienda. Solo lo público de Storage: todas las imágenes
    // salen de getPublicUrl; /auth, /rest, /storage/v1/object/sign quedan fuera.
    protocol: "https",
    hostname: "rgskspvuvzwmvmsccoez.supabase.co",
    pathname: "/storage/v1/object/public/**",
  },
  {
    // Supabase del Channel: las noticias migradas siguen sirviendo sus
    // imágenes desde su bucket `blog-images`. Solo lo público de Storage.
    protocol: "https",
    hostname: "yxqhtljhoceopnbcwdiy.supabase.co",
    pathname: "/storage/v1/object/public/**",
  },
] as const;

/**
 * true si `src` puede pasar por el optimizador. Una URL de otro host (pegada a
 * mano en el formulario de noticias) hace que next/image lance un error y
 * tumbe la página entera; con `unoptimized` se sirve tal cual.
 */
export function esOptimizable(src: string): boolean {
  try {
    const url = new URL(src);
    return REMOTE_PATTERNS.some(
      (p) =>
        url.protocol === `${p.protocol}:` &&
        url.hostname === p.hostname &&
        url.port === "" &&
        url.pathname.startsWith(p.pathname.replace(/\*\*$/, ""))
    );
  } catch {
    return false;
  }
}
