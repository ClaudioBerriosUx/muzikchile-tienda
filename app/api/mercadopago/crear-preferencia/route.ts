import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { cotizarCarrito, normalizarItems } from "@/lib/checkout/cotizar";
import { tokenVigente } from "@/lib/mp/conexiones";

interface CompradorBody {
  nombre: string;
  email: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  region?: string;
}

/**
 * Body: `{ items: [{ id, cantidad }], comprador, cupon_codigo? }`.
 * Precio, stock, cupón y comisión salen de la base (lib/checkout/cotizar.ts);
 * si el cliente manda `precio` o `nombre`, se ignoran.
 *
 * Cobro (lib/cobro.ts): en 'centralizado' la preferencia se crea con el token
 * de MuzikChile, como siempre. En 'marketplace' (un solo artista, garantizado
 * por cotizar) se crea con el token del artista y la comisión va como
 * marketplace_fee; la notification_url lleva ?grupo= para que el webhook sepa
 * con qué token consultar el pago.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const items = normalizarItems(body?.items);
    const comprador = body?.comprador as CompradorBody | undefined;

    if (!items || typeof comprador?.email !== "string" || typeof comprador?.nombre !== "string") {
      return NextResponse.json({ error: "Datos de compra incompletos" }, { status: 400 });
    }

    // Cliente con service role (acceso total sin RLS)
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const codigo = typeof body?.cupon_codigo === "string" ? body.cupon_codigo : null;
    const resultado = await cotizarCarrito(supabase, items, codigo);
    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error, campo: resultado.campo }, { status: 422 });
    }
    const { lineas, cupon, cobro } = resultado.cotizacion;

    // Leer configuración de MercadoPago
    const { data: settingsRaw } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["mp_access_token", "mp_modo"]);

    const settings: Record<string, string | null> = Object.fromEntries(
      (settingsRaw ?? []).map(({ key, value }) => [key, value])
    );

    let access_token = settings.mp_access_token;
    if (!access_token) {
      return NextResponse.json({ error: "MercadoPago no configurado en app_settings" }, { status: 500 });
    }

    const modo = settings.mp_modo ?? "sandbox";

    // External reference único para este pedido
    const external_reference = crypto.randomUUID();

    // Marketplace: el pago va a la cuenta del artista, con su token.
    let directo: { collectorId: number; fee: number } | null = null;
    if (cobro === "marketplace") {
      const vendedor = await tokenVigente(supabase, lineas[0].artista_id);
      if (!vendedor.ok) {
        console.error("[crear-preferencia] artista sin token para cobrar:", lineas[0].artista_id, vendedor.motivo);
        return NextResponse.json({ error: "Este artista no puede recibir pagos en este momento. Intenta más tarde." }, { status: 422 });
      }
      access_token = vendedor.accessToken;
      directo = { collectorId: vendedor.mpUserId, fee: lineas.reduce((acc, l) => acc + l.comision_monto, 0) };
    }
    const avisos = `${process.env.NEXT_PUBLIC_URL}/api/mercadopago/webhook${directo ? `?grupo=${external_reference}` : ""}`;

    // Construir preferencia de MP
    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: lineas.map((l) => ({
          id:          l.producto_id,
          title:       l.nombre,
          quantity:    l.cantidad,
          unit_price:  l.precio_cobrado,
          currency_id: "CLP",
          ...(l.imagen ? { picture_url: l.imagen } : {}),
        })),
        payer: {
          name:  comprador.nombre,
          email: comprador.email,
          ...(comprador.telefono ? { phone: { number: comprador.telefono } } : {}),
          ...(comprador.direccion ? {
            address: {
              street_name: comprador.direccion,
              city: comprador.ciudad ?? "",
            },
          } : {}),
        },
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_URL}/checkout/exito`,
          failure: `${process.env.NEXT_PUBLIC_URL}/checkout/error`,
          pending: `${process.env.NEXT_PUBLIC_URL}/checkout/pendiente`,
        },
        auto_return: "approved",
        external_reference,
        // La comisión de MuzikChile en marketplace. Si es 0 (founder) se omite.
        ...(directo && directo.fee > 0 ? { marketplace_fee: directo.fee } : {}),
        // notification_url solo cuando la URL base es HTTPS pública
        // (MP rechaza localhost o HTTP con "policy UNAUTHORIZED")
        ...(process.env.NEXT_PUBLIC_URL?.startsWith("https://")
          ? { notification_url: avisos }
          : {}),
      }),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("MercadoPago error:", JSON.stringify(mpData));
      return NextResponse.json(
        { error: mpData.message ?? "Error al crear preferencia de pago", cause: mpData.cause },
        { status: 400 }
      );
    }

    // Crear órdenes pendientes en Supabase (una por línea).
    // monto_artista + comision_monto = lo que MP cobra por la línea: el webhook
    // compara esa suma con el monto del pago.
    const ordenes = lineas.map((l) => ({
      artista_id:          l.artista_id,
      producto_id:         l.producto_id,
      comprador_nombre:    comprador.nombre,
      comprador_email:     comprador.email,
      precio_unitario:     l.precio_unitario,
      cantidad:            l.cantidad,
      monto_artista:       l.monto_artista,
      comision_monto:      l.comision_monto,
      comision_porcentaje: l.comision_pct,
      estado:              "pendiente",
      grupo_id:            external_reference,
      mp_preference_id:    mpData.id,
      cupon_id:            cupon?.id ?? null,
      direccion_envio:     comprador.direccion ?? null,
      ciudad_envio:        comprador.ciudad ?? null,
      region_envio:        comprador.region ?? null,
      // Centralizado: los defaults de la columna ('centralizado', sin collector).
      ...(directo ? { cobro: "marketplace", mp_collector_id: directo.collectorId } : {}),
    }));

    const { error: insertError } = await supabase.from("ordenes").insert(ordenes);
    if (insertError) {
      console.error("Insert ordenes error:", JSON.stringify(insertError));
      return NextResponse.json(
        { error: `Error al registrar la orden: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      init_point:         mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
      external_reference,
      modo,
    });
  } catch (err) {
    console.error("Error en crear-preferencia:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
