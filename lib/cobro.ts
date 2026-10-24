import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Cómo cobra cada artista. Regla única: la usan cotizar, crear-preferencia,
 * /api/mp/conexion y la ficha de producto.
 *
 *   - 'centralizado' → el pago entra a la cuenta de MuzikChile y después se le
 *                      liquida al artista (como siempre).
 *   - 'marketplace'  → el artista cobra con su propia cuenta de MP (la que
 *                      conectó en /panel/cobros) y MuzikChile recibe su
 *                      comisión como marketplace_fee. No pasa por liquidaciones.
 *
 * Es 'marketplace' si app_settings.cobro_modelo = 'marketplace' (todos) o si
 * el artista está en app_settings.marketplace_piloto (lista JSON de ids). Con
 * el piloto vacío y el modelo en 'centralizado', todo sigue igual que antes.
 */

export type ModoCobro = "centralizado" | "marketplace";

export interface ConfigCobro {
  modelo: ModoCobro;
  piloto: ReadonlySet<string>;
}

/** Lista de ids del piloto. Un valor mal escrito cuenta como vacío (todo centralizado). */
function leerPiloto(valor: string | null | undefined): Set<string> {
  if (!valor) return new Set();
  try {
    const lista: unknown = JSON.parse(valor);
    if (Array.isArray(lista) && lista.every((id) => typeof id === "string")) return new Set(lista);
  } catch {
    // cae al error de abajo
  }
  console.error("[cobro] app_settings.marketplace_piloto no es una lista JSON de ids; se ignora:", valor);
  return new Set();
}

/** Requiere service role: app_settings solo la lee un admin. */
export async function leerConfigCobro(servicio: SupabaseClient<Database>): Promise<ConfigCobro> {
  const { data, error } = await servicio
    .from("app_settings")
    .select("key, value")
    .in("key", ["cobro_modelo", "marketplace_piloto"]);
  // Un error acá no puede convertirse en "todo centralizado" en silencio: un
  // artista del piloto cobraría a la cuenta de MuzikChile sin que nadie lo note.
  if (error) throw new Error(`[cobro] no se pudo leer la configuración: ${error.message}`);

  const valores = new Map((data ?? []).map(({ key, value }) => [key, value]));
  return {
    modelo: valores.get("cobro_modelo") === "marketplace" ? "marketplace" : "centralizado",
    piloto: leerPiloto(valores.get("marketplace_piloto")),
  };
}

export function modoCobro(config: ConfigCobro, artistaId: string): ModoCobro {
  return config.modelo === "marketplace" || config.piloto.has(artistaId) ? "marketplace" : "centralizado";
}
