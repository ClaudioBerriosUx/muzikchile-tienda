import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Qué formas de entrega ofrece una tienda y cuánto cuestan. Regla única: la
 * usan lib/checkout/cotizar.ts (lo que se cobra) y la ficha de producto (lo que
 * se muestra antes de agregar al carrito).
 *
 * El costo de envío es fijo por pedido de cada artista, para todo Chile, y no
 * paga comisión (términos para artistas, punto 4).
 *
 * Una opción se ofrece solo si está completa, con el mismo criterio que
 * checklist_tienda. Una tienda sin ninguna opción completa (los artistas
 * anteriores al flujo de tiendas) se cobra como antes: envío sin costo y sin
 * plazo. El commit 9 lo cierra al exigir tienda activa para vender.
 */

export type Entrega = "envio" | "retiro";

export interface OpcionesDespacho {
  envio: { costo: number; plazo_min: number | null; plazo_max: number | null } | null;
  retiro: { detalle: string } | null;
  /** false: la tienda no tiene despacho definido y se usa el envío sin costo. */
  configurado: boolean;
  /** Correo de contacto para compradores; null si la tienda no lo definió. */
  contacto: string | null;
}

export type FilaDespacho = Pick<Database["public"]["Tables"]["tiendas"]["Row"], "despacho_modo" | "despacho_costo" | "despacho_plazo_min" | "despacho_plazo_max" | "retiro_detalle" | "contacto_email">;

export function opcionesDespacho(t: FilaDespacho | null | undefined): OpcionesDespacho {
  const modo = t?.despacho_modo ?? null;
  const conEnvio = (modo === "envio" || modo === "ambos") && t?.despacho_costo != null && t.despacho_plazo_max != null;
  const detalle = t?.retiro_detalle?.trim() ?? "";
  const conRetiro = (modo === "retiro" || modo === "ambos") && detalle !== "";
  const contacto = t?.contacto_email ?? null;

  if (!conEnvio && !conRetiro) {
    return { envio: { costo: 0, plazo_min: null, plazo_max: null }, retiro: null, configurado: false, contacto };
  }
  return {
    envio: conEnvio ? { costo: t!.despacho_costo!, plazo_min: t!.despacho_plazo_min, plazo_max: t!.despacho_plazo_max } : null,
    retiro: conRetiro ? { detalle } : null,
    configurado: true,
    contacto,
  };
}

/** Las formas que ofrece, envío primero: es la que se usa si el comprador no elige. */
export function entregasDisponibles(o: OpcionesDespacho): Entrega[] {
  return [...(o.envio ? (["envio"] as const) : []), ...(o.retiro ? (["retiro"] as const) : [])];
}

/** Requiere service role o una sesión que pueda leer esas tiendas. */
export async function leerDespachos(
  supabase: SupabaseClient<Database>,
  artistaIds: string[]
): Promise<Map<string, OpcionesDespacho> | null> {
  const { data, error } = await supabase
    .from("tiendas")
    .select("artista_id, despacho_modo, despacho_costo, despacho_plazo_min, despacho_plazo_max, retiro_detalle, contacto_email")
    .in("artista_id", artistaIds);
  if (error) {
    console.error("[despacho] error consultando tiendas:", JSON.stringify(error));
    return null;
  }
  const porArtista = new Map((data ?? []).map((t) => [t.artista_id, t]));
  return new Map(artistaIds.map((id) => [id, opcionesDespacho(porArtista.get(id))]));
}

/**
 * Valida `entregas` del body: `{ [artista_id]: 'envio' | 'retiro' }`. Ausente
 * es válido (se usa la forma por defecto); cualquier otra forma, null.
 */
export function normalizarEntregas(entregas: unknown): Record<string, Entrega> | null {
  if (entregas == null) return {};
  if (typeof entregas !== "object" || Array.isArray(entregas)) return null;
  const salida: Record<string, Entrega> = {};
  for (const [artista, entrega] of Object.entries(entregas)) {
    if (entrega !== "envio" && entrega !== "retiro") return null;
    salida[artista] = entrega;
  }
  return salida;
}

/** "Envío $3.000 · 2 a 5 días hábiles", para la ficha y el checkout. */
export function textoPlazo(plazoMin: number | null, plazoMax: number | null): string | null {
  if (plazoMax == null) return null;
  if (plazoMin == null || plazoMin === plazoMax) return `${plazoMax} ${plazoMax === 1 ? "día hábil" : "días hábiles"}`;
  return `${plazoMin} a ${plazoMax} días hábiles`;
}
