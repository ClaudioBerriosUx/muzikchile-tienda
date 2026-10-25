import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { descifrar } from "@/lib/mp/cifrado";
import { clienteServicio, renovarConexion } from "@/lib/mp/conexiones";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Fuerza la renovación del token de MP de un artista, pedida por un admin.
 * Usa renovarConexion(), el mismo camino que el cron y tokenVigente(): lock,
 * canje del refresh_token (que rota) y guardado de los tokens nuevos.
 *
 * Body: `{ artista_id }`. Devuelve el resultado y la conexión antes y después
 * (estado, vencimiento, última renovación, último error). Nunca devuelve
 * tokens: solo si cambiaron, comparando un hash.
 *
 * Seguridad: el rol se comprueba acá, con la sesión de las cookies (mismo
 * patrón que /api/revalidar-noticias y /api/admin/mp/reembolsar).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const { data: rol, error: errRol } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (errRol) {
    console.error("[renovar] error leyendo el rol:", errRol.message);
    return NextResponse.json({ error: "Error leyendo el rol" }, { status: 500 });
  }
  if (!rol) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const body: unknown = await req.json().catch(() => null);
  const artistaId = body && typeof body === "object" && "artista_id" in body ? body.artista_id : null;
  if (typeof artistaId !== "string" || !UUID.test(artistaId)) {
    return NextResponse.json({ error: "Falta el artista_id" }, { status: 400 });
  }

  const servicio = clienteServicio();
  const leer = () => servicio.from("mp_conexiones").select("*").eq("artista_id", artistaId).maybeSingle();

  const { data: antes, error } = await leer();
  if (error) return NextResponse.json({ error: "No pudimos leer la conexión" }, { status: 500 });
  if (!antes) return NextResponse.json({ error: "El artista no tiene una cuenta de MP conectada" }, { status: 404 });

  let resultado;
  try {
    resultado = await renovarConexion(servicio, antes);
  } catch (err) {
    // Solo lanza si no pudo tomar el lock (error de la base).
    console.error("[renovar] no se pudo tomar el lock:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No pudimos tomar el lock de renovación" }, { status: 500 });
  }
  const { data: despues } = await leer();

  // Solo se informa SI cambió cada token. Si no se puede descifrar (otra
  // llave), queda null.
  const huella = (cifrado: string | undefined) => {
    if (!cifrado) return null;
    try { return createHash("sha256").update(descifrar(cifrado)).digest("hex"); } catch { return null; }
  };
  const cambio = (a: string | undefined, b: string | undefined) => {
    const [ha, hb] = [huella(a), huella(b)];
    return ha && hb ? ha !== hb : null;
  };
  const resumen = (c: typeof antes | null) =>
    c ? { estado: c.estado, expires_at: c.expires_at, refrescado_at: c.refrescado_at, ultimo_error: c.ultimo_error } : null;

  return NextResponse.json({
    resultado,
    antes: resumen(antes),
    despues: resumen(despues),
    access_token_cambio: cambio(antes.access_token_cifrado, despues?.access_token_cifrado),
    refresh_token_cambio: cambio(antes.refresh_token_cifrado, despues?.refresh_token_cifrado),
  });
}
