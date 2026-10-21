import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Revalidación bajo demanda de las páginas que muestran una noticia.
 *
 * La llaman, desde el admin, aprobar / despublicar / borrar en moderación y
 * publicar o editar en el formulario editorial (helper en
 * `lib/revalidar-noticias.ts`). El `revalidate = 300` de `/` y `/noticias`
 * sigue como respaldo si esta llamada falla.
 *
 * Seguridad: el rol se comprueba ACÁ, en el servidor, con la sesión de las
 * cookies — no se confía en el guard de AdminShell. Y las rutas no vienen del
 * cliente: con el `id` se busca la nota y su autor, así que nadie puede pedir
 * revalidar rutas arbitrarias. Solo LEE: lo permite `publicaciones_select_admin`.
 *
 * Borrar llama ANTES del delete, cuando la fila todavía existe para sacar los
 * slugs (revalidar solo marca: la página se regenera en la próxima visita, que
 * ya no la encuentra). Si la nota no aparece, igual se revalidan las rutas
 * generales.
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
    console.error("[revalidar-noticias] error leyendo el rol:", errRol.message);
    return NextResponse.json({ error: "Error leyendo el rol" }, { status: 500 });
  }
  if (!rol) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const body: unknown = await req.json().catch(() => null);
  const id = body && typeof body === "object" && "id" in body ? body.id : null;
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "Falta el id de la publicación" }, { status: 400 });
  }

  const { data: nota, error } = await supabase
    .from("publicaciones")
    .select("slug, artistas(slug, es_editorial)")
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("[revalidar-noticias] error leyendo la publicación:", error.message);

  const rutas = ["/", "/noticias", "/sitemap.xml"];
  if (nota) {
    rutas.push(`/noticias/${nota.slug}`);
    // Los perfiles editoriales no tienen ficha pública.
    if (nota.artistas && !nota.artistas.es_editorial) rutas.push(`/artista/${nota.artistas.slug}`);
  }

  for (const ruta of rutas) revalidatePath(ruta);

  return NextResponse.json({ revalidadas: rutas });
}
