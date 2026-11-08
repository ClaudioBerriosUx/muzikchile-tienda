import { NextResponse } from "next/server";
import { comisionEfectiva, founderVigente, textoFounder } from "@/lib/comision";
import { artistaDeLaSesion, clienteServicio } from "@/lib/mp/conexiones";
import { VERSION_TERMINOS_ARTISTAS } from "@/lib/terminos";
import type { ChecklistTienda, DespachoTienda, EstadoTienda, PanelTienda } from "@/lib/tienda";

export const dynamic = "force-dynamic";

/**
 * Lo que necesitan /panel/tienda y el menú del panel, para el artista de la
 * sesión. La versión vigente de los términos la pone el servidor.
 */
export async function GET() {
  const servicio = clienteServicio();
  const sesion = await artistaDeLaSesion(servicio);
  if (!sesion) return NextResponse.json({ error: "Sin sesión de artista" }, { status: 401 });

  const [tienda, artista, checklist, terminos, ordenes, pagadas, conexion, cuenta] = await Promise.all([
    servicio
      .from("tiendas")
      .select("estado, comentario_moderacion, identidad_mp_declarada, despacho_modo, despacho_costo, despacho_plazo_min, despacho_plazo_max, retiro_detalle, contacto_email, resuelta_at")
      .eq("artista_id", sesion.artistaId)
      .single(),
    servicio.from("artistas").select("slug, comision, es_founder, founder_hasta").eq("id", sesion.artistaId).single(),
    servicio.rpc("checklist_tienda", { p_artista_id: sesion.artistaId, p_version: VERSION_TERMINOS_ARTISTAS }),
    servicio
      .from("terminos_artistas")
      .select("version, aceptado_at")
      .eq("artista_id", sesion.artistaId)
      .order("aceptado_at", { ascending: false }),
    servicio
      .from("ordenes")
      .select("id", { count: "exact", head: true })
      .eq("artista_id", sesion.artistaId)
      .in("estado", ["pagado", "enviado", "entregado", "reembolsado"]),
    servicio
      .from("ordenes")
      .select("id", { count: "exact", head: true })
      .eq("artista_id", sesion.artistaId)
      .eq("estado", "pagado"),
    servicio.from("mp_conexiones").select("estado").eq("artista_id", sesion.artistaId).maybeSingle(),
    servicio.auth.admin.getUserById(sesion.userId),
  ]);

  const error = tienda.error ?? artista.error ?? checklist.error ?? terminos.error ?? ordenes.error ?? pagadas.error ?? conexion.error;
  if (error || !tienda.data || !artista.data) {
    console.error("[tienda] leer:", JSON.stringify(error));
    return NextResponse.json({ error: "No pudimos leer tu tienda" }, { status: 500 });
  }

  const t = tienda.data;
  const vigente = terminos.data?.find((a) => a.version === VERSION_TERMINOS_ARTISTAS);
  const ultima = terminos.data?.[0];
  const respuesta: PanelTienda = {
    artistaId: sesion.artistaId,
    slug: artista.data.slug,
    estado: t.estado as EstadoTienda,
    activaDesde: t.estado === "activa" ? t.resuelta_at : null,
    comentario: t.comentario_moderacion,
    identidadDeclarada: t.identidad_mp_declarada,
    despacho: {
      despacho_modo: t.despacho_modo as DespachoTienda["despacho_modo"],
      despacho_costo: t.despacho_costo,
      despacho_plazo_min: t.despacho_plazo_min,
      despacho_plazo_max: t.despacho_plazo_max,
      retiro_detalle: t.retiro_detalle,
    },
    contactoEmail: t.contacto_email,
    correoCuenta: cuenta.data.user?.email ?? null,
    checklist: checklist.data as unknown as ChecklistTienda,
    terminos: { version: VERSION_TERMINOS_ARTISTAS, aceptadoAt: vigente?.aceptado_at ?? null },
    ultimaAceptacion: ultima ? { version: ultima.version, aceptadoAt: ultima.aceptado_at } : null,
    comision: {
      porcentaje: comisionEfectiva(artista.data),
      detalle: founderVigente(artista.data) ? textoFounder(artista.data.founder_hasta) : null,
    },
    tieneOrdenes: (ordenes.count ?? 0) > 0,
    porDespachar: pagadas.count ?? 0,
    conexion: conexion.data ? { estado: conexion.data.estado } : null,
  };
  return NextResponse.json(respuesta);
}
