import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { descifrar } from "@/lib/mp/cifrado";
import { artistaDeLaSesion, clienteServicio, guardarConexion, idCuentaPlataforma } from "@/lib/mp/conexiones";
import { COOKIE_OAUTH, ErrorMP, intercambiarCodigo, obtenerUsuario } from "@/lib/mp/oauth";

export const dynamic = "force-dynamic";

interface Intento {
  state: string;
  verifier: string;
  userId: string;
  exp: number;
}

function mismoTexto(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Regreso desde MP. Valida, en este orden: la cookie del intento (cifrada, de
 * 10 minutos, de un solo uso), el state, que la sesión sea del mismo usuario
 * que empezó, y recién entonces canjea el código con el code_verifier.
 * Rechaza la cuenta de MuzikChile y una cuenta ya conectada a otro artista.
 */
export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_URL!;
  const volver = (resultado: string) => {
    const res = NextResponse.redirect(`${base}/panel/cobros?${resultado}`);
    // De un solo uso: se borra pase lo que pase.
    res.cookies.set(COOKIE_OAUTH, "", { path: "/api/mp/oauth", maxAge: 0 });
    return res;
  };

  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");

  // El artista canceló en MP (o MP devolvió error).
  if (params.get("error") || !code) return volver("error=cancelado");

  let intento: Intento;
  try {
    intento = JSON.parse(descifrar(req.cookies.get(COOKIE_OAUTH)?.value ?? ""));
  } catch {
    return volver("error=estado");
  }
  if (!state || !intento.state || !mismoTexto(state, intento.state) || Date.now() > intento.exp) {
    return volver("error=estado");
  }

  try {
    const servicio = clienteServicio();
    const sesion = await artistaDeLaSesion(servicio);
    if (!sesion || sesion.userId !== intento.userId) return volver("error=sesion");

    const token = await intercambiarCodigo(code, intento.verifier);
    const usuario = await obtenerUsuario(token.access_token);
    if (usuario.id !== Number(token.user_id)) {
      console.error("[mp oauth] user_id del token y /users/me no coinciden", token.user_id, usuario.id);
      return volver("error=mp");
    }

    if (usuario.id === (await idCuentaPlataforma(servicio))) return volver("error=cuenta_plataforma");

    const { data: otra } = await servicio
      .from("mp_conexiones")
      .select("artista_id")
      .eq("mp_user_id", usuario.id)
      .neq("artista_id", sesion.artistaId)
      .maybeSingle();
    if (otra) return volver("error=cuenta_duplicada");

    const { error } = await guardarConexion(servicio, sesion.artistaId, token, usuario);
    if (error) {
      // 23505: otro artista conectó la misma cuenta entre el chequeo y el insert.
      if (error.code === "23505") return volver("error=cuenta_duplicada");
      console.error("[mp oauth] guardar conexión:", JSON.stringify(error));
      return volver("error=mp");
    }
    return volver("conectado=1");
  } catch (err) {
    console.error("[mp oauth] callback:", err instanceof Error ? err.message : err, err instanceof ErrorMP ? JSON.stringify(err.detalle) : "");
    return volver(err instanceof ErrorMP ? "error=mp" : "error=config");
  }
}
