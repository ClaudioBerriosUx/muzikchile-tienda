import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/types";
import { clienteServicio, procesarDesvinculacion, tokenVigente } from "@/lib/mp/conexiones";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

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
 *
 * Marketplace: el pago es de la cuenta del artista, así que se consulta con su
 * token. La notification_url de esas preferencias trae ?grupo=<external_reference>;
 * si las órdenes del grupo son 'marketplace', se usa el token del artista y se
 * exige que el pago sea de ese grupo y de esa cuenta (collector). Sin ?grupo=,
 * o con órdenes centralizadas, todo sigue igual que antes.
 *
 * Reembolsos y contracargos ('refunded', 'charged_back'): revertir_pago() pasa
 * las órdenes a 'reembolsado', devuelve el stock no despachado y el uso del
 * cupón, una sola vez por pago. Es el mismo camino venga de donde venga el
 * reembolso: la ruta /api/admin/mp/reembolsar, el panel de MP del artista o el
 * de MuzikChile; lo que manda es el estado del pago en MP. Un reembolso
 * parcial deja el pago en 'approved': no se revierte nada, queda en el log.
 *
 * Desvinculación (mp-connect, application.deauthorized): procesarDesvinculacion
 * confirma con MP antes de pasar la conexión del artista a 'reconectar'.
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

    // Vinculación de aplicaciones: un artista desvinculó la app desde MP. Es
    // raro, así que el aviso va entero al log (no trae secretos).
    if (topic === "mp-connect") {
      console.log("[webhook] mp-connect:", JSON.stringify(body));
      if (body.action !== "application.deauthorized") return ok();
      const mpUserId = Number(body.user_id);
      if (!Number.isSafeInteger(mpUserId) || mpUserId <= 0) return ok();

      const resultado = await procesarDesvinculacion(clienteServicio(), mpUserId);
      console.log("[webhook] mp-connect desvinculación:", mpUserId, resultado);
      return resultado === "reintentar" ? reintentar() : ok();
    }

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

    let token = settings?.value;
    if (!token) {
      console.error("[webhook] mp_access_token no configurado");
      return ok();
    }

    // ¿Es un pago marketplace? Lo dice la orden, no el aviso: ?grupo= solo
    // indica dónde mirar.
    let directo: { grupo: string; collectorId: number } | null = null;
    const grupoAviso = params.get("grupo");
    if (grupoAviso && UUID.test(grupoAviso)) {
      const { data: orden, error: ordenError } = await supabase
        .from("ordenes")
        .select("artista_id, cobro, mp_collector_id")
        .eq("grupo_id", grupoAviso)
        .limit(1)
        .maybeSingle();
      if (ordenError) return reintentar();
      if (orden?.cobro === "marketplace") {
        if (!orden.artista_id || !orden.mp_collector_id) {
          console.error("[webhook] orden marketplace sin artista o collector:", grupoAviso);
          return ok();
        }
        const vendedor = await tokenVigente(supabase, orden.artista_id);
        if (!vendedor.ok) {
          // Sin token no se puede consultar el pago: que MP reintente (el
          // artista puede reconectar, o la renovación salir en otro intento).
          console.error("[webhook] sin token del artista para consultar el pago:", paymentId, grupoAviso, vendedor.motivo);
          return reintentar();
        }
        token = vendedor.accessToken;
        directo = { grupo: grupoAviso, collectorId: Number(orden.mp_collector_id) };
      }
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
    if (typeof grupoId !== "string" || !UUID.test(grupoId)) return ok();

    // El pago tiene que ser de ese pedido y haber entrado a la cuenta del
    // artista: un ?grupo= ajeno no sirve para confirmar otra cosa.
    if (directo && (grupoId !== directo.grupo || Number(pago.collector_id) !== directo.collectorId)) {
      console.error(
        "[webhook] pago marketplace no calza con el grupo o la cuenta del artista; no se confirma:",
        JSON.stringify({ paymentId, grupoAviso: directo.grupo, grupoPago: grupoId, collector: pago.collector_id, esperado: directo.collectorId })
      );
      return ok();
    }

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
      if (Number(pago.transaction_amount_refunded) > 0) {
        console.error(
          "[webhook] reembolso parcial: el pago sigue aprobado, no se revierte nada:",
          JSON.stringify({ paymentId, grupoId, reembolsado: pago.transaction_amount_refunded, total: pagado })
        );
      }
    } else if (pago.status === "refunded" || pago.status === "charged_back") {
      const { data: resultado, error: rpcError } = await supabase.rpc("revertir_pago", {
        p_grupo_id:   grupoId,
        p_payment_id: paymentId,
        p_motivo:     pago.status,
      });
      if (rpcError) {
        console.error("[webhook] revertir_pago falló:", JSON.stringify(rpcError));
        return reintentar();
      }
      if (resultado === "sin_pago" || resultado === "sin_ordenes") {
        console.error("[webhook] reembolso sin pago confirmado u órdenes que revertir:", resultado, paymentId, grupoId);
      }
      if (resultado === "procesado") {
        // Lo que ya se le transfirió al artista no se devuelve solo.
        const { data: liquidadas } = await supabase
          .from("ordenes")
          .select("id")
          .eq("grupo_id", grupoId)
          .eq("liquidado", true);
        if (liquidadas?.length) {
          console.error("[webhook] reembolso de órdenes ya liquidadas: ajustar a mano con el artista:", grupoId, JSON.stringify(liquidadas));
        }
      }
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
