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

        const { data: ordenes } = await supabase
          .from("ordenes")
          .select("cupon_id")
          .eq("external_reference", externalRef)
          .not("cupon_id", "is", null)
          .limit(1);

        if (ordenes?.[0]?.cupon_id) {
          await supabase.rpc("incrementar_usos_cupon", {
            cupon_id: ordenes[0].cupon_id,
          });
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
