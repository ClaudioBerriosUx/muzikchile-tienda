import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface ItemBody {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  imagen?: string;
}

interface CompradorBody {
  nombre: string;
  email: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  region?: string;
}

interface RequestBody {
  items: ItemBody[];
  comprador: CompradorBody;
  cupon_id?: string | null;
}

interface ProductoRow {
  id: string;
  artista_id: string | null;
  artistas: { comision: number; es_founder: boolean } | { comision: number; es_founder: boolean }[] | null;
}

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const { items, comprador, cupon_id } = body;

    if (!items?.length || !comprador?.email) {
      return NextResponse.json({ error: "Datos de compra incompletos" }, { status: 400 });
    }

    // Cliente con service role (acceso total sin RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Leer configuración de MercadoPago
    const { data: settingsRaw } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["mp_access_token", "mp_modo"]);

    const settings: Record<string, string> = Object.fromEntries(
      (settingsRaw ?? []).map(({ key, value }: { key: string; value: string }) => [key, value])
    );

    const access_token = settings.mp_access_token;
    if (!access_token) {
      return NextResponse.json({ error: "MercadoPago no configurado en app_settings" }, { status: 500 });
    }

    const modo = settings.mp_modo ?? "sandbox";

    // Calcular descuento por cupón
    let descuentoTotal = 0;
    let cuponData: { id: string; tipo: string; valor: number } | null = null;
    if (cupon_id) {
      const { data: cupon } = await supabase
        .from("cupones")
        .select("id, tipo, valor")
        .eq("id", cupon_id)
        .single();

      if (cupon) {
        cuponData = cupon;
        const subtotal = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
        descuentoTotal = cupon.tipo === "porcentaje"
          ? Math.round(subtotal * cupon.valor / 100)
          : Math.min(cupon.valor, subtotal);
      }
    }

    // Obtener artistas y comisiones de cada producto
    const productIds = items.map((i) => i.id);
    const { data: productosRaw } = await supabase
      .from("productos")
      .select("id, artista_id, artistas(comision, es_founder)")
      .in("id", productIds);

    const productoMap = Object.fromEntries(
      ((productosRaw ?? []) as ProductoRow[]).map((p) => [p.id, p])
    );

    // External reference único para este pedido
    const external_reference = crypto.randomUUID();

    // Construir preferencia de MP
    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: items.map((item) => ({
          title:      item.nombre,
          quantity:   item.cantidad,
          unit_price: item.precio,
          currency_id: "CLP",
          ...(item.imagen ? { picture_url: item.imagen } : {}),
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
        notification_url: `${process.env.NEXT_PUBLIC_URL}/api/mercadopago/webhook`,
        ...(descuentoTotal > 0 ? { coupon_amount: descuentoTotal } : {}),
      }),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("MercadoPago error:", mpData);
      return NextResponse.json(
        { error: mpData.message ?? "Error al crear preferencia de pago" },
        { status: 400 }
      );
    }

    // Crear órdenes pendientes en Supabase (una por item)
    const ordenes = items.map((item) => {
      const prod   = productoMap[item.id] as ProductoRow | undefined;
      const artista = Array.isArray(prod?.artistas)
        ? prod!.artistas[0]
        : (prod?.artistas as { comision: number; es_founder: boolean } | null);
      const comisionPct = artista?.es_founder ? 0 : (artista?.comision ?? 10);
      const montoItem   = item.precio * item.cantidad;
      const comisionMonto = Math.round(montoItem * comisionPct / 100);

      return {
        artista_id:         prod?.artista_id ?? null,
        producto_id:        item.id,
        nombre_comprador:   comprador.nombre,
        email_comprador:    comprador.email,
        precio_unitario:    item.precio,
        cantidad:           item.cantidad,
        monto_artista:      montoItem - comisionMonto,
        comision_monto:     comisionMonto,
        estado:             "pendiente",
        external_reference,
        mp_preference_id:   mpData.id,
        cupon_id:           cuponData?.id ?? null,
        direccion_envio:    comprador.direccion ?? null,
        ciudad_envio:       comprador.ciudad ?? null,
        region_envio:       comprador.region ?? null,
      };
    });

    await supabase.from("ordenes").insert(ordenes);

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
