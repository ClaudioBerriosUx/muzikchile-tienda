import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { comisionEfectiva, founderVigente, textoFounder } from "@/lib/comision";
import { clienteServicio } from "@/lib/mp/conexiones";
import { VERSION_TERMINOS_ARTISTAS } from "@/lib/terminos";
import type { ChecklistTienda, DespachoTienda, EstadoTienda, TiendaAdmin } from "@/lib/tienda";
import { enviarCorreoTienda } from "@/lib/correo/tienda";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Bandeja de tiendas del admin. Las funciones de estado son solo de service
 * role: el rol se comprueba acá, con la sesión de las cookies (mismo patrón que
 * /api/admin/mp/reembolsar), y quién resuelve sale de esa sesión, nunca del body.
 */
async function adminDeLaSesion(): Promise<{ userId: string } | NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const { data: rol, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (error) {
    console.error("[admin tiendas] error leyendo el rol:", error.message);
    return NextResponse.json({ error: "Error leyendo el rol" }, { status: 500 });
  }
  if (!rol) return NextResponse.json({ error: "Solo admin" }, { status: 403 });
  return { userId: user.id };
}

/** GET ?estado=solicitada (o sin filtro: todas). Nunca devuelve tokens. */
export async function GET(req: NextRequest) {
  const admin = await adminDeLaSesion();
  if (admin instanceof NextResponse) return admin;

  const servicio = clienteServicio();
  const estado = req.nextUrl.searchParams.get("estado");

  let consulta = servicio
    .from("tiendas")
    .select(`
      artista_id, estado, comentario_moderacion, identidad_mp_declarada, identidad_mp_declarada_at,
      despacho_modo, despacho_costo, despacho_plazo_min, despacho_plazo_max, retiro_detalle,
      solicitada_at, resuelta_at,
      artistas!inner(nombre, slug, es_prueba, es_editorial, cobro, comision, es_founder, founder_hasta, baja_at)
    `)
    .eq("artistas.es_editorial", false)
    .order("solicitada_at", { ascending: true, nullsFirst: false });
  if (estado) consulta = consulta.eq("estado", estado);

  const { data: filas, error } = await consulta;
  if (error) {
    console.error("[admin tiendas] listar:", JSON.stringify(error));
    return NextResponse.json({ error: "No pudimos leer las tiendas" }, { status: 500 });
  }

  const ids = filas.map((f) => f.artista_id);
  const [conexiones, terminos, productos, checklists] = await Promise.all([
    servicio.from("mp_conexiones").select("artista_id, estado, nickname, email, live_mode").in("artista_id", ids),
    servicio.from("terminos_artistas").select("artista_id, aceptado_at").eq("version", VERSION_TERMINOS_ARTISTAS).in("artista_id", ids),
    servicio.from("productos").select("id, artista_id, nombre, estado").in("artista_id", ids).order("created_at"),
    // El checklist se calcula en vivo: pudo cambiar desde la solicitud.
    Promise.all(ids.map((id) => servicio.rpc("checklist_tienda", { p_artista_id: id, p_version: VERSION_TERMINOS_ARTISTAS }))),
  ]);

  const fallo = conexiones.error ?? terminos.error ?? productos.error ?? checklists.find((c) => c.error)?.error;
  if (fallo) {
    console.error("[admin tiendas] detalle:", JSON.stringify(fallo));
    return NextResponse.json({ error: "No pudimos leer las tiendas" }, { status: 500 });
  }

  const tiendas: TiendaAdmin[] = filas.map((f, i) => {
    const conexion = conexiones.data?.find((c) => c.artista_id === f.artista_id);
    return {
      artistaId: f.artista_id,
      nombre: f.artistas.nombre,
      slug: f.artistas.slug,
      esPrueba: f.artistas.es_prueba,
      enBaja: !!f.artistas.baja_at,
      cobro: f.artistas.cobro,
      estado: f.estado as EstadoTienda,
      comentario: f.comentario_moderacion,
      solicitadaAt: f.solicitada_at,
      resueltaAt: f.resuelta_at,
      identidadDeclaradaAt: f.identidad_mp_declarada ? f.identidad_mp_declarada_at : null,
      despacho: {
        despacho_modo: f.despacho_modo as DespachoTienda["despacho_modo"],
        despacho_costo: f.despacho_costo,
        despacho_plazo_min: f.despacho_plazo_min,
        despacho_plazo_max: f.despacho_plazo_max,
        retiro_detalle: f.retiro_detalle,
      },
      checklist: checklists[i].data as unknown as ChecklistTienda,
      terminos: {
        version: VERSION_TERMINOS_ARTISTAS,
        aceptadoAt: terminos.data?.find((t) => t.artista_id === f.artista_id)?.aceptado_at ?? null,
      },
      comision: {
        porcentaje: comisionEfectiva(f.artistas),
        detalle: founderVigente(f.artistas) ? textoFounder(f.artistas.founder_hasta) : null,
      },
      conexion: conexion
        ? { estado: conexion.estado, nickname: conexion.nickname, email: conexion.email, liveMode: conexion.live_mode }
        : null,
      productos: (productos.data ?? [])
        .filter((p) => p.artista_id === f.artista_id)
        .map((p) => ({ id: p.id, nombre: p.nombre, estado: p.estado })),
    };
  });

  return NextResponse.json({ tiendas });
}

/**
 * POST { accion: 'aprobar' | 'devolver' | 'suspender', artista_id, texto? }
 *
 * Después del cambio le avisa al artista por correo (lib/correo/tienda.ts) y
 * devuelve cómo salió en `correo`: si falló, la bandeja pide avisar a mano. Un
 * correo que falla no deshace el cambio; el cron lo reintenta.
 */
export async function POST(req: NextRequest) {
  const admin = await adminDeLaSesion();
  if (admin instanceof NextResponse) return admin;

  const body: { accion?: unknown; artista_id?: unknown; texto?: unknown } | null = await req.json().catch(() => null);
  const artistaId = body?.artista_id;
  const texto = typeof body?.texto === "string" ? body.texto : "";
  if (typeof artistaId !== "string" || !UUID.test(artistaId)) {
    return NextResponse.json({ error: "Falta el artista" }, { status: 400 });
  }

  const servicio = clienteServicio();
  let resultado;
  switch (body?.accion) {
    case "aprobar":
      resultado = await servicio.rpc("aprobar_tienda", { p_artista_id: artistaId, p_admin: admin.userId, p_version: VERSION_TERMINOS_ARTISTAS });
      break;
    case "devolver":
      resultado = await servicio.rpc("devolver_tienda", { p_artista_id: artistaId, p_admin: admin.userId, p_comentario: texto });
      break;
    case "suspender":
      resultado = await servicio.rpc("suspender_tienda", { p_artista_id: artistaId, p_admin: admin.userId, p_motivo: texto });
      break;
    default:
      return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  }

  const { data, error } = resultado;
  if (error) {
    if (error.code === "22023") return NextResponse.json({ error: error.message }, { status: 422 });
    if (error.code === "P0002") return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
    console.error("[admin tiendas] acción:", JSON.stringify(error));
    return NextResponse.json({ error: "No pudimos aplicar el cambio. Intenta de nuevo." }, { status: 500 });
  }

  const tipo = ({ aprobar: "tienda_aprobada", devolver: "tienda_devuelta", suspender: "tienda_suspendida" } as const)[body.accion as "aprobar" | "devolver" | "suspender"];
  const correo = await enviarCorreoTienda(servicio, artistaId, tipo).catch((err) => {
    console.error("[admin tiendas] correo:", err instanceof Error ? err.message : err);
    return "fallido" as const;
  });
  return NextResponse.json({ estado: data, correo });
}
