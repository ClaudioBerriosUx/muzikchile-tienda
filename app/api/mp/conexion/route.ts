import { NextResponse } from "next/server";
import { leerConfigCobro, modoCobro } from "@/lib/cobro";
import { artistaDeLaSesion, clienteServicio } from "@/lib/mp/conexiones";

export const dynamic = "force-dynamic";

/**
 * Estado de la conexión de MP del artista de la sesión. Nunca devuelve
 * tokens. `modelo` es cómo cobra ESTE artista (lib/cobro.ts: cobro_modelo o
 * el piloto); el panel muestra el menú "Cobros" cuando es 'marketplace' o ya
 * hay una conexión.
 */
export async function GET() {
  const servicio = clienteServicio();
  const sesion = await artistaDeLaSesion(servicio);
  if (!sesion) return NextResponse.json({ error: "Sin sesión de artista" }, { status: 401 });

  const [{ data: conexion, error }, config] = await Promise.all([
    servicio
      .from("mp_conexiones")
      .select("estado, nickname, email, live_mode, expires_at, conectado_at")
      .eq("artista_id", sesion.artistaId)
      .maybeSingle(),
    leerConfigCobro(servicio).catch(() => null),
  ]);
  if (error || !config) return NextResponse.json({ error: "No pudimos leer la conexión" }, { status: 500 });

  return NextResponse.json({ modelo: modoCobro(config, sesion.artistaId), conexion: conexion ?? null });
}
