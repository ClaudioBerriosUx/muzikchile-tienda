"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { C, F, TEMA } from "@/lib/portada";
import { CATEGORIAS_NOTICIA, etiquetaCategoria, type CategoriaNoticia } from "@/lib/publicaciones";
import { fechaCorta, origenNoticia, type NoticiaLista } from "@/lib/noticias";
import ImagenNoticia from "@/components/noticias/ImagenNoticia";
import FirmaNoticia, { ENLACE_ESTIRADO } from "@/components/noticias/FirmaNoticia";
import BadgeComunidad from "@/components/noticias/BadgeComunidad";

/** Grilla de 3/2/1 columnas con gap-6 dentro de `max-w-6xl` (1104px útiles). */
const SIZES_TARJETA = "(min-width: 1152px) 352px, (min-width: 1024px) 31vw, (min-width: 640px) 48vw, 100vw";

const FILTROS: { valor: CategoriaNoticia | null; etiqueta: string }[] = [
  { valor: null, etiqueta: "Todas" },
  ...CATEGORIAS_NOTICIA.map((c) => ({ valor: c.value, etiqueta: c.label })),
];

/**
 * `?categoria=` válido, o null (= Todas) para cualquier otro valor. El
 * `?origen=` del filtro anterior (Editorial/Comunidad) ni se lee: esos enlaces
 * viejos caen en "Todas".
 */
function leerCategoria(valor: string | null): CategoriaNoticia | null {
  return CATEGORIAS_NOTICIA.find((c) => c.value === valor)?.value ?? null;
}

/** Badge de categoría: pill con el rojo de marca. */
function BadgeCategoria({ categoria }: { categoria: string | null }) {
  if (!categoria) return null;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full border"
      style={{
        borderColor: TEMA.rojo,
        color: TEMA.rojoTexto,
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
 * Chips de categoría + grilla de /noticias.
 *
 * El filtro corre en el cliente para que /noticias siga siendo ISR: leer
 * `searchParams` en el servidor la volvería dinámica, y perdería el respaldo de
 * "si Supabase falla, se sirve la última versión buena". Son pocas notas, así
 * que viajan todas y se filtran acá.
 *
 * `ListadoNoticias` no lee la URL: lo usa el fallback de <Suspense> de la página
 * (HTML estático = "Todas", lo que ven los buscadores y el primer pintado).
 * `FiltroNoticias` le pasa el `?categoria=` real una vez hidratado.
 *
 * Chips: a 375px los seis no caben en una línea; en móvil hacen scroll
 * horizontal (sin salto de línea) y desde `sm` vuelven a envolver. El `py-1`
 * deja sitio al outline de foco, que el overflow si no recortaría. Si el chip
 * activo queda fuera (p. ej. `?categoria=perfil` a 375px), la fila se desplaza
 * sola hasta él; con `scrollLeft` y no `scrollIntoView`, que movería la página.
 *
 * Chip activo: texto `tema-texto` (#EDEDED) sobre `tema-rojo` (#B02F3C) =
 * 5.4:1, pasa AA para texto normal (4.5:1).
 */
export function ListadoNoticias({
  noticias,
  categoria,
}: {
  noticias: NoticiaLista[];
  categoria: CategoriaNoticia | null;
}) {
  const visibles = categoria ? noticias.filter((n) => n.categoria === categoria) : noticias;
  const filaRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const fila = filaRef.current;
    const activo = fila?.querySelector<HTMLElement>("[aria-current]");
    if (!fila || !activo) return;
    const a = activo.getBoundingClientRect();
    const f = fila.getBoundingClientRect();
    if (a.left < f.left || a.right > f.right) {
      fila.scrollLeft += a.left - f.left - (f.width - a.width) / 2;
    }
  }, [categoria]);

  return (
    <>
      <nav ref={filaRef} aria-label="Filtrar por categoría" className="flex gap-2 mb-7 py-1 overflow-x-auto [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
        {FILTROS.map((f) => {
          const activo = f.valor === categoria;
          return (
            <Link
              key={f.etiqueta}
              href={f.valor ? `/noticias?categoria=${f.valor}` : "/noticias"}
              scroll={false}
              aria-current={activo ? "page" : undefined}
              className="shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tema-azul-texto"
              style={{
                fontFamily: F.body,
                fontSize: "13px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                borderColor: activo ? TEMA.rojo : TEMA.borde,
                backgroundColor: activo ? TEMA.rojo : "transparent",
                color: activo ? TEMA.texto : TEMA.texto2,
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
          Todavía no hay notas en {etiquetaCategoria(categoria)}.
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
  const categoria = leerCategoria(useSearchParams().get("categoria"));
  return <ListadoNoticias noticias={noticias} categoria={categoria} />;
}
