import { NextResponse } from "next/server";
import { artistaDeLaSesion, clienteServicio } from "@/lib/mp/conexiones";

export const dynamic = "force-dynamic";

/**
 * Borra la conexión de MP del artista (y con ella los tokens). El trigger
 * apaga artistas.cobros_activos. La autorización en MP la puede revocar el
 * artista desde su cuenta; acá dejamos de usarla de inmediato.
 *
 * POST: la cookie de sesión es SameSite=Lax, así que otro sitio no puede
 * disparar esto a nombre del artista.
 */
export async function POST() {
  const servicio = clienteServicio();
  const sesion = await artistaDeLaSesion(servicio);
  if (!sesion) return NextResponse.json({ error: "Sin sesión de artista" }, { status: 401 });

  const { error } = await servicio.from("mp_conexiones").delete().eq("artista_id", sesion.artistaId);
  if (error) {
    console.error("[mp] desconectar:", JSON.stringify(error));
    return NextResponse.json({ error: "No pudimos desconectar la cuenta" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
