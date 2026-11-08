/**
 * Motivos del reembolso de emergencia que pide un admin desde /admin/ordenes
 * (/api/admin/mp/reembolsar). Los mismos que el CHECK de
 * ordenes.reembolso_motivo (migración 20261108020000).
 *
 * El reembolso normal lo hace el artista desde su panel de Mercado Pago; este
 * es el respaldo cuando eso falla.
 */
export const MOTIVOS_REEMBOLSO = {
  retracto:      "Retracto",
  defectuoso:    "Producto defectuoso",
  no_despachado: "No despachado",
  otro:          "Otro",
} as const;

export type MotivoReembolso = keyof typeof MOTIVOS_REEMBOLSO;

export function esMotivoReembolso(v: string): v is MotivoReembolso {
  return Object.hasOwn(MOTIVOS_REEMBOLSO, v);
}
