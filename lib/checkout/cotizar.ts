import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { comisionEfectiva, hoyEnChile } from "@/lib/comision";
import { leerConfigCobro, modoCobro, type ModoCobro } from "@/lib/cobro";
import { entregasDisponibles, leerDespachos, type Entrega } from "@/lib/checkout/despacho";

/**
 * Calcula el carrito con los datos de la base: precio, stock, cupón, comisión y
 * despacho.
 *
 * El navegador solo aporta `{ id, cantidad }`, el código del cupón y la forma
 * de entrega elegida por artista. Todo lo
 * que cuesta plata sale de acá, nunca del body: antes `crear-preferencia`
 * usaba el `precio` que mandaba el cliente, y cualquiera podía pagar $1.
 *
 * La usan `/api/checkout/cotizar` (para mostrar el total) y
 * `/api/mercadopago/crear-preferencia` (para cobrarlo), así lo que se muestra
 * y lo que se cobra no pueden divergir.
 *
 * Requiere un cliente con service role: lee cupones, que ya no son públicos.
 */

type Cupon = Pick<
  Database["public"]["Tables"]["cupones"]["Row"],
  "id" | "codigo" | "tipo_descuento" | "valor" | "artista_id" | "activo" | "expira_at" | "usos_actuales" | "usos_maximos"
>;

export interface ItemPedido {
  id: string;
  cantidad: number;
}

export interface LineaCotizada {
  producto_id: string;
  nombre: string;
  imagen: string | null;
  artista_id: string;
  /** Precio de lista unitario, el de la base. */
  precio_unitario: number;
  /** Precio unitario que se cobra, con el cupón ya aplicado. */
  precio_cobrado: number;
  cantidad: number;
  /** precio_cobrado × cantidad. */
  monto: number;
  comision_pct: number;
  comision_monto: number;
  monto_artista: number;
  /**
   * Envío del pedido de este artista. Va en su primera línea; las demás, 0.
   * No paga comisión: monto + envio_monto es lo cobrado por la línea.
   */
  envio_monto: number;
}

/** La entrega de cada artista del carrito, lo que se informa antes de pagar. */
export interface DespachoCotizado {
  artista_id: string;
  artista_nombre: string;
  /** Lo que ofrece la tienda, envío primero. */
  opciones: Entrega[];
  entrega: Entrega;
  /** Lo que se cobra por la entrega elegida; 0 si es retiro. */
  costo: number;
  /** Precio del envío si lo ofrece, elegido o no; null si no hace envíos. */
  costo_envio: number | null;
  plazo_min: number | null;
  plazo_max: number | null;
  /** Indicaciones de retiro, si lo ofrece. */
  retiro_detalle: string | null;
  /** false: la tienda no definió despacho (envío sin costo, sin plazo). */
  configurado: boolean;
  /** Correo de contacto del artista para compradores (tiendas.contacto_email). */
  contacto: string | null;
}

export interface Cotizacion {
  lineas: LineaCotizada[];
  subtotal: number;
  descuento: number;
  /** Suma de los envíos. subtotal − descuento + envio = total. */
  envio: number;
  total: number;
  despachos: DespachoCotizado[];
  cupon: Pick<Cupon, "id" | "codigo" | "tipo_descuento" | "valor" | "artista_id"> | null;
  /**
   * Cómo se cobra el pedido (lib/cobro.ts). En 'marketplace' el carrito es de
   * un solo artista, que lo cobra con su cuenta de MP.
   */
  cobro: ModoCobro;
}

export type ResultadoCotizacion =
  | { ok: true; cotizacion: Cotizacion }
  | { ok: false; error: string; campo?: "cupon" | "entrega" };

const MAX_LINEAS = 50;
const MAX_CANTIDAD = 99;

/** Valida la forma del body. Devuelve null si no sirve. */
export function normalizarItems(items: unknown): ItemPedido[] | null {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LINEAS) return null;

  // Un mismo producto dos veces se suma en una línea.
  const porId = new Map<string, number>();
  for (const item of items) {
    const id = (item as { id?: unknown })?.id;
    const cantidad = (item as { cantidad?: unknown })?.cantidad;
    if (typeof id !== "string" || !id) return null;
    if (typeof cantidad !== "number" || !Number.isInteger(cantidad) || cantidad < 1) return null;
    porId.set(id, (porId.get(id) ?? 0) + cantidad);
  }

  const normalizados = [...porId].map(([id, cantidad]) => ({ id, cantidad }));
  if (normalizados.some((i) => i.cantidad > MAX_CANTIDAD)) return null;
  return normalizados;
}

function primeraImagen(imagenes: unknown): string | null {
  return Array.isArray(imagenes) && typeof imagenes[0] === "string" ? imagenes[0] : null;
}

async function buscarCupon(
  supabase: SupabaseClient<Database>,
  codigo: string
): Promise<{ cupon: Cupon } | { error: string }> {
  const { data: cupon, error } = await supabase
    .from("cupones")
    .select("id, codigo, tipo_descuento, valor, artista_id, activo, expira_at, usos_actuales, usos_maximos")
    .eq("codigo", codigo.trim().toUpperCase())
    .maybeSingle();

  if (error) {
    console.error("[cotizar] error consultando cupón:", JSON.stringify(error));
    return { error: "No pudimos validar el cupón. Intenta de nuevo." };
  }
  if (!cupon || !cupon.activo) return { error: "Cupón inválido o no existe" };
  if (cupon.expira_at && new Date(cupon.expira_at) < new Date()) return { error: "Este cupón ha expirado" };
  if (cupon.usos_maximos != null && cupon.usos_actuales >= cupon.usos_maximos) {
    return { error: "Este cupón ya alcanzó su límite de usos" };
  }
  if (cupon.valor <= 0) return { error: "Cupón inválido o no existe" };
  return { cupon };
}

export async function cotizarCarrito(
  supabase: SupabaseClient<Database>,
  items: ItemPedido[],
  codigoCupon?: string | null,
  /** Forma de entrega elegida por artista (normalizarEntregas). Sin elegir, la primera que ofrezca. */
  entregas: Record<string, Entrega> = {}
): Promise<ResultadoCotizacion> {
  const { data: productos, error: prodError } = await supabase
    .from("productos")
    .select("id, nombre, precio, stock, tipo, estado, imagenes, artista_id, artistas(nombre, comision, es_founder, founder_hasta, cobros_activos, cobro)")
    .in("id", items.map((i) => i.id));

  if (prodError) {
    console.error("[cotizar] error consultando productos:", JSON.stringify(prodError));
    return { ok: false, error: "No pudimos calcular tu pedido. Intenta de nuevo." };
  }

  const porId = new Map((productos ?? []).map((p) => [p.id, p]));
  const hoy = hoyEnChile();

  // ── Líneas a precio de lista ──
  const base: Omit<LineaCotizada, "precio_cobrado" | "monto" | "comision_monto" | "monto_artista" | "envio_monto">[] = [];
  for (const item of items) {
    const p = porId.get(item.id);
    if (!p || p.estado !== "aprobado" || !p.artistas) {
      return { ok: false, error: "Uno de los productos ya no está disponible. Revisa tu carrito." };
    }
    if (p.tipo === "fisico" && item.cantidad > p.stock) {
      return {
        ok: false,
        error: p.stock > 0
          ? `Solo quedan ${p.stock} unidades de "${p.nombre}".`
          : `"${p.nombre}" está agotado.`,
      };
    }
    base.push({
      producto_id:     p.id,
      nombre:          p.nombre,
      imagen:          primeraImagen(p.imagenes),
      artista_id:      p.artista_id,
      precio_unitario: p.precio,
      cantidad:        item.cantidad,
      comision_pct:    comisionEfectiva(p.artistas, hoy),
    });
  }

  // ── Modo de cobro ──
  // Un artista que cobra con su cuenta de MP (marketplace) va solo en el
  // pedido: el pago entero va a su cuenta. El resto se mezcla como siempre.
  const config = await leerConfigCobro(supabase);
  const directos = base.filter((l) =>
    modoCobro(config, { id: l.artista_id, cobro: porId.get(l.producto_id)!.artistas!.cobro }) === "marketplace"
  );
  const cobro: ModoCobro = directos.length > 0 ? "marketplace" : "centralizado";
  if (cobro === "marketplace") {
    const vendedor = porId.get(directos[0].producto_id)!.artistas!;
    if (base.some((l) => l.artista_id !== directos[0].artista_id)) {
      return {
        ok: false,
        error: `${vendedor.nombre} cobra directo con su cuenta de Mercado Pago: compra sus productos en un pedido aparte.`,
      };
    }
    if (!vendedor.cobros_activos) {
      return { ok: false, error: `Los productos de ${vendedor.nombre} estarán disponibles pronto.` };
    }
  }

  // ── Cupón ──
  let cupon: Cupon | null = null;
  if (codigoCupon?.trim()) {
    const r = await buscarCupon(supabase, codigoCupon);
    if ("error" in r) return { ok: false, error: r.error, campo: "cupon" };
    cupon = r.cupon;
  }

  // Un cupón de artista descuenta solo los productos de ese artista; uno
  // global (artista_id null), todo el carrito. En marketplace los globales no
  // aplican: el descuento saldría de la plata del artista, no de MuzikChile.
  const aplica = (l: (typeof base)[number]) => !!cupon && (
    cupon.artista_id == null ? cobro === "centralizado" : cupon.artista_id === l.artista_id
  );

  if (cupon && !base.some(aplica)) {
    return { ok: false, error: "Este cupón no aplica a los productos de tu carrito", campo: "cupon" };
  }

  const subtotalAplicable = base.filter(aplica).reduce((acc, l) => acc + l.precio_unitario * l.cantidad, 0);

  const precioCobrado = (l: (typeof base)[number]): number => {
    if (!cupon || !aplica(l)) return l.precio_unitario;
    if (cupon.tipo_descuento === "porcentaje") {
      return Math.max(1, Math.round(l.precio_unitario * (1 - Math.min(cupon.valor, 100) / 100)));
    }
    // Monto fijo: prorrateado según el peso de la línea entre las que aplican.
    const descuentoTotal = Math.min(cupon.valor, subtotalAplicable);
    const peso = (l.precio_unitario * l.cantidad) / subtotalAplicable;
    const descuentoUnitario = Math.round((descuentoTotal * peso) / l.cantidad);
    return Math.max(1, l.precio_unitario - descuentoUnitario);
  };

  // ── Despacho ──
  // Uno por artista, en el orden en que aparecen en el carrito.
  const artistas = [...new Set(base.map((l) => l.artista_id))];
  const opciones = await leerDespachos(supabase, artistas);
  if (!opciones) return { ok: false, error: "No pudimos calcular tu pedido. Intenta de nuevo." };

  const despachos: DespachoCotizado[] = [];
  for (const artista_id of artistas) {
    const o = opciones.get(artista_id)!;
    const artista_nombre = porId.get(base.find((l) => l.artista_id === artista_id)!.producto_id)!.artistas!.nombre;
    const disponibles = entregasDisponibles(o);
    const elegida = entregas[artista_id];
    if (elegida && !disponibles.includes(elegida)) {
      return {
        ok: false,
        campo: "entrega",
        error: elegida === "retiro"
          ? `${artista_nombre} no ofrece retiro. Elige envío.`
          : `${artista_nombre} no hace envíos. Elige retiro.`,
      };
    }
    const entrega = elegida ?? disponibles[0];
    despachos.push({
      artista_id,
      artista_nombre,
      opciones: disponibles,
      entrega,
      costo: entrega === "envio" ? o.envio!.costo : 0,
      costo_envio: o.envio?.costo ?? null,
      plazo_min: o.envio?.plazo_min ?? null,
      plazo_max: o.envio?.plazo_max ?? null,
      retiro_detalle: o.retiro?.detalle ?? null,
      configurado: o.configurado,
      contacto: o.contacto,
    });
  }

  // ── Montos finales ──
  // La comisión va sobre lo cobrado por los productos, después del descuento.
  // El envío no paga comisión y va en la primera línea de cada artista.
  const conEnvio = new Set<string>();
  const lineas: LineaCotizada[] = base.map((l) => {
    const precio_cobrado = precioCobrado(l);
    const monto = precio_cobrado * l.cantidad;
    const comision_monto = Math.round((monto * l.comision_pct) / 100);
    let envio_monto = 0;
    if (!conEnvio.has(l.artista_id)) {
      conEnvio.add(l.artista_id);
      envio_monto = despachos.find((d) => d.artista_id === l.artista_id)!.costo;
    }
    return { ...l, precio_cobrado, monto, comision_monto, monto_artista: monto - comision_monto, envio_monto };
  });

  const subtotal = lineas.reduce((acc, l) => acc + l.precio_unitario * l.cantidad, 0);
  const totalProductos = lineas.reduce((acc, l) => acc + l.monto, 0);
  const envio = despachos.reduce((acc, d) => acc + d.costo, 0);

  return {
    ok: true,
    cotizacion: {
      lineas,
      subtotal,
      // Lo que de verdad se descontó tras el redondeo por unidad, no el valor
      // nominal del cupón: así subtotal − descuento = total, siempre.
      descuento: subtotal - totalProductos,
      envio,
      total: totalProductos + envio,
      despachos,
      cupon: cupon
        ? { id: cupon.id, codigo: cupon.codigo, tipo_descuento: cupon.tipo_descuento, valor: cupon.valor, artista_id: cupon.artista_id }
        : null,
      cobro,
    },
  };
}
