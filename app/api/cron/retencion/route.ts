import { NextRequest, NextResponse } from "next/server";
import { clienteServicio } from "@/lib/mp/conexiones";

export const dynamic = "force-dynamic";

/**
 * Cron diario de retención (vercel.json). Vercel manda
 * `Authorization: Bearer <CRON_SECRET>`; sin esa variable no corre.
 *
 * Plazos: ver la migración 20261026030000_retencion_datos y la política de
 * privacidad. La función SQL anonimiza órdenes, borra conexiones de MP y limpia
 * los datos de las cuentas dadas de baja hace más de un año. Lo que SQL no
 * hace bien lo hace esta ruta, con la service role:
 *   1. Comprobantes de más de 6 años: borra el archivo y, solo si se borró,
 *      limpia liquidaciones.comprobante_url (si falla, se reintenta mañana).
 *   2. Cuentas dadas de baja: borra sus fotos de Storage (carpetas
 *      artistas/{user_id} y artistas/{artistas.id}) y su usuario de Auth.
 *
 * `?simular=1` solo cuenta, sin tocar nada.
 */

type ArtistaRetencion = { artista_id: string; user_id: string | null; foto_url: string | null };
type ComprobanteRetencion = { liquidacion_id: string; ruta: string };
type Resultado = {
  simulado: boolean;
  ordenes_anonimizadas: number;
  conexiones_borradas: number;
  artistas: ArtistaRetencion[];
  comprobantes: ComprobanteRetencion[];
};

export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const simular = req.nextUrl.searchParams.get("simular") === "1";
  const servicio = clienteServicio();

  // Primero la lista (simulando), para borrar archivos antes de perder las rutas.
  const { data: lista, error: errLista } = await servicio.rpc("aplicar_retencion", { p_simular: true });
  if (errLista) {
    console.error("[cron retencion] no se pudo listar:", JSON.stringify(errLista));
    return NextResponse.json({ error: "No se pudo calcular la retención" }, { status: 500 });
  }
  // aplicar_retencion devuelve jsonb (tipado como Json): la forma la fija la
  // migración 20261026030000.
  const previo = lista as unknown as Resultado;
  if (simular) return NextResponse.json(previo);

  // 1. Comprobantes
  let comprobantesBorrados = 0;
  for (const c of previo.comprobantes) {
    const { error } = await servicio.storage.from("comprobantes").remove([c.ruta]);
    if (error) {
      console.error("[cron retencion] comprobante sin borrar:", c.liquidacion_id, error.message);
      continue;
    }
    await servicio.from("liquidaciones").update({ comprobante_url: null }).eq("id", c.liquidacion_id);
    comprobantesBorrados++;
  }

  // 2. Fotos de las cuentas que se van a limpiar (antes de que la función
  //    borre user_id, que es una de las carpetas).
  for (const a of previo.artistas) {
    for (const carpeta of [a.user_id, a.artista_id].filter(Boolean) as string[]) {
      const { data: archivos } = await servicio.storage.from("artistas").list(carpeta, { limit: 1000 });
      const rutas = (archivos ?? []).filter((f) => f.id).map((f) => `${carpeta}/${f.name}`);
      if (rutas.length) {
        const { error } = await servicio.storage.from("artistas").remove(rutas);
        if (error) console.error("[cron retencion] fotos sin borrar:", a.artista_id, error.message);
      }
    }
  }

  // 3. La función aplica órdenes, conexiones y datos de las cuentas.
  const { data: aplicado, error: errAplicar } = await servicio.rpc("aplicar_retencion", { p_simular: false });
  if (errAplicar) {
    console.error("[cron retencion] no se pudo aplicar:", JSON.stringify(errAplicar));
    return NextResponse.json({ error: "No se pudo aplicar la retención" }, { status: 500 });
  }
  const resultado = aplicado as unknown as Resultado;

  // 4. Usuarios de Auth de esas cuentas (user_roles cae por la FK en cascada).
  let usuariosBorrados = 0;
  for (const a of previo.artistas) {
    if (!a.user_id) continue;
    const { error } = await servicio.auth.admin.deleteUser(a.user_id);
    if (error) console.error("[cron retencion] usuario sin borrar:", a.artista_id, error.message);
    else usuariosBorrados++;
  }

  const resumen = {
    ordenes_anonimizadas: resultado.ordenes_anonimizadas,
    conexiones_borradas: resultado.conexiones_borradas,
    cuentas_limpiadas: previo.artistas.length,
    usuarios_borrados: usuariosBorrados,
    comprobantes_borrados: comprobantesBorrados,
  };
  console.log("[cron retencion]", JSON.stringify(resumen));
  return NextResponse.json(resumen);
}
