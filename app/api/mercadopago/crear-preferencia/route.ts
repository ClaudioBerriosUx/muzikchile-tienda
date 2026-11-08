import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { cotizarCarrito, normalizarItems } from "@/lib/checkout/cotizar";
import { normalizarEntregas } from "@/lib/checkout/despacho";
import { tokenVigente } from "@/lib/mp/conexiones";
import { leerConfigVentas, MENSAJE_VENTAS_CERRADAS, puedeComprar } from "@/lib/ventas";
import { VERSION_TERMINOS_COMPRADORES } from "@/lib/terminos";

interface CompradorBody {
  nombre: string;
  email: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  region?: string;
}

/**
 * Body: `{ items: [{ id, cantidad }], comprador, cupon_codigo?, entregas?,
 * acepta_terminos, terminos_version }`. Sin aceptar la versión vigente de los
 * términos para compradores no se crea nada; la aceptación queda en cada orden.
 * Precio, stock, cupón, comisión y despacho salen de la base
 * (lib/checkout/cotizar.ts); si el cliente manda `precio` o `nombre`, se ignoran.
 * El envío va como un ítem más de la preferencia, sin comisión, y cada orden
 * guarda la copia de la entrega informada.
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
    const entregas = normalizarEntregas(body?.entregas);

    if (!items || !entregas || typeof comprador?.email !== "string" || typeof comprador?.nombre !== "string") {
      return NextResponse.json({ error: "Datos de compra incompletos" }, { status: 400 });
    }

    // Cliente con service role (acceso total sin RLS)
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Freno del piloto, antes de crear nada: sin esto no hay preferencia ni órdenes.
    const ventas = await leerConfigVentas(supabase).catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      return null;
    });
    if (!ventas || !puedeComprar(ventas, comprador.email)) {
      return NextResponse.json({ error: MENSAJE_VENTAS_CERRADAS, ventas_cerradas: true }, { status: 403 });
    }

    // Términos para compradores: la versión vigente, aceptada en el checkout.
    if (body?.acepta_terminos !== true || body?.terminos_version !== VERSION_TERMINOS_COMPRADORES) {
      return NextResponse.json(
        { error: "Para comprar tienes que aceptar los términos y condiciones vigentes.", campo: "terminos" },
        { status: 400 }
      );
    }
    const terminosAceptadosAt = new Date().toISOString();

    const codigo = typeof body?.cupon_codigo === "string" ? body.cupon_codigo : null;
    const resultado = await cotizarCarrito(supabase, items, codigo, entregas);
    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error, campo: resultado.campo }, { status: 422 });
    }
    const { lineas, cupon, cobro, despachos } = resultado.cotizacion;

    // Con algún envío, la dirección es obligatoria; con solo retiro, no se pide.
    const hayEnvio = despachos.some((d) => d.entrega === "envio");
    const lleno = (v: unknown) => typeof v === "string" && v.trim() !== "";
    if (hayEnvio && !(lleno(comprador.direccion) && lleno(comprador.ciudad) && lleno(comprador.region))) {
      return NextResponse.json({ error: "Falta la dirección de envío", campo: "direccion" }, { status: 400 });
    }
    const despachoDe = new Map(despachos.map((d) => [d.artista_id, d]));

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
        items: [
          ...lineas.map((l) => ({
            id:          l.producto_id,
            title:       l.nombre,
            quantity:    l.cantidad,
            unit_price:  l.precio_cobrado,
            currency_id: "CLP",
            ...(l.imagen ? { picture_url: l.imagen } : {}),
          })),
          // El envío de cada artista, sin comisión (en marketplace no entra al fee).
          ...despachos.filter((d) => d.costo > 0).map((d) => ({
            id:          `despacho-${d.artista_id}`,
            title:       `Despacho · ${d.artista_nombre}`,
            quantity:    1,
            unit_price:  d.costo,
            currency_id: "CLP",
          })),
        ],
        payer: {
          name:  comprador.nombre,
          email: comprador.email,
          ...(comprador.telefono ? { phone: { number: comprador.telefono } } : {}),
          ...(hayEnvio && comprador.direccion ? {
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
        // auto_return también exige URL HTTPS: con localhost MP responde 400
        // "auto_return invalid". En local el comprador vuelve con el botón de MP.
        ...(process.env.NEXT_PUBLIC_URL?.startsWith("https://") ? { auto_return: "approved" } : {}),
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
    // monto_artista + comision_monto + envio_monto = lo que MP cobra por la
    // línea: el webhook compara esa suma con el monto del pago.
    const ordenes = lineas.map((l) => {
      const d = despachoDe.get(l.artista_id)!;
      const envio = d.entrega === "envio";
      return {
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
      // La dirección solo se guarda si se despacha: con retiro no hace falta.
      direccion_envio:     envio ? comprador.direccion ?? null : null,
      ciudad_envio:        envio ? comprador.ciudad ?? null : null,
      region_envio:        envio ? comprador.region ?? null : null,
      // Copia de la entrega informada: obliga al artista aunque cambie su tienda.
      entrega:             d.entrega,
      envio_monto:         l.envio_monto,
      entrega_plazo_min:   envio ? d.plazo_min : null,
      entrega_plazo_max:   envio ? d.plazo_max : null,
      entrega_detalle:     envio ? null : d.retiro_detalle,
      // El correo de contacto que vio el comprador: a él dirige retractos y reclamos.
      vendedor_contacto:   d.contacto,
      // La versión aceptada en el checkout: la confirmación lleva su copia.
      terminos_version:      VERSION_TERMINOS_COMPRADORES,
      terminos_aceptados_at: terminosAceptadosAt,
      // Centralizado: los defaults de la columna ('centralizado', sin collector).
      ...(directo ? { cobro: "marketplace", mp_collector_id: directo.collectorId } : {}),
      };
    });

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
