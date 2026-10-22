"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { C, F, TEMA } from "@/lib/portada";
import { etiquetaCategoria } from "@/lib/publicaciones";
import { fechaCorta, origenNoticia, type NoticiaLista, type OrigenNoticia } from "@/lib/noticias";
import ImagenNoticia from "@/components/noticias/ImagenNoticia";
import FirmaNoticia, { ENLACE_ESTIRADO } from "@/components/noticias/FirmaNoticia";
import BadgeComunidad from "@/components/noticias/BadgeComunidad";

/** Grilla de 3/2/1 columnas con gap-6 dentro de `max-w-6xl` (1104px útiles). */
const SIZES_TARJETA = "(min-width: 1152px) 352px, (min-width: 1024px) 31vw, (min-width: 640px) 48vw, 100vw";

const FILTROS: { valor: OrigenNoticia | null; etiqueta: string }[] = [
  { valor: null, etiqueta: "Todas" },
  { valor: "editorial", etiqueta: "Editorial" },
  { valor: "comunidad", etiqueta: "Comunidad" },
];

/** `?origen=` válido, o null (= Todas) para cualquier otro valor. */
function leerOrigen(valor: string | null): OrigenNoticia | null {
  return valor === "editorial" || valor === "comunidad" ? valor : null;
}

/** Badge de categoría, con el pill rojo de la portada. */
function BadgeCategoria({ categoria }: { categoria: string | null }) {
  if (!categoria) return null;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full border"
      style={{
        borderColor: C.rojo,
        color: C.rojoClaro,
        fontFamily: F.body,
        fontSize: "11px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      {etiquetaCategoria(categoria)}
    </span>
  );
}

function TarjetaNoticia({ n }: { n: NoticiaLista }) {
  return (
    <article
      className="group relative rounded-lg overflow-hidden border transition-all duration-200 hover:-translate-y-1 flex flex-col"
      style={{ borderColor: TEMA.borde, backgroundColor: TEMA.superficie }}
    >
      <ImagenNoticia src={n.imagen_url} alt={n.titular} sizes={SIZES_TARJETA} />

      <div className="p-5 flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <BadgeCategoria categoria={n.categoria} />
          {origenNoticia(n) === "comunidad" && <BadgeComunidad />}
        </div>

        <h2
          className="line-clamp-3"
          style={{
            fontFamily: F.titulo,
            fontSize: "24px",
            lineHeight: 1.15,
            letterSpacing: "0.02em",
            color: C.blanco,
          }}
        >
          <Link href={`/noticias/${n.slug}`} className={ENLACE_ESTIRADO}>
            {n.titular}
          </Link>
        </h2>

        {/* Bajada, o extracto del cuerpo si viene vacía. */}
        {n.resumen && (
          <p
            className="line-clamp-3"
            style={{
              fontFamily: F.body,
              fontSize: "14px",
              color: TEMA.texto2,
              lineHeight: 1.6,
            }}
          >
            {n.resumen}
          </p>
        )}

        {/* Pie: firma + fecha */}
        <div className="flex items-center gap-3 flex-wrap mt-auto pt-3">
          <FirmaNoticia autor={n.artistas} variante="tarjeta" />
          <span style={{ fontFamily: F.body, fontSize: "12px", color: TEMA.texto3 }}>
            {fechaCorta(n.fecha_publicacion)}
          </span>
        </div>
      </div>
    </article>
  );
}

/**
 * Chips de origen + grilla de /noticias.
 *
 * El filtro corre en el cliente para que /noticias siga siendo ISR: leer
 * `searchParams` en el servidor la volvería dinámica, y perdería el respaldo de
 * "si Supabase falla, se sirve la última versión buena". Son pocas notas, así
 * que viajan todas y se filtran acá.
 *
 * `ListadoNoticias` no lee la URL: lo usa el fallback de <Suspense> de la página
 * (HTML estático = "Todas", lo que ven los buscadores y el primer pintado).
 * `FiltroNoticias` le pasa el `?origen=` real una vez hidratado.
 */
export function ListadoNoticias({
  noticias,
  origen,
}: {
  noticias: NoticiaLista[];
  origen: OrigenNoticia | null;
}) {
  const visibles = origen ? noticias.filter((n) => origenNoticia(n) === origen) : noticias;

  return (
    <>
      <nav aria-label="Filtrar por origen" className="flex flex-wrap gap-2 mb-8">
        {FILTROS.map((f) => {
          const activo = f.valor === origen;
          return (
            <Link
              key={f.etiqueta}
              href={f.valor ? `/noticias?origen=${f.valor}` : "/noticias"}
              scroll={false}
              aria-current={activo ? "page" : undefined}
              className="px-4 py-1.5 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tema-azul-texto"
              style={{
                fontFamily: F.body,
                fontSize: "13px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                borderColor: activo ? C.rojo : TEMA.borde,
                backgroundColor: activo ? C.rojo : "transparent",
                color: activo ? C.blanco : TEMA.texto2,
              }}
            >
              {f.etiqueta}
            </Link>
          );
        })}
      </nav>

      {visibles.length === 0 ? (
        <p
          className="rounded-lg border py-16 px-6 text-center"
          style={{ borderColor: TEMA.borde, backgroundColor: TEMA.superficie, fontFamily: F.body, fontSize: "14px", color: TEMA.texto2 }}
        >
          {origen === "comunidad"
            ? "Todavía no hay notas de la comunidad."
            : "Todavía no hay notas editoriales."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibles.map((n) => (
            <TarjetaNoticia key={n.id} n={n} />
          ))}
        </div>
      )}
    </>
  );
}

export default function FiltroNoticias({ noticias }: { noticias: NoticiaLista[] }) {
  const origen = leerOrigen(useSearchParams().get("origen"));
  return <ListadoNoticias noticias={noticias} origen={origen} />;
}
