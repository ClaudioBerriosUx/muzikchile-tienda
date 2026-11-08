import { NextResponse } from "next/server";
import { artistaDeLaSesion, clienteServicio } from "@/lib/mp/conexiones";
import { VERSION_TERMINOS_ARTISTAS } from "@/lib/terminos";
import { enviarCorreoTienda } from "@/lib/correo/tienda";

export const dynamic = "force-dynamic";

/**
 * El artista de la sesión solicita activar su tienda. El checklist y el cambio
 * de estado los valida solicitar_tienda() en la base, en una sola transacción:
 * lo que muestre el navegador no decide nada.
 *
 * POST: la cookie de sesión es SameSite=Lax, así que otro sitio no puede
 * disparar esto a nombre del artista.
 *
 * Después avisa a MuzikChile por correo (tienda_solicitud). Si el correo falla,
 * la solicitud igual queda hecha: se ve en la bandeja y el cron lo reintenta.
 */
export async function POST() {
  const servicio = clienteServicio();
  const sesion = await artistaDeLaSesion(servicio);
  if (!sesion) return NextResponse.json({ error: "Sin sesión de artista" }, { status: 401 });

  const { data, error } = await servicio.rpc("solicitar_tienda", {
    p_artista_id: sesion.artistaId,
    p_version: VERSION_TERMINOS_ARTISTAS,
  });
  if (error) {
    // 22023: checklist incompleto o estado que no permite solicitar.
    if (error.code === "22023") return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("[tienda] solicitar:", JSON.stringify(error));
    return NextResponse.json({ error: "No pudimos enviar tu solicitud. Intenta de nuevo." }, { status: 500 });
  }
  const correo = await enviarCorreoTienda(servicio, sesion.artistaId, "tienda_solicitud").catch((err) => {
    console.error("[tienda] correo de solicitud:", err instanceof Error ? err.message : err);
    return "fallido" as const;
  });
  return NextResponse.json({ estado: data, correo });
}
