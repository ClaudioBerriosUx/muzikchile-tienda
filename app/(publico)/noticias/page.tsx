import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import { C, F } from "@/lib/portada";
import { etiquetaCategoria } from "@/lib/publicaciones";
import { traerNoticias, fechaCorta } from "@/lib/noticias";

export const metadata: Metadata = {
  title: "Noticias | MuzikChile",
  description:
    "Lanzamientos, shows y notas de prensa de los artistas de la comunidad MuzikChile.",
};

/** Badge de categoría, con el pill rojo de la portada. */
function BadgeCategoria({ categoria }: { categoria: string | null }) {
  if (!categoria) return null;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full border"
      style={{
        borderColor: C.rojo,
        color: C.rojoClaro,
        fontFamily: F.barlowC,
        fontSize: "11px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      {etiquetaCategoria(categoria)}
    </span>
  );
}

export default async function NoticiasPage() {
  const noticias = await traerNoticias();

  return (
    <div style={{ backgroundColor: C.negro }} className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        {/* Encabezado, consistente con las secciones de la portada */}
        <h1
          className="pl-4 mb-3"
          style={{
            fontFamily: F.bebas,
            fontSize: "clamp(34px, 6vw, 48px)",
            letterSpacing: "0.04em",
            color: C.blanco,
            borderLeft: `4px solid ${C.rojo}`,
            lineHeight: 1.1,
          }}
        >
          NOTICIAS
        </h1>
        <p
          className="pl-4 mb-10"
          style={{ fontFamily: F.dmSans, fontSize: "15px", color: C.gris }}
        >
          Lo que están contando los artistas de la comunidad.
        </p>

        {noticias.length === 0 ? (
          <div
            className="rounded-lg border py-20 px-6 text-center"
            style={{ borderColor: C.borde, backgroundColor: C.negroSuave }}
          >
            <Newspaper size={36} className="mx-auto mb-4" style={{ color: C.grisTenue }} />
            <p
              style={{
                fontFamily: F.bebas,
                fontSize: "24px",
                letterSpacing: "0.04em",
                color: C.blanco,
              }}
            >
              TODAVÍA NO HAY NOTICIAS
            </p>
            <p
              className="mt-2"
              style={{ fontFamily: F.dmSans, fontSize: "14px", color: C.gris }}
            >
              Cuando los artistas publiquen, aparecerán acá.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {noticias.map((n) => (
              <Link
                key={n.id}
                href={`/noticias/${n.slug}`}
                className="group rounded-lg overflow-hidden border transition-all duration-200 hover:-translate-y-1 flex flex-col"
                style={{ borderColor: C.borde, backgroundColor: C.negroSuave }}
              >
                {/* Imagen */}
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
                  {n.imagen_url ? (
                    <img
                      src={n.imagen_url}
                      alt={n.titular}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full" style={{ backgroundColor: "#141414" }} />
                  )}
                </div>

                {/* Contenido */}
                <div className="p-5 flex flex-col gap-2 flex-1">
                  <BadgeCategoria categoria={n.categoria} />

                  <h2
                    className="line-clamp-3"
                    style={{
                      fontFamily: F.bebas,
                      fontSize: "24px",
                      lineHeight: 1.15,
                      letterSpacing: "0.02em",
                      color: C.blanco,
                    }}
                  >
                    {n.titular}
                  </h2>

                  {n.bajada && (
                    <p
                      className="line-clamp-3"
                      style={{
                        fontFamily: F.dmSans,
                        fontSize: "14px",
                        color: C.gris,
                        lineHeight: 1.6,
                      }}
                    >
                      {n.bajada}
                    </p>
                  )}

                  {/* Pie: artista + fecha */}
                  <div className="flex items-center gap-2 flex-wrap mt-auto pt-3">
                    <span
                      style={{
                        fontFamily: F.barlowC,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        fontSize: "12px",
                        color: C.rojoClaro,
                      }}
                    >
                      {n.artistas?.nombre ?? "—"}
                    </span>
                    <span
                      style={{ fontFamily: F.dmSans, fontSize: "12px", color: C.grisTenue }}
                    >
                      {fechaCorta(n.created_at)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
