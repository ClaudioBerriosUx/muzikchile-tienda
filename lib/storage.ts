import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Buckets donde pueden vivir las imágenes de publicaciones:
 * - `productos`: las de artistas, en `{artistas.id}/publicaciones/...`
 * - `noticias`: las que sube el admin desde el formulario editorial
 */
const BUCKETS = ["productos", "noticias"] as const;
type Bucket = (typeof BUCKETS)[number];

/**
 * Extrae bucket y ruta a partir de una URL pública de Storage.
 *
 * Las URLs tienen la forma:
 *   https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<ruta>
 *
 * Devuelve null si la URL no es de uno de estos buckets — así una imagen
 * externa (pegada a mano en el formulario) nunca se intenta borrar.
 */
export function rutaDesdeUrlPublica(
  url: string | null
): { bucket: Bucket; ruta: string } | null {
  if (!url) return null;
  for (const bucket of BUCKETS) {
    const marca = `/storage/v1/object/public/${bucket}/`;
    const i = url.indexOf(marca);
    if (i === -1) continue;
    const ruta = url.slice(i + marca.length).split("?")[0];
    return ruta ? { bucket, ruta } : null;
  }
  return null;
}

/**
 * Borra la imagen de una publicación del Storage.
 *
 * Las rutas son `productos/{artista_id}/publicaciones/...` o, en las notas
 * editoriales subidas desde el admin, `noticias/<archivo>` (solo admin; ver
 * `20261014212954_bucket_noticias`). El artista puede borrar solo
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
  const destino = rutaDesdeUrlPublica(imagenUrl);
  if (!destino) return false;
  const { bucket, ruta } = destino;

  try {
    const { error } = await supabase.storage.from(bucket).remove([ruta]);
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

/**
 * Comprobantes de liquidación: bucket `comprobantes`, PRIVADO (muestra datos
 * bancarios). Ver la migración `20261025230000_bucket_comprobantes_privado`.
 * `liquidaciones.comprobante_url` guarda la ruta dentro del bucket, nunca una
 * URL pública.
 */
const BUCKET_COMPROBANTES = "comprobantes";
const SEGUNDOS_URL_FIRMADA = 60;

/** Ruta del comprobante: `{artistas.id}/<timestamp>-<nombre-limpio>`. */
export function rutaComprobante(artistaId: string, archivo: File): string {
  const limpio = archivo.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-80) || "comprobante";
  return `${artistaId}/${Date.now()}-${limpio}`;
}

export async function subirComprobante(supabase: SupabaseClient, ruta: string, archivo: File) {
  return supabase.storage
    .from(BUCKET_COMPROBANTES)
    .upload(ruta, archivo, { cacheControl: "60", upsert: false });
}

/**
 * Abre el comprobante en una pestaña nueva con una URL firmada de 60 s. La
 * pestaña se abre antes del await: abrirla después del await la bloquean los
 * navegadores como popup. Lanza si las políticas no dejan leerlo.
 */
export async function abrirComprobante(supabase: SupabaseClient, ruta: string) {
  const pestana = window.open("", "_blank");
  if (pestana) pestana.opener = null;
  const { data, error } = await supabase.storage
    .from(BUCKET_COMPROBANTES)
    .createSignedUrl(ruta, SEGUNDOS_URL_FIRMADA);
  if (error || !data?.signedUrl) {
    pestana?.close();
    throw error ?? new Error("No se pudo firmar la URL del comprobante");
  }
  if (pestana) pestana.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}
