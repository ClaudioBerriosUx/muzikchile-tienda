import { idYoutube } from "@/lib/portada";

/**
 * Detección y validación de embeds en el cuerpo de una noticia.
 *
 * Se aceptan dos formatos (los mismos del ContentRenderer del Channel):
 *   1. Shortcode:  [youtube:ID]  [spotify:URL]  [instagram:URL] ...
 *   2. Bloque TipTap: <div data-embed data-type="youtube" data-id="..."></div>
 *
 * ⚠️ Los IDs/URLs NO se confían nunca. Un `data-id` sobrevive a la
 * sanitización de HTML (es un atributo permitido), así que si se interpolara
 * directo en el `src` de un iframe se podría inyectar `javascript:` u otro
 * origen. Cada plataforma valida su ID contra un patrón estricto y construye la
 * URL final desde cero; si no valida, el embed se descarta.
 */

export type TipoEmbed = "youtube" | "spotify" | "instagram" | "tiktok" | "twitter";

export interface Embed {
  tipo: TipoEmbed;
  /** Ya validado y seguro para construir la URL del reproductor. */
  valor: string;
}

const TIPOS: TipoEmbed[] = ["youtube", "spotify", "instagram", "tiktok", "twitter"];

function esTipo(v: string): v is TipoEmbed {
  return (TIPOS as string[]).includes(v);
}

// ── Validadores por plataforma ───────────────────────────────────────────────

/** Los IDs de YouTube son exactamente 11 chars de [A-Za-z0-9_-]. */
function validarYoutube(bruto: string): string | null {
  const limpio = bruto.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(limpio)) return limpio;
  // También se acepta una URL completa.
  return idYoutube(limpio);
}

/**
 * Spotify acepta URL (`open.spotify.com/track/ID`) o URI (`spotify:track:ID`).
 * Devuelve "tipo/id" listo para `/embed/{tipo}/{id}`.
 */
const TIPOS_SPOTIFY = ["track", "album", "playlist", "artist", "episode", "show"];

function validarSpotify(bruto: string): string | null {
  const limpio = bruto.trim();

  const porUri = limpio.match(/^spotify:([a-z]+):([A-Za-z0-9]{22})$/);
  if (porUri && TIPOS_SPOTIFY.includes(porUri[1])) {
    return `${porUri[1]}/${porUri[2]}`;
  }

  const porUrl = limpio.match(
    /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?([a-z]+)\/([A-Za-z0-9]{22})/
  );
  if (porUrl && TIPOS_SPOTIFY.includes(porUrl[1])) {
    return `${porUrl[1]}/${porUrl[2]}`;
  }

  // Ya viene como "tipo/id".
  const yaFormateado = limpio.match(/^([a-z]+)\/([A-Za-z0-9]{22})$/);
  if (yaFormateado && TIPOS_SPOTIFY.includes(yaFormateado[1])) return limpio;

  return null;
}

/**
 * Para las plataformas que aún no tienen reproductor propio, se valida que sea
 * una URL https del dominio esperado y se muestra como enlace.
 */
function validarUrlDe(dominios: string[]) {
  return (bruto: string): string | null => {
    const limpio = bruto.trim();
    try {
      const url = new URL(limpio);
      if (url.protocol !== "https:") return null;
      const host = url.hostname.replace(/^www\./, "");
      return dominios.some((d) => host === d || host.endsWith(`.${d}`))
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  };
}

const VALIDADORES: Record<TipoEmbed, (bruto: string) => string | null> = {
  youtube: validarYoutube,
  spotify: validarSpotify,
  instagram: validarUrlDe(["instagram.com"]),
  tiktok: validarUrlDe(["tiktok.com"]),
  twitter: validarUrlDe(["twitter.com", "x.com"]),
};

export function validarEmbed(tipo: TipoEmbed, bruto: string): Embed | null {
  const valor = VALIDADORES[tipo](bruto);
  return valor ? { tipo, valor } : null;
}

// ── URLs de reproductor ──────────────────────────────────────────────────────

export function urlYoutube(id: string): string {
  return `https://www.youtube.com/embed/${id}?rel=0`;
}

export function urlSpotify(tipoYId: string): string {
  return `https://open.spotify.com/embed/${tipoYId}`;
}

// ── Troceado del cuerpo ──────────────────────────────────────────────────────

/**
 * Un shortcode `[tipo:valor]` o un bloque `<div data-embed ...>`.
 * El valor del shortcode no puede contener `]`.
 */
const RE_EMBED = new RegExp(
  [
    // 1) shortcode
    `\\[(${TIPOS.join("|")}):([^\\]]+)\\]`,
    // 2) bloque TipTap (atributos en cualquier orden)
    `<div[^>]*\\bdata-embed\\b[^>]*><\\/div>`,
  ].join("|"),
  "gi"
);

const RE_DATA_TYPE = /data-type=["']([^"']+)["']/i;
const RE_DATA_ID = /data-id=["']([^"']+)["']/i;

export type Trozo =
  | { clase: "html"; html: string }
  | { clase: "embed"; embed: Embed };

/**
 * Parte el HTML en trozos alternados de HTML y embeds.
 *
 * Los embeds inválidos (ID que no valida, tipo desconocido) se descartan por
 * completo: es preferible un hueco a renderizar un iframe hacia un origen no
 * verificado.
 */
export function trocearContenido(html: string): Trozo[] {
  const trozos: Trozo[] = [];
  let ultimo = 0;

  for (const m of html.matchAll(RE_EMBED)) {
    const indice = m.index ?? 0;

    if (indice > ultimo) {
      trozos.push({ clase: "html", html: html.slice(ultimo, indice) });
    }
    ultimo = indice + m[0].length;

    let embed: Embed | null = null;

    if (m[1] && m[2]) {
      // Shortcode
      const tipo = m[1].toLowerCase();
      if (esTipo(tipo)) embed = validarEmbed(tipo, m[2]);
    } else {
      // Bloque TipTap
      const tipoBruto = m[0].match(RE_DATA_TYPE)?.[1]?.toLowerCase();
      const idBruto = m[0].match(RE_DATA_ID)?.[1];
      if (tipoBruto && idBruto && esTipo(tipoBruto)) {
        embed = validarEmbed(tipoBruto, idBruto);
      }
    }

    if (embed) trozos.push({ clase: "embed", embed });
  }

  if (ultimo < html.length) {
    trozos.push({ clase: "html", html: html.slice(ultimo) });
  }

  return trozos;
}

/**
 * ¿El cuerpo trae HTML, o es texto plano?
 *
 * La noticia que ya existe tiene el cuerpo en texto plano con saltos de línea,
 * así que hay que envolverlo en párrafos en vez de volcarlo tal cual.
 */
export function pareceHtml(texto: string): boolean {
  return /<(p|div|h[1-4]|ul|ol|li|blockquote|img|figure|br|strong|em|a)\b[^>]*>/i.test(
    texto
  );
}

/**
 * Reduce el cuerpo a texto plano legible, para descripciones de metadatos.
 *
 * Sin esto, una noticia sin bajada terminaba con
 * `<meta name="description" content="&lt;p&gt;texto&lt;/p&gt;&lt;p&gt;[youtube:ID]...">`:
 * las etiquetas y los shortcodes salían tal cual en Google y en la tarjeta que
 * se ve al compartir el enlace.
 *
 * Quita shortcodes, bloques de embed, etiquetas y entidades, y colapsa espacios.
 */
export function aTextoPlano(html: string, maxLargo?: number): string {
  const texto = html
    // Los embeds no aportan nada a una descripción.
    .replace(RE_EMBED, " ")
    // <br> y cierres de bloque cuentan como separación.
    .replace(/<\/(p|h[1-4]|li|blockquote|div)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (!maxLargo || texto.length <= maxLargo) return texto;
  // Corta en la última palabra completa para no dejar una sílaba suelta.
  return texto.slice(0, maxLargo).replace(/\s+\S*$/, "") + "…";
}

/** Convierte texto plano a párrafos, respetando los saltos de línea. */
export function textoPlanoAHtml(texto: string): string {
  const escapar = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  return texto
    .split(/\n{2,}/)
    .map((parrafo) => parrafo.trim())
    .filter(Boolean)
    .map((parrafo) => `<p>${escapar(parrafo).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}
