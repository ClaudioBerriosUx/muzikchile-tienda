import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const topic      = body.topic ?? body.type;
    const resourceId = body.data?.id ?? body.id;

    if (!resourceId) {
      return NextResponse.json({ ok: true });
    }

    if (topic === "payment" || topic === "payment.updated") {
      const { data: settings } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["mp_access_token", "mp_modo"]);

      const config = Object.fromEntries(
        (settings ?? []).map((s: { key: string; value: string }) => [s.key, s.value])
      );

      const token = config.mp_access_token;
      if (!token) return NextResponse.json({ ok: true });

      const mpRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${resourceId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!mpRes.ok) return NextResponse.json({ ok: true });

      const pago = await mpRes.json();

      const externalRef = pago.external_reference;
      const status      = pago.status;

      if (!externalRef) return NextResponse.json({ ok: true });

      if (status === "approved") {
        await supabase
          .from("ordenes")
          .update({
            estado:         "pagado",
            mercadopago_id: String(resourceId),
            metodo_pago:    "mercadopago",
          })
          .eq("external_reference", externalRef)
          .eq("estado", "pendiente");

        const { data: ordenesPagadas } = await supabase
          .from("ordenes")
          .select("producto_id, cantidad, cupon_id")
          .eq("external_reference", externalRef)
          .eq("estado", "pagado");

        // Incrementar usos del cupón (una sola vez por grupo)
        const cuponId = ordenesPagadas?.find((o) => o.cupon_id)?.cupon_id;
        if (cuponId) {
          await supabase.rpc("incrementar_usos_cupon", { cupon_id: cuponId });
        }

        // Descontar stock de productos físicos
        if (ordenesPagadas?.length) {
          const productoIds = ordenesPagadas.map((o) => o.producto_id).filter(Boolean);
          const { data: productos } = await supabase
            .from("productos")
            .select("id, tipo, stock")
            .in("id", productoIds);

          const productoMap = Object.fromEntries(
            (productos ?? []).map((p) => [p.id, p])
          );

          for (const orden of ordenesPagadas) {
            const producto = productoMap[orden.producto_id];
            if (producto?.tipo === "fisico" && producto.stock !== null) {
              const nuevoStock = Math.max(0, producto.stock - orden.cantidad);
              const { error: stockError } = await supabase
                .from("productos")
                .update({ stock: nuevoStock })
                .eq("id", orden.producto_id);
              if (stockError) {
                console.error("Error descontando stock:", orden.producto_id, JSON.stringify(stockError));
              }
            }
          }
        }
      } else if (status === "rejected" || status === "cancelled") {
        await supabase
          .from("ordenes")
          .update({ estado: "cancelado" })
          .eq("external_reference", externalRef)
          .eq("estado", "pendiente");
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook MP error:", error);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "MuzikChile MP Webhook activo" });
}
