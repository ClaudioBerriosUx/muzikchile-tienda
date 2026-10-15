import type { SupabaseClient } from "@supabase/supabase-js";
import { comprimirImagen } from "@/lib/imagen";

/**
 * Subida de imágenes de publicaciones. La usan el campo de portada de
 * PublicacionForm (admin) y el botón/pegar/arrastrar de EditorContenido (admin
 * y artista), así que las reglas viven en un solo lugar.
 *
 * Destinos (ver `destinoImagenPublicacion`):
 * - admin → bucket `noticias`, raíz (solo admin, migración 20261014212954)
 * - artista → bucket `productos`, `{artistas.id}/publicaciones/`: la misma
 *   carpeta de su portada; `productos_insert_own` exige que la primera carpeta
 *   sea un artistas.id suyo (migración 20260925191923)
 *
 * Solo funciona en el cliente (comprimirImagen usa canvas).
 */

export const BUCKET_NOTICIAS = "noticias";

export interface DestinoImagen {
  bucket: string;
  /** Carpeta dentro del bucket, sin barras al borde. Vacía = raíz. */
  carpeta?: string;
}

export function destinoImagenPublicacion(
  modo: "artista" | "editorial",
  artistaId: string
): DestinoImagen {
  return modo === "editorial"
    ? { bucket: BUCKET_NOTICIAS }
    : { bucket: "productos", carpeta: `${artistaId}/publicaciones` };
}
export const TIPOS_IMAGEN_NOTICIA = ["image/jpeg", "image/png", "image/webp"];
export const ACCEPT_IMAGEN_NOTICIA = TIPOS_IMAGEN_NOTICIA.join(",");
export const MAX_BYTES_IMAGEN_NOTICIA = 5 * 1024 * 1024;

/** "Afiche Lollapalooza (final).JPG" → "afiche-lollapalooza-final.jpg" */
export function limpiarNombreArchivo(nombre: string): string {
  const punto = nombre.lastIndexOf(".");
  const base = punto > 0 ? nombre.slice(0, punto) : nombre;
  const ext = punto > 0 ? nombre.slice(punto + 1).toLowerCase() : "jpg";
  const limpio = base
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // tildes y diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${limpio || "imagen"}.${ext.replace(/[^a-z0-9]/g, "") || "jpg"}`;
}

/** Texto alternativo por defecto: "afiche_lolla-2026.png" → "afiche lolla 2026". */
export function altDesdeNombre(nombre: string): string {
  return nombre
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Valida (JPG/PNG/WEBP, máx. 5 MB), comprime a 1200px JPEG, sube y devuelve
 * la URL pública. Lanza un Error con un mensaje listo para mostrar.
 */
export async function subirImagenNoticia(
  supabase: SupabaseClient,
  archivo: File,
  { bucket, carpeta }: DestinoImagen = { bucket: BUCKET_NOTICIAS }
): Promise<string> {
  if (!TIPOS_IMAGEN_NOTICIA.includes(archivo.type)) {
    throw new Error("Formato no permitido. Usa JPG, PNG o WEBP.");
  }
  if (archivo.size > MAX_BYTES_IMAGEN_NOTICIA) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1);
    throw new Error(`La imagen pesa ${mb} MB. El máximo es 5 MB.`);
  }

  // 1200px: las noticias se muestran a ancho completo. Reencoda a JPEG.
  const comprimido = await comprimirImagen(archivo, 1200, 0.85);
  const nombre = `${Date.now()}-${limpiarNombreArchivo(comprimido.name)}`;
  const path = carpeta ? `${carpeta}/${nombre}` : nombre;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, comprimido, { cacheControl: "3600", upsert: false });
  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}
