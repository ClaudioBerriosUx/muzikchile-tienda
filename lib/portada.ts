/**
 * Tokens de marca de MuzikChile — el sistema al que migra todo el sitio.
 *
 * Apuntan a las CSS variables de `app/globals.css`, que son la fuente de
 * verdad: acá NO va ningún hex. Este objeto existe solo porque el proyecto
 * estila mucho inline (`style={{ color: ... }}`), donde no se pueden usar
 * clases de Tailwind; es el mismo puente que ya usa `F` para las tipografías.
 *
 * Semántica (ver el bloque de comentarios en `globals.css`):
 *   ROJO = acción y marca · AZUL = información
 *
 * ⚠️ Definidos, todavía no aplicados. `C` (abajo) sigue vigente en la portada
 * y `#e8003d` en la tienda; reemplazarlos es una tanda aparte.
 */
export const MARCA = {
  /** Rojo de marca del logo. Identidad: franjas, sellos, titulares. */
  rojo:         "var(--brand-rojo)",
  /** Rojo vivo de interacción: botones, hover, foco, acentos urgentes. */
  rojoAccion:   "var(--brand-rojo-accion)",
  /** Azul marino del logo. Contrapeso del rojo en fondos de marca. */
  azul:         "var(--brand-azul)",
  /** Acento informativo: "ver más", verificado, chips de categoría. */
  azulInfo:     "var(--brand-azul-info)",
  /** Celeste de apoyo: destacados livianos, gráficos. */
  azulCeleste:  "var(--brand-azul-celeste)",

  /** Fondo base de la página, casi negro. */
  bgBase:       "var(--bg-base)",
  /** Superficie elevada: secciones, barras, contenedores. */
  bgSuperficie: "var(--bg-superficie)",
  /** Superficie de tarjeta: lo que flota sobre todo. */
  bgTarjeta:    "var(--bg-tarjeta)",
  /** Borde y separadores entre superficies. */
  borde:        "var(--borde)",

  /** Texto principal sobre fondo oscuro. */
  texto:        "var(--texto-principal)",
  /** Texto secundario: bajadas, metadatos, labels. */
  textoSec:     "var(--texto-secundario)",
  /** Texto tenue: placeholders, deshabilitados, pies de foto. */
  textoTenue:   "var(--texto-tenue)",
} as const;

/**
 * Tokens de la portada, calcados del diseño del Channel.
 *
 * Están hardcodeados a propósito: son los valores exactos del original, no un
 * sistema de diseño derivado. No inventar variantes ni "normalizarlos" contra
 * la paleta de la tienda (#e8003d), que es otra cosa.
 *
 * 🔜 Paleta heredada: la migración a `MARCA` (arriba) los va a ir reemplazando.
 * Para código nuevo usar `MARCA`, no `C`.
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

/**
 * Los DOS roles tipográficos del sitio, vía los tokens de `app/globals.css`.
 *
 * Acá NO va una familia literal: `--font-titulo` y `--font-body` son la fuente
 * de verdad, y este objeto solo existe para el código que estila inline
 * (`style={{ fontFamily: F.body }}`), donde no entran clases de Tailwind.
 *
 * `titulo` es para elementos de display que NO son h1–h4 (un logotipo, un
 * número gigante). Los headings reales no necesitan declararlo: la regla de
 * `@layer base` ya los pone en Anton.
 */
export const F = {
  /** Anton — titulares y display. Un solo peso: nunca acompañar de bold. */
  titulo: "var(--font-titulo)",
  /** DM Sans — cuerpo, UI, todo lo que no sea titular. */
  body:   "var(--font-body)",
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
