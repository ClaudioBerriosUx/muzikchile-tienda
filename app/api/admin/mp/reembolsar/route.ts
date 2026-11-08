import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clienteServicio, tokenVigente } from "@/lib/mp/conexiones";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Reembolso total de un pedido pagado, pedido por un admin (botón
 * "Reembolsar" de /admin/ordenes).
 *
 * Marketplace: el pago es de la cuenta del artista; MuzikChile no lo ve con su
 * token (403 / 404), así que el reembolso se pide con el token del artista.
 * Centralizado: el pago entró a la cuenta de MuzikChile y se reembolsa con su
 * token (app_settings.mp_access_token), salvo que alguna línea ya esté
 * liquidada: esa plata ya se le transfirió al artista y hay que ajustarla a mano.
 * Esta ruta SOLO le pide el reembolso a MP; no toca la base. El efecto
 * (órdenes 'reembolsado', stock, cupón) lo aplica el webhook cuando MP avisa
 * el pago 'refunded', igual que si el artista reembolsara desde su panel.
 *
 * Body: `{ grupo }` (external_reference del pedido). Devuelve el status y el
 * cuerpo de MP tal cual, para diagnosticar.
 *
 * Seguridad: el rol se comprueba acá, con la sesión de las cookies (mismo
 * patrón que /api/revalidar-noticias).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const { data: rol, error: errRol } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (errRol) {
    console.error("[reembolsar] error leyendo el rol:", errRol.message);
    return NextResponse.json({ error: "Error leyendo el rol" }, { status: 500 });
  }
  if (!rol) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const body: unknown = await req.json().catch(() => null);
  const grupo = body && typeof body === "object" && "grupo" in body ? body.grupo : null;
  if (typeof grupo !== "string" || !UUID.test(grupo)) {
    return NextResponse.json({ error: "Falta el grupo (external_reference) del pedido" }, { status: 400 });
  }

  const servicio = clienteServicio();
  const { data: ordenes, error } = await servicio
    .from("ordenes")
    .select("artista_id, estado, cobro, mercadopago_id, liquidado")
    .eq("grupo_id", grupo);
  if (error) return NextResponse.json({ error: "No pudimos leer el pedido" }, { status: 500 });
  if (!ordenes?.length) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  const orden = ordenes[0];
  if (ordenes.some((o) => o.estado !== "pagado")) {
    return NextResponse.json({ error: `El pedido no está pagado (estado: ${[...new Set(ordenes.map((o) => o.estado))].join(", ")})` }, { status: 422 });
  }
  if (!orden.mercadopago_id || !orden.artista_id) {
    return NextResponse.json({ error: "El pedido no tiene un pago de Mercado Pago registrado: revísalo en Mercado Pago" }, { status: 422 });
  }

  // El token de la cuenta donde entró el pago.
  let token: string;
  if (orden.cobro === "marketplace") {
    const vendedor = await tokenVigente(servicio, orden.artista_id);
    if (!vendedor.ok) {
      return NextResponse.json({ error: `No hay token del artista para reembolsar (${vendedor.motivo})` }, { status: 422 });
    }
    token = vendedor.accessToken;
  } else {
    if (ordenes.some((o) => o.liquidado)) {
      return NextResponse.json(
        { error: "Parte del pedido ya se le liquidó al artista: reembolsarlo desde MuzikChile perdería esa plata. Ajústalo a mano con el artista." },
        { status: 422 }
      );
    }
    const { data: ajuste } = await servicio.from("app_settings").select("value").eq("key", "mp_access_token").maybeSingle();
    if (!ajuste?.value) return NextResponse.json({ error: "MercadoPago no configurado en app_settings" }, { status: 500 });
    token = ajuste.value;
  }

  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${orden.mercadopago_id}/refunds`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // Mismo pago, misma llave: un doble clic no pide dos reembolsos.
      "X-Idempotency-Key": `reembolso-${orden.mercadopago_id}`,
    },
    body: "{}",
  });
  const mp = await mpRes.json().catch(() => null);
  (mpRes.ok ? console.log : console.error)("[reembolsar] respuesta de MP:", orden.mercadopago_id, mpRes.status, JSON.stringify(mp));

  return NextResponse.json({ payment_id: orden.mercadopago_id, mp_status: mpRes.status, mp }, { status: mpRes.ok ? 200 : 502 });
}
