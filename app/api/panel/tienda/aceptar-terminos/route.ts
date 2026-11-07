import { NextResponse } from "next/server";
import { artistaDeLaSesion, clienteServicio } from "@/lib/mp/conexiones";
import { VERSION_TERMINOS_ARTISTAS } from "@/lib/terminos";

export const dynamic = "force-dynamic";

/**
 * El artista de la sesión acepta la versión vigente de los términos. No lee
 * nada del body: la versión la pone el servidor y la fecha, la base.
 *
 * POST: la cookie de sesión es SameSite=Lax, así que otro sitio no puede
 * disparar esto a nombre del artista.
 */
export async function POST() {
  const servicio = clienteServicio();
  const sesion = await artistaDeLaSesion(servicio);
  if (!sesion) return NextResponse.json({ error: "Sin sesión de artista" }, { status: 401 });

  const { data, error } = await servicio.rpc("aceptar_terminos_artista", {
    p_artista_id: sesion.artistaId,
    p_user_id: sesion.userId,
    p_version: VERSION_TERMINOS_ARTISTAS,
  });
  if (error) {
    console.error("[tienda] aceptar términos:", JSON.stringify(error));
    return NextResponse.json({ error: "No pudimos guardar tu aceptación. Intenta de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ version: VERSION_TERMINOS_ARTISTAS, aceptadoAt: data });
}
