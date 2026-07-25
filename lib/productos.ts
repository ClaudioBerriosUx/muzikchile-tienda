import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Producto por id, para la ficha pública.
 *
 * Envuelto en `cache()` de React: `generateMetadata` y el componente de página
 * comparten una sola consulta por request.
 *
 * Devuelve null tanto si el producto no existe como si el id no es un UUID
 * válido. Ese segundo caso NO es un fallo a reportar: `/producto/no-existe`
 * hace que Postgres responda 22P02 (invalid input syntax for type uuid), y
 * para el visitante es exactamente lo mismo que un producto inexistente.
 */
export const traerProductoPorId = cache(async (id: string) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre, descripcion, imagenes, precio, artistas(nombre, slug)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    // 22P02 = el id no tiene forma de UUID. Se trata como "no existe".
    if (error.code !== "22P02") {
      console.error("[productos] error cargando por id:", error.message);
    }
    return null;
  }
  return data;
});
