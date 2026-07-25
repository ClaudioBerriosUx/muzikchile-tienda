import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { C, F } from "@/lib/portada";

/**
 * Server Component: las noticias se leen en el servidor.
 *
 * Usa el cliente anon directo (sin cookies) igual que `app/sitemap.ts`: no hace
 * falta sesión para leer publicaciones públicas, y evitar `cookies()` deja que
 * la ruta pueda cachearse en vez de volverse dinámica por sesión.
 *
 * El RLS `publicaciones_select_publico` ya limita a estado='publicada' +
 * visibilidad='publica'; los filtros explícitos son defensa en profundidad.
 */
interface NoticiaPortada {
  id: string;
  titular: string;
  bajada: string | null;
  imagen_url: string | null;
  slug: string;
  created_at: string;
  artistas: { nombre: string } | null;
}

async function traerNoticias(): Promise<NoticiaPortada[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  const supabase = createClient<Database>(url, key);

  const { data, error } = await supabase
    .from("publicaciones")
    .select("id, titular, bajada, imagen_url, slug, created_at, artistas(nombre)")
    .eq("estado", "publicada")
    .eq("tipo", "noticia")
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    // Una portada sin noticias es preferible a una portada caída.
    console.error("[portada] error cargando noticias:", error.message);
    return [];
  }
  return data ?? [];
}

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Etiqueta del artista dueño de la publicación (el "artista_relacionado" del original). */
function Artista({ nombre }: { nombre: string | null | undefined }) {
  if (!nombre) return null;
  return (
    <span
      style={{
        fontFamily: F.barlowC,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        fontSize: "12px",
        color: C.rojoClaro,
      }}
    >
      {nombre}
    </span>
  );
}

export default async function UltimasNoticias() {
  const noticias = await traerNoticias();

  // Igual que el original: sin noticias publicadas, la sección no existe.
  if (noticias.length === 0) return null;

  const [principal, ...secundarias] = noticias;

  return (
    <section style={{ backgroundColor: C.negroSuave }} className="py-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Encabezado */}
        <div className="flex items-end justify-between gap-4 mb-8">
          <h2
            className="pl-4"
            style={{
              fontFamily: F.bebas,
              fontSize: "38px",
              letterSpacing: "0.04em",
              color: C.blanco,
              lineHeight: 1.1,
              borderLeft: "4px solid transparent",
              borderImage: `linear-gradient(180deg, ${C.rojo}, ${C.rojoAcento}) 1`,
            }}
          >
            ÚLTIMAS NOTICIAS
          </h2>

          <Link
            href="/noticias"
            className="shrink-0 transition-colors"
            style={{
              fontFamily: F.barlowC,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontSize: "14px",
              color: C.gris,
            }}
          >
            Ver todas →
          </Link>
        </div>

        {/* Grid asimétrico: destacada a la izquierda, dos apiladas a la derecha */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Destacada */}
          <Link
            href={`/noticias/${principal.slug}`}
            className={`group rounded-lg overflow-hidden border transition-all duration-200 hover:-translate-y-1 lg:row-span-2 flex flex-col ${
              // Con una sola noticia, la destacada ocupa el ancho completo en vez
              // de dejar la columna derecha vacía.
              secundarias.length === 0 ? "lg:col-span-2" : ""
            }`}
            style={{ borderColor: C.borde, backgroundColor: C.negro }}
          >
            <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
              {principal.imagen_url ? (
                <img
                  src={principal.imagen_url}
                  alt={principal.titular}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full" style={{ backgroundColor: "#141414" }} />
              )}
            </div>

            <div className="p-5 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <Artista nombre={principal.artistas?.nombre} />
                <span style={{ fontFamily: F.dmSans, fontSize: "12px", color: C.grisTenue }}>
                  {fecha(principal.created_at)}
                </span>
              </div>

              <h3
                style={{
                  fontFamily: F.bebas,
                  fontSize: "28px",
                  lineHeight: 1.15,
                  letterSpacing: "0.02em",
                  color: C.blanco,
                }}
              >
                {principal.titular}
              </h3>

              {principal.bajada && (
                <p
                  className="line-clamp-3"
                  style={{ fontFamily: F.dmSans, fontSize: "14px", color: C.gris, lineHeight: 1.6 }}
                >
                  {principal.bajada}
                </p>
              )}
            </div>
          </Link>

          {/* Secundarias, horizontales */}
          <div className={`flex flex-col gap-6 ${secundarias.length === 0 ? "hidden" : ""}`}>
            {secundarias.map((n) => (
              <Link
                key={n.id}
                href={`/noticias/${n.slug}`}
                className="group rounded-lg overflow-hidden border transition-all duration-200 hover:-translate-y-1 flex"
                style={{ borderColor: C.borde, backgroundColor: C.negro }}
              >
                <div className="w-32 sm:w-40 shrink-0 overflow-hidden">
                  {n.imagen_url ? (
                    <img
                      src={n.imagen_url}
                      alt={n.titular}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full" style={{ backgroundColor: "#141414" }} />
                  )}
                </div>

                <div className="p-4 flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Artista nombre={n.artistas?.nombre} />
                    <span style={{ fontFamily: F.dmSans, fontSize: "11px", color: C.grisTenue }}>
                      {fecha(n.created_at)}
                    </span>
                  </div>

                  <h4
                    className="line-clamp-2"
                    style={{
                      fontFamily: F.bebas,
                      fontSize: "20px",
                      lineHeight: 1.2,
                      letterSpacing: "0.02em",
                      color: C.blanco,
                    }}
                  >
                    {n.titular}
                  </h4>

                  {n.bajada && (
                    <p
                      className="line-clamp-2"
                      style={{ fontFamily: F.dmSans, fontSize: "13px", color: C.gris, lineHeight: 1.5 }}
                    >
                      {n.bajada}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
