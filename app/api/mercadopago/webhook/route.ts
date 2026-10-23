import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * Aviso de MercadoPago (IPN o webhook). El aviso solo dice "mira el pago X":
 * el estado, el monto y el external_reference se leen siempre de la API de MP.
 *
 * MP manda varios avisos por pago (payment, payment.updated, reintentos), a
 * veces simultáneos. Los efectos (órdenes, stock, cupón) los aplica
 * confirmar_pago() en una transacción y una sola vez por payment_id.
 *
 * Respuestas: 200 cuando el aviso quedó atendido o no hay nada que hacer;
 * 500 ante un error temporal (MP caído, la base falló) para que MP reintente.
 */
export async function POST(req: NextRequest) {
  const ok = () => NextResponse.json({ ok: true });
  const reintentar = () => NextResponse.json({ ok: false }, { status: 500 });

  try {
    // El IPN viejo manda topic e id por query; el webhook nuevo, en el body.
    const body = await req.json().catch(() => ({}));
    const params = req.nextUrl.searchParams;

    const topic      = body.topic ?? body.type ?? params.get("topic") ?? params.get("type");
    const resourceId = body.data?.id ?? params.get("data.id") ?? body.id ?? params.get("id");

    if (!resourceId || (topic !== "payment" && topic !== "payment.updated")) {
      return ok();
    }

    // Solo dígitos: el id termina en una URL de la API.
    const paymentId = String(resourceId);
    if (!/^\d+$/.test(paymentId)) return ok();

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("key", "mp_access_token")
      .maybeSingle();
    if (settingsError) return reintentar();

    const token = settings?.value;
    if (!token) {
      console.error("[webhook] mp_access_token no configurado");
      return ok();
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (mpRes.status >= 500) return reintentar();
    if (!mpRes.ok) {
      console.error("[webhook] MP respondió", mpRes.status, "para el pago", paymentId);
      return ok();
    }

    const pago = await mpRes.json();
    const grupoId: unknown = pago.external_reference;
    if (typeof grupoId !== "string" || !/^[0-9a-f-]{36}$/i.test(grupoId)) return ok();

    if (pago.status === "approved") {
      const { data: ordenes, error: ordenesError } = await supabase
        .from("ordenes")
        .select("monto_artista, comision_monto")
        .eq("grupo_id", grupoId);
      if (ordenesError) return reintentar();

      if (!ordenes?.length) {
        console.error("[webhook] pago aprobado sin órdenes:", paymentId, grupoId);
        return ok();
      }

      // Lo cobrado tiene que cubrir lo que se registró. Si no calza, el pago
      // no se confirma: queda en el log para revisión manual.
      const esperado = ordenes.reduce((acc, o) => acc + o.monto_artista + o.comision_monto, 0);
      const pagado = Number(pago.transaction_amount);
      if (pago.currency_id !== "CLP" || !(pagado >= esperado)) {
        console.error(
          "[webhook] monto o moneda no calzan; no se confirma:",
          JSON.stringify({ paymentId, grupoId, pagado, moneda: pago.currency_id, esperado })
        );
        return ok();
      }

      const { data: resultado, error: rpcError } = await supabase.rpc("confirmar_pago", {
        p_grupo_id:   grupoId,
        p_payment_id: paymentId,
        p_monto:      pagado,
      });
      if (rpcError) {
        console.error("[webhook] confirmar_pago falló:", JSON.stringify(rpcError));
        return reintentar();
      }
      if (resultado === "sin_ordenes") {
        console.error("[webhook] pago registrado sin órdenes por confirmar:", paymentId, grupoId);
      }
      // resultado === "procesado" → acá irán los correos (una sola vez por pago).
    } else if (pago.status === "rejected" || pago.status === "cancelled") {
      const { error } = await supabase
        .from("ordenes")
        .update({ estado: "cancelado" })
        .eq("grupo_id", grupoId)
        .eq("estado", "pendiente");
      if (error) return reintentar();
    }

    return ok();
  } catch (error) {
    console.error("Webhook MP error:", error);
    return reintentar();
  }
}

export async function GET() {
  return NextResponse.json({ status: "MuzikChile MP Webhook activo" });
}
