/**
 * Videos que los artistas envían para el Channel (tv.muzikchile.cl). Regla
 * única: la usan el formulario de /panel/videos y el "Copiar JSON" de
 * /admin/videos.
 *
 * La base exige lo mismo con CHECK (migración 20261108050000; el de Spotify se
 * sacó en 20261108060000): esto normaliza para que lo que se envía ya calce, y
 * para dar un mensaje claro antes.
 */

export const MAX_TAGS = 5;
export const MAX_LARGO_TAG = 30;
export const MAX_TITULO = 200;
export const MAX_UBICACION = 100;

// ── YouTube ──────────────────────────────────────────────────────────────────

const HOSTS_YOUTUBE = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);
const ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * El id de un link de YouTube, o null. Revisa el dominio (no acepta
 * "notyoutube.com/watch?v=…"). Acepta watch?v=, youtu.be/, embed/, shorts/ y live/.
 */
export function idDeYoutube(texto: string): string | null {
  let url: URL;
  try {
    url = new URL(texto.trim().replace(/^(?!https?:\/\/)/i, "https://"));
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (HOSTS_YOUTUBE.has(host)) {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else id = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)?.[1] ?? null;
  }
  return id && ID.test(id) ? id : null;
}

/** La forma que guarda el Channel (todas sus filas usan esta). */
export function urlDeYoutube(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

// ── Spotify ──────────────────────────────────────────────────────────────────

/**
 * El link de Spotify del artista, libre (2026-11-08, decisión de Claudio: no se
 * rechaza ningún formato). Solo saca espacios sobrantes y, si es un link con
 * ?si=… (el código de seguimiento de "Compartir"), quita ese parámetro.
 * Vacío → null (es opcional).
 */
export function limpiarSpotify(texto: string | null | undefined): string | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  try {
    const url = new URL(t);
    if (!url.searchParams.has("si")) return t;
    url.searchParams.delete("si");
    return url.toString().replace(/\?$/, "");
  } catch {
    return t; // No es una URL completa (p. ej. sin https://): va tal cual.
  }
}

// ── Géneros ──────────────────────────────────────────────────────────────────

/**
 * Géneros libres: separa por coma, saca espacios sobrantes (también los dobles
 * de adentro), descarta vacíos y repetidos sin distinguir mayúsculas (queda la
 * primera forma escrita). No corta: si sobran o son largos, `errorTags` lo dice.
 */
export function normalizarTags(entrada: string | string[]): string[] {
  const partes = Array.isArray(entrada) ? entrada.flatMap((t) => t.split(",")) : entrada.split(",");
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const p of partes) {
    const t = p.replace(/\s+/g, " ").trim();
    if (!t || vistos.has(t.toLowerCase())) continue;
    vistos.add(t.toLowerCase());
    salida.push(t);
  }
  return salida;
}

export function errorTags(tags: string[]): string | null {
  if (tags.length > MAX_TAGS) return `Máximo ${MAX_TAGS} géneros.`;
  const largo = tags.find((t) => t.length > MAX_LARGO_TAG);
  if (largo) return `"${largo}" es muy largo (máximo ${MAX_LARGO_TAG} caracteres).`;
  return null;
}

// ── JSON del Channel ─────────────────────────────────────────────────────────

/** "Nombre" o "Nombre Ft. Colaboración". */
export function textoArtista(nombre: string, colaboracion: string | null | undefined): string {
  const c = colaboracion?.trim();
  return c ? `${nombre.trim()} Ft. ${c}` : nombre.trim();
}

/** Una fila del Import JSON del Channel. Las claves van en este orden. */
export interface FilaImportChannel {
  tracktitle: string;
  trackLink: "";
  album: "";
  albumLink: "";
  artist: string;
  artistLink: string;
  ubicacion: string;
  labelLink: "";
  publisher: "";
  videourl: string;
  videotype: "video/youtube";
  tags: string[];
}

export function aJsonChannel(v: {
  tracktitle: string;
  artista_nombre: string;
  colaboracion: string | null;
  artist_link: string | null;
  ubicacion: string;
  youtube_id: string;
  tags: string[];
}): FilaImportChannel {
  return {
    tracktitle: v.tracktitle,
    trackLink: "",
    album: "",
    albumLink: "",
    artist: textoArtista(v.artista_nombre, v.colaboracion),
    artistLink: v.artist_link ?? "",
    ubicacion: v.ubicacion,
    labelLink: "",
    publisher: "",
    videourl: urlDeYoutube(v.youtube_id),
    videotype: "video/youtube",
    tags: v.tags,
  };
}
