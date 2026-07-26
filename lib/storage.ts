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
 * ⚠️ HOY NO BORRA NADA CUANDO LO LLAMA UN ARTISTA. Medido contra el bucket
 * real: con una sesión de artista, `upload` funciona pero `remove` devuelve
 * éxito sin error Y el archivo sigue ahí. Las políticas del bucket `productos`
 * permiten INSERT pero no DELETE a los usuarios autenticados.
 *
 * O sea: las imágenes quedan huérfanas igual. Se deja llamado y listo para
 * cuando se agregue la política; el día que exista, empieza a funcionar solo.
 *
 * TODO: agregar política de DELETE en `storage.objects` para el bucket
 * `productos`, acotada a que la ruta empiece con el id del artista dueño
 * (las rutas son `{artista_id}/publicaciones/...`). Va por migración
 * versionada como cualquier otro cambio de esquema.
 *
 * Es BEST-EFFORT a propósito: nunca lanza. Si falla —por políticas, porque el
 * archivo ya no está, o porque la imagen es externa— la publicación igual se
 * borra de la base.
 *
 * El orden importa: se borra la fila primero y la imagen después. Al revés, un
 * fallo al borrar la fila dejaría una publicación sin su imagen, que es peor
 * que un archivo huérfano.
 *
 * Devuelve true solo si la operación no dio error; ojo que eso NO garantiza que
 * el archivo se haya ido (ver arriba).
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
