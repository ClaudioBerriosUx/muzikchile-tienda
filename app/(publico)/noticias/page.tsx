import type { Metadata } from "next";
import { Suspense } from "react";
import { Newspaper } from "lucide-react";
import { C, F, TEMA } from "@/lib/portada";
import { traerNoticias } from "@/lib/noticias";
import FiltroNoticias, { ListadoNoticias } from "@/components/noticias/ListadoNoticias";

/**
 * ISR cada 5 minutos. Sin esto la página era estática pura: una noticia recién
 * publicada no aparecía hasta el siguiente deploy, y un build hecho con Supabase
 * caído dejaba el feed vacío congelado. Si una regeneración falla
 * (`traerNoticias` lanza), Next sigue sirviendo la última versión buena.
 *
 * Es el respaldo: aprobar, publicar, editar, despublicar o borrar una nota desde
 * el admin revalida la página al instante (`/api/revalidar-noticias`).
 */
export const revalidate = 300;

const TITULO = "Noticias | MuzikChile";
const DESCRIPCION =
  "Notas de la redacción MuzikChile y de los artistas de la comunidad: lanzamientos, tocatas y escena.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/noticias" },
  openGraph: { title: TITULO, description: DESCRIPCION, url: "/noticias", type: "website" },
};

export default async function NoticiasPage() {
  const noticias = await traerNoticias();

  return (
    <div style={{ backgroundColor: TEMA.fondo }} className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        {/* Encabezado, consistente con las secciones de la portada */}
        <h1
          className="pl-4 mb-3"
          style={{
            fontFamily: F.titulo,
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
          style={{ fontFamily: F.body, fontSize: "15px", color: TEMA.texto2 }}
        >
          Notas de la redacción y de los artistas de la comunidad.
        </p>

        {noticias.length === 0 ? (
          <div
            className="rounded-lg border py-20 px-6 text-center"
            style={{ borderColor: TEMA.borde, backgroundColor: TEMA.superficie }}
          >
            <Newspaper size={36} className="mx-auto mb-4" style={{ color: TEMA.texto3 }} />
            <p
              style={{
                fontFamily: F.body,
                fontSize: "24px",
                letterSpacing: "0.04em",
                color: C.blanco,
              }}
            >
              TODAVÍA NO HAY NOTICIAS
            </p>
            <p
              className="mt-2"
              style={{ fontFamily: F.body, fontSize: "14px", color: TEMA.texto2 }}
            >
              Cuando los artistas publiquen, aparecerán acá.
            </p>
          </div>
        ) : (
          // Fallback = HTML estático con "Todas"; la isla aplica `?categoria=` al hidratar.
          <Suspense fallback={<ListadoNoticias noticias={noticias} categoria={null} />}>
            <FiltroNoticias noticias={noticias} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
