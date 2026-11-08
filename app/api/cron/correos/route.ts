import { NextRequest, NextResponse } from "next/server";
import { clienteServicio } from "@/lib/mp/conexiones";
import { enviarCorreosDeCompra } from "@/lib/correo/compra";
import { MAX_INTENTOS } from "@/lib/correo/enviar";
import { enviarCorreoTienda, esTipoCorreoTienda } from "@/lib/correo/tienda";

export const dynamic = "force-dynamic";

/**
 * Cron diario de correos (vercel.json). Vercel manda
 * `Authorization: Bearer <CRON_SECRET>`; sin esa variable no corre.
 *
 *   1. Barrido: cada pago confirmado de los últimos 10 días, sin revertir,
 *      tiene que tener su confirmación y sus "nueva venta". Cubre el caso en que
 *      el webhook confirmó el pago pero no alcanzó a mandar los correos.
 *      enviarCorreosDeCompra es idempotente: lo que ya salió no se repite, y lo
 *      que falló se reintenta hasta MAX_INTENTOS veces.
 *   2. Correos de tienda que no salieron en los últimos 10 días: se reintentan
 *      si la tienda sigue en el estado que describen (si no, ya no aplican).
 *   3. Retención: borra el registro de correos de más de 2 años (política de
 *      privacidad v1.1).
 *
 * 10 días es el plazo de retracto: después, una confirmación tardía ya no evita
 * que se extienda a 90. Los que quedan fallidos se ven en /admin/ordenes.
 */

const DIAS_BARRIDO = 10;
const ANOS_RETENCION = 2;

export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const servicio = clienteServicio();

  // 1. Barrido de pagos recientes.
  const desde = new Date(Date.now() - DIAS_BARRIDO * 86_400_000).toISOString();
  const { data: pagos, error } = await servicio
    .from("pagos_mp")
    .select("grupo_id")
    .gte("procesado_at", desde)
    .is("revertido_at", null);
  if (error) {
    console.error("[cron correos] no se pudieron leer los pagos:", JSON.stringify(error));
    return NextResponse.json({ error: "No se pudieron leer los pagos" }, { status: 500 });
  }

  const grupos = [...new Set((pagos ?? []).map((p) => p.grupo_id))];
  const resumen = { pedidos: grupos.length, enviados: 0, fallidos: 0, buzon_local: 0, ya_enviados: 0, errores: 0 };
  for (const grupo of grupos) {
    try {
      const r = await enviarCorreosDeCompra(servicio, grupo);
      for (const estado of [r.confirmacion, ...Object.values(r.ventas)]) {
        if (estado === "enviado") resumen.enviados++;
        else if (estado === "fallido") resumen.fallidos++;
        else if (estado === "buzon_local") resumen.buzon_local++;
        else if (estado === "ya_enviado") resumen.ya_enviados++;
      }
    } catch (err) {
      resumen.errores++;
      console.error("[cron correos] pedido sin procesar:", grupo, err instanceof Error ? err.message : err);
    }
  }

  // 2. Correos de tienda pendientes.
  const { data: deTienda } = await servicio
    .from("correos")
    .select("tipo, referencia")
    .like("tipo", "tienda_%")
    .in("estado", ["pendiente", "fallido"])
    .lt("intentos", MAX_INTENTOS)
    .gte("created_at", desde);
  for (const c of deTienda ?? []) {
    if (!esTipoCorreoTienda(c.tipo)) continue;
    try {
      const r = await enviarCorreoTienda(servicio, c.referencia.split(":")[0], c.tipo);
      if (r === "enviado") resumen.enviados++;
      else if (r === "fallido") resumen.fallidos++;
      else if (r === "buzon_local") resumen.buzon_local++;
    } catch (err) {
      resumen.errores++;
      console.error("[cron correos] correo de tienda sin procesar:", c.referencia, err instanceof Error ? err.message : err);
    }
  }

  // 3. Retención.
  const limite = new Date();
  limite.setFullYear(limite.getFullYear() - ANOS_RETENCION);
  const { count: borrados, error: errBorrar } = await servicio
    .from("correos")
    .delete({ count: "exact" })
    .lt("created_at", limite.toISOString());
  if (errBorrar) console.error("[cron correos] retención:", errBorrar.message);

  const { count: agotados } = await servicio
    .from("correos")
    .select("id", { count: "exact", head: true })
    .eq("estado", "fallido")
    .gte("intentos", MAX_INTENTOS);

  const salida = { ...resumen, borrados: borrados ?? 0, agotados: agotados ?? 0 };
  console.log("[cron correos]", JSON.stringify(salida));
  return NextResponse.json(salida);
}
