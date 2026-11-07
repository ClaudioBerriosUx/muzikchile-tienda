import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Freno de ventas del piloto. Regla única: la usan crear-preferencia, que es lo
 * que de verdad impide cobrar, y la ficha de producto, que muestra "Pronto
 * disponible".
 *
 * Falla cerrado: solo abre con app_settings.ventas_abiertas = 'true'. Una fila
 * ausente o un valor mal escrito deja las ventas cerradas, y quien llama trata un
 * error de lectura igual.
 *
 * ventas_correos_autorizados es la excepción para la compra controlada. El correo
 * es el que escribe el comprador, sin verificar: sirve para el piloto, no como
 * control de acceso.
 */

export interface ConfigVentas {
  abiertas: boolean;
  correos: ReadonlySet<string>;
}

const normalizar = (correo: string) => correo.trim().toLowerCase();

function leerCorreos(valor: string | null | undefined): Set<string> {
  if (!valor) return new Set();
  try {
    const lista: unknown = JSON.parse(valor);
    if (Array.isArray(lista) && lista.every((c) => typeof c === "string")) return new Set(lista.map(normalizar));
  } catch {
    // cae al error de abajo
  }
  console.error("[ventas] app_settings.ventas_correos_autorizados no es una lista JSON de correos; se ignora");
  return new Set();
}

/** Requiere service role: app_settings solo la lee un admin. */
export async function leerConfigVentas(servicio: SupabaseClient<Database>): Promise<ConfigVentas> {
  const { data, error } = await servicio
    .from("app_settings")
    .select("key, value")
    .in("key", ["ventas_abiertas", "ventas_correos_autorizados"]);
  if (error) throw new Error(`[ventas] no se pudo leer la configuración: ${error.message}`);

  const valores = new Map((data ?? []).map(({ key, value }) => [key, value]));
  return {
    abiertas: valores.get("ventas_abiertas") === "true",
    correos: leerCorreos(valores.get("ventas_correos_autorizados")),
  };
}

export function puedeComprar(config: ConfigVentas, correo: string): boolean {
  return config.abiertas || config.correos.has(normalizar(correo));
}

export const MENSAJE_VENTAS_CERRADAS =
  "MuzikChile está en marcha blanca y las compras aún no están abiertas. Vuelve pronto.";
