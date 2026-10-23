import { NextResponse } from "next/server";
import { cifrar } from "@/lib/mp/cifrado";
import { artistaDeLaSesion, clienteServicio } from "@/lib/mp/conexiones";
import { COOKIE_OAUTH, nuevoIntento, urlAutorizacion } from "@/lib/mp/oauth";

export const dynamic = "force-dynamic";

const VIGENCIA_S = 10 * 60;

/**
 * Inicio del OAuth: el botón "Conectar Mercado Pago" de /panel/cobros navega
 * acá. Genera state + PKCE, los guarda en una cookie httpOnly cifrada (atada al
 * usuario de la sesión) y redirige a la autorización de MP.
 */
export async function GET() {
  const base = process.env.NEXT_PUBLIC_URL!;
  try {
    const sesion = await artistaDeLaSesion(clienteServicio());
    if (!sesion) return NextResponse.redirect(`${base}/login?redirectTo=/panel/cobros`);

    const { verifier, challenge, state } = nuevoIntento();
    const res = NextResponse.redirect(urlAutorizacion(state, challenge));
    res.cookies.set(COOKIE_OAUTH, cifrar(JSON.stringify({
      state,
      verifier,
      userId: sesion.userId,
      exp: Date.now() + VIGENCIA_S * 1000,
    })), {
      httpOnly: true,
      secure: base.startsWith("https://"),
      // Lax: el regreso desde MP es una navegación GET de primer nivel, así
      // que la cookie viaja; un POST cruzado desde otro sitio, no.
      sameSite: "lax",
      path: "/api/mp/oauth",
      maxAge: VIGENCIA_S,
    });
    return res;
  } catch (err) {
    console.error("[mp oauth] iniciar:", err);
    return NextResponse.redirect(`${base}/panel/cobros?error=config`);
  }
}
