/**
 * Validación de embeds de Instagram.
 *
 * Sin imports: lo usan `lib/embeds.ts` y, directo con Node pelado,
 * `scripts/verificar-sanitizacion.mjs` (que no resuelve el alias `@/`).
 *
 * Formato canónico guardado en el cuerpo: `[instagram:p/CODIGO]` o
 * `[instagram:reel/CODIGO]`. También se acepta la URL completa del post, que
 * es como venían las noticias migradas del Channel (`[instagram:https://...]`).
 *
 * ⚠️ De la URL pegada solo se rescata el CÓDIGO, validado contra un patrón
 * estricto. La URL del iframe se arma desde cero en `urlInstagram`, así que
 * nada de lo que escriba el usuario llega al `src` salvo letras, números, - y _.
 */

/** Hosts aceptados en una URL pegada. Coincidencia exacta, sin subdominios. */
const HOSTS_INSTAGRAM = ["instagram.com", "www.instagram.com", "m.instagram.com"];

/** Los códigos de post son base64url; se deja holgura en el largo. */
const RE_CODIGO = /^[A-Za-z0-9_-]{5,64}$/;

/** `/tv/` (IGTV) ya no existe como formato propio: se embebe como post. */
const TIPO_EMBED: Record<string, "p" | "reel"> = { p: "p", reel: "reel", tv: "p" };

function normalizar(tipo: string, codigo: string): string | null {
  const t = TIPO_EMBED[tipo];
  return t && RE_CODIGO.test(codigo) ? `${t}/${codigo}` : null;
}

/**
 * Devuelve `"p/CODIGO"` o `"reel/CODIGO"`, o null si no es un post de
 * Instagram reconocible.
 */
export function validarInstagram(bruto: string): string | null {
  const limpio = bruto.trim();

  // Ya viene como "tipo/codigo".
  const yaFormateado = limpio.match(/^(p|reel|tv)\/([^/]+)$/);
  if (yaFormateado) return normalizar(yaFormateado[1], yaFormateado[2]);

  let url: URL;
  try {
    url = new URL(limpio);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password || url.port) return null;
  if (!HOSTS_INSTAGRAM.includes(url.hostname)) return null;

  // /p/CODIGO, /reel/CODIGO, /tv/CODIGO — también /usuario/p/CODIGO, que es
  // como comparte Instagram algunos posts. Query y hash se ignoran.
  const ruta = url.pathname.match(/^\/(?:[A-Za-z0-9._]+\/)?(p|reel|tv)\/([^/]+)\/?$/);
  return ruta ? normalizar(ruta[1], ruta[2]) : null;
}

/** URL del iframe. `valor` tiene que venir de `validarInstagram`. */
export function urlInstagram(valor: string): string {
  return `https://www.instagram.com/${valor}/embed/captioned/`;
}

/** URL pública del post, para el enlace "Ver en Instagram". */
export function urlPostInstagram(valor: string): string {
  return `https://www.instagram.com/${valor}/`;
}
