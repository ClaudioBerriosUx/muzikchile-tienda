import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { cotizarCarrito, normalizarItems } from "@/lib/checkout/cotizar";

export const dynamic = "force-dynamic";

/**
 * Total del carrito según la base, con el cupón validado acá.
 * El checkout lo muestra tal cual; crear-preferencia cobra exactamente esto.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const items = normalizarItems(body?.items);
    if (!items) {
      return NextResponse.json({ error: "Carrito inválido" }, { status: 400 });
    }

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const codigo = typeof body?.cupon_codigo === "string" ? body.cupon_codigo : null;
    const resultado = await cotizarCarrito(supabase, items, codigo);
    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error, campo: resultado.campo }, { status: 422 });
    }

    const { lineas, subtotal, descuento, total, cupon, cobro } = resultado.cotizacion;
    // Solo lo que el checkout necesita mostrar: sin comisiones ni montos del artista.
    return NextResponse.json({
      lineas: lineas.map((l) => ({
        id:              l.producto_id,
        precio_unitario: l.precio_unitario,
        precio_cobrado:  l.precio_cobrado,
        cantidad:        l.cantidad,
      })),
      subtotal,
      descuento,
      total,
      cupon: cupon
        ? { codigo: cupon.codigo, tipo_descuento: cupon.tipo_descuento, valor: cupon.valor }
        : null,
      cobro,
    });
  } catch (err) {
    console.error("Error en cotizar:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
