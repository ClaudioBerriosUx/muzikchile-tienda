/**
 * Tokens de la portada, calcados del diseño del Channel.
 *
 * Están hardcodeados a propósito: son los valores exactos del original, no un
 * sistema de diseño derivado. No inventar variantes ni "normalizarlos" contra
 * la paleta de la tienda (#e8003d), que es otra cosa.
 */
export const C = {
  negro:        "#000000",
  negroSuave:   "#0a0a0a",
  borde:        "#1a1a1a",
  rojo:         "#CC0000",
  rojoAcento:   "#FF2200",
  rojoClaro:    "#FF4444",
  gris:         "#888888",
  grisTenue:    "#555555",
  grisClaro:    "#CCCCCC",
  blanco:       "#ffffff",
} as const;

/** Familias tipográficas vía las CSS variables que define `app/layout.tsx`. */
export const F = {
  bebas:   "var(--font-bebas), sans-serif",
  oswald:  "var(--font-oswald), sans-serif",
  dmSans:  "var(--font-dm-sans), sans-serif",
  barlowC: "var(--font-barlow-condensed), sans-serif",
} as const;

/**
 * Extrae el id de YouTube de una URL.
 *
 * Cubre las formas que guarda el Channel en `videos.videourl`:
 *   youtube.com/watch?v=ID · youtu.be/ID · youtube.com/embed/ID · /shorts/ID
 */
export function idYoutube(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

/** Portada de máxima calidad; si no existe, el <img> cae a hqdefault. */
export function thumbYoutube(id: string): string {
  return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
}

export function thumbYoutubeFallback(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}
