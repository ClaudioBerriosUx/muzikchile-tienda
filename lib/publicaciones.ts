/** Categorías válidas para publicaciones de tipo 'noticia'. */
export const CATEGORIAS_NOTICIA = [
  { value: "lanzamiento", label: "Lanzamiento" },
  { value: "show",        label: "Show" },
  { value: "prensa",      label: "Prensa" },
  { value: "general",     label: "General" },
] as const;

export type CategoriaNoticia = (typeof CATEGORIAS_NOTICIA)[number]["value"];

export const CATEGORIA_VALUES = CATEGORIAS_NOTICIA.map((c) => c.value) as [
  CategoriaNoticia,
  ...CategoriaNoticia[],
];

export function etiquetaCategoria(value: string | null): string {
  return CATEGORIAS_NOTICIA.find((c) => c.value === value)?.label ?? "—";
}

/** Máximo del titular. Coincide con el CHECK de la columna en la DB. */
export const TITULAR_MAX = 80;

function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[áàäâã]/g, "a").replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i").replace(/[óòöôõ]/g, "o")
    .replace(/[úùüû]/g, "u").replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slug para la URL pública, ej: "nuevo-single-de-la-banda-a3f2".
 *
 * Lleva sufijo aleatorio de 4 caracteres porque `publicaciones.slug` es UNIQUE:
 * dos artistas pueden titular igual, y un mismo artista puede repetir titular.
 * Sin el sufijo, el segundo insert falla con violación de unicidad.
 *
 * No es editable por el usuario.
 */
export function generarSlug(titular: string): string {
  const base = slugify(titular).slice(0, 60) || "publicacion";
  const sufijo = Math.random().toString(36).slice(2, 6);
  return `${base}-${sufijo}`;
}

/** Estados en los que el artista todavía puede editar (coincide con el RLS). */
export const ESTADOS_EDITABLES = ["borrador", "devuelta"] as const;

export function esEditable(estado: string): boolean {
  return (ESTADOS_EDITABLES as readonly string[]).includes(estado);
}
