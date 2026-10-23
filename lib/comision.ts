/**
 * Regla de comisión de MuzikChile, en un solo lugar.
 *
 * - Founder sin `founder_hasta`: 0% de por vida.
 * - Founder con `founder_hasta`: 0% hasta ese día inclusive (hora de Chile);
 *   desde el día siguiente, la comisión del artista.
 * - El resto: la comisión del artista (`artistas.comision`, que al crearlo
 *   toma app_settings.comision_default).
 *
 * Funciones puras: las usan cotizar (servidor) y /admin/artistas (cliente).
 */

export interface DatosComision {
  comision: number;
  es_founder: boolean;
  /** "AAAA-MM-DD" o null. */
  founder_hasta: string | null;
}

/** Fecha de hoy en Chile como "AAAA-MM-DD" (en-CA formatea así). */
export function hoyEnChile(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(ahora);
}

/** ¿El 0% de founder sigue vigente hoy? */
export function founderVigente(a: Pick<DatosComision, "es_founder" | "founder_hasta">, hoy = hoyEnChile()): boolean {
  if (!a.es_founder) return false;
  // Las fechas "AAAA-MM-DD" se comparan bien como texto.
  return a.founder_hasta == null || hoy <= a.founder_hasta;
}

/** Porcentaje que se cobra hoy a este artista. */
export function comisionEfectiva(a: DatosComision, hoy = hoyEnChile()): number {
  return founderVigente(a, hoy) ? 0 : Number(a.comision);
}

/** "31-12-2027" a partir de "2027-12-31". */
export function formatearFecha(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}-${m}-${a}`;
}

/** Texto del beneficio: "Comisión 0% de por vida" / "Comisión 0% hasta 31-12-2027". */
export function textoFounder(founder_hasta: string | null): string {
  return founder_hasta ? `Comisión 0% hasta ${formatearFecha(founder_hasta)}` : "Comisión 0% de por vida";
}
