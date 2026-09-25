import type { SupabaseClient } from "@supabase/supabase-js";

/** Bucket donde viven las imágenes de productos y publicaciones. */
const BUCKET = "productos";

/**
 * Extrae la ruta dentro del bucket a partir de una URL pública de Storage.
 *
 * Las URLs tienen la forma:
 *   https://<proj>.supabase.co/storage/v1/object/public/productos/<ruta>
 *
 * Devuelve null si la URL no es de este bucket — así una imagen externa
 * (pegada a mano en el editor) nunca se intenta borrar.
 */
export function rutaDesdeUrlPublica(url: string | null): string | null {
  if (!url) return null;
  const marca = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marca);
  if (i === -1) return null;
  const ruta = url.slice(i + marca.length).split("?")[0];
  return ruta || null;
}

/**
 * Borra la imagen de una publicación del Storage.
 *
 * Las rutas son `{artista_id}/publicaciones/...`. El artista puede borrar solo
 * en carpetas de sus propios `artistas.id` (`productos_delete_own`) y el admin
 * en cualquiera (`productos_admin_delete`). Ver la migración
 * `20260925191923_storage_politicas_por_dueno` y `npm run verificar:rls-storage`
 * (caso f).
 *
 * Ojo: si el RLS no deja borrar, `remove` devuelve éxito sin error y el archivo
 * sigue ahí — Storage no reporta el rechazo. Así estuvo roto hasta 2026-09-25.
 *
 * Es BEST-EFFORT a propósito: nunca lanza. Si falla —por políticas, porque el
 * archivo ya no está, o porque la imagen es externa— la publicación igual se
 * borra de la base.
 *
 * El orden importa: se borra la fila primero y la imagen después. Al revés, un
 * fallo al borrar la fila dejaría una publicación sin su imagen, que es peor
 * que un archivo huérfano.
 *
 * Devuelve true solo si la operación no dio error; eso NO garantiza que el
 * archivo se haya ido (ver arriba).
 */
export async function borrarImagenDePublicacion(
  supabase: SupabaseClient,
  imagenUrl: string | null
): Promise<boolean> {
  const ruta = rutaDesdeUrlPublica(imagenUrl);
  if (!ruta) return false;

  try {
    const { error } = await supabase.storage.from(BUCKET).remove([ruta]);
    if (error) {
      // No se le muestra al usuario: la publicación ya se borró bien.
      console.warn("[storage] no se pudo borrar la imagen:", ruta, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[storage] error inesperado al borrar la imagen:", err);
    return false;
  }
}
