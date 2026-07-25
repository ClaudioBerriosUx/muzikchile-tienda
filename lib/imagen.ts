/**
 * Comprime una imagen en el navegador antes de subirla a Supabase Storage.
 *
 * Redimensiona por ancho (solo si el original lo excede; nunca escala hacia
 * arriba), mantiene la proporción y reencoda a JPEG.
 *
 * **Nunca rechaza ni queda colgada.** Ante cualquier fallo devuelve el archivo
 * original sin tocar, para que el llamador siempre pueda continuar y limpiar su
 * estado de "guardando":
 * - el archivo no es una imagen decodificable (corrupto, extensión mentirosa,
 *   SVG malformado) → `onerror`
 * - el canvas no logra producir un blob → callback de `toBlob` con `null`
 *
 * Solo funciona en el cliente: usa Image, canvas y URL.createObjectURL.
 *
 * @param archivo  Archivo de origen (JPG, PNG, WEBP...).
 * @param maxWidth Ancho máximo en px. 400 para avatares, 800 para productos.
 * @param calidad  Calidad JPEG entre 0 y 1.
 * @returns El archivo comprimido, o el original si no se pudo procesar.
 */
export function comprimirImagen(
  archivo: File,
  maxWidth = 800,
  calidad = 0.85
): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(archivo);

    // Sin esto, un archivo corrupto dejaba la promesa pendiente para siempre y
    // el botón de guardar colgado en "Guardando...".
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(archivo);
    };

    img.onload = () => {
      const canvas = document.createElement("canvas");

      let width  = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width  = maxWidth;
      }

      canvas.width  = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { URL.revokeObjectURL(url); resolve(archivo); return; }
          const comprimido = new File(
            [blob],
            archivo.name.replace(/\.[^.]+$/, ".jpg"),
            { type: "image/jpeg" }
          );
          URL.revokeObjectURL(url);
          resolve(comprimido);
        },
        "image/jpeg",
        calidad
      );
    };

    img.src = url;
  });
}
