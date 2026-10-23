import { NextRequest, NextResponse } from "next/server";
import { clienteServicio, renovarConexion, type ResultadoRenovacion } from "@/lib/mp/conexiones";

export const dynamic = "force-dynamic";

/** Se renuevan los tokens que vencen dentro de este plazo (duran 180 días). */
const VENTANA_DIAS = 30;

/**
 * Cron diario de Vercel (vercel.json). Vercel manda
 * `Authorization: Bearer <CRON_SECRET>`; sin esa variable no corre.
 */
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const servicio = clienteServicio();
  const limite = new Date(Date.now() + VENTANA_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { data: conexiones, error } = await servicio
    .from("mp_conexiones")
    .select("*")
    .eq("estado", "conectado")
    .lt("expires_at", limite);
  if (error) {
    console.error("[cron mp-renovar]", JSON.stringify(error));
    return NextResponse.json({ error: "No pudimos leer las conexiones" }, { status: 500 });
  }

  const resumen: Record<ResultadoRenovacion, number> = { renovado: 0, reconectar: 0, reintentar: 0, ocupado: 0 };
  for (const conexion of conexiones ?? []) {
    resumen[await renovarConexion(servicio, conexion)]++;
  }
  console.log("[cron mp-renovar]", JSON.stringify({ revisadas: conexiones?.length ?? 0, ...resumen }));
  return NextResponse.json({ revisadas: conexiones?.length ?? 0, ...resumen });
}
