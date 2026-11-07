/**
 * Lo que comparten /api/panel/tienda y el panel del artista sobre la tienda.
 * Los cambios de estado viven en la base: ver la migración
 * 20261107172500_tiendas_y_terminos_artistas.
 */

export type EstadoTienda = "no_activa" | "solicitada" | "devuelta" | "activa" | "suspendida";

export const ETIQUETA_ESTADO_TIENDA: Record<EstadoTienda, string> = {
  no_activa:  "No activa",
  solicitada: "Solicitud en revisión",
  devuelta:   "Solicitud devuelta",
  activa:     "Activa",
  suspendida: "Suspendida",
};

export interface ChecklistTienda {
  terminos: boolean;
  identidad: boolean;
  mp: boolean;
  despacho: boolean;
  producto: boolean;
}

export interface DespachoTienda {
  despacho_modo: "envio" | "retiro" | "ambos" | null;
  despacho_costo: number | null;
  despacho_plazo_min: number | null;
  despacho_plazo_max: number | null;
  retiro_detalle: string | null;
}

/** Respuesta de GET /api/panel/tienda. Nunca lleva tokens. */
export interface PanelTienda {
  artistaId: string;
  estado: EstadoTienda;
  comentario: string | null;
  identidadDeclarada: boolean;
  despacho: DespachoTienda;
  checklist: ChecklistTienda;
  terminos: { version: string; aceptadoAt: string | null };
  comision: { porcentaje: number; detalle: string | null };
  /** Ya vendió algo: mantiene Cupones, Por despachar y Liquidaciones en el menú. */
  tieneOrdenes: boolean;
  conexion: { estado: string } | null;
}

/** Una tienda en la bandeja del admin (GET /api/admin/tiendas). Nunca lleva tokens. */
export interface TiendaAdmin {
  artistaId: string;
  nombre: string;
  slug: string;
  esPrueba: boolean;
  enBaja: boolean;
  cobro: string;
  estado: EstadoTienda;
  comentario: string | null;
  solicitadaAt: string | null;
  resueltaAt: string | null;
  identidadDeclaradaAt: string | null;
  despacho: DespachoTienda;
  checklist: ChecklistTienda;
  terminos: { version: string; aceptadoAt: string | null };
  comision: { porcentaje: number; detalle: string | null };
  conexion: { estado: string; nickname: string | null; email: string | null; liveMode: boolean } | null;
  productos: { id: string; nombre: string; estado: string }[];
}

/** Cómo se llama cada ítem del checklist cuando falta. */
export const FALTA_CHECKLIST: Record<keyof ChecklistTienda, string> = {
  terminos:  "aceptar los términos",
  identidad: "declarar tu identidad de Mercado Pago",
  mp:        "conectar Mercado Pago",
  despacho:  "definir despacho o retiro",
  producto:  "crear un producto en borrador",
};
