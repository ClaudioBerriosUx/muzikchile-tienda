import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { C, F, TEMA } from "@/lib/portada";
import { etiquetaCategoria } from "@/lib/publicaciones";
import { traerNoticiaPorSlug, fechaLarga, origenNoticia } from "@/lib/noticias";
import { aTextoPlano } from "@/lib/embeds";
import { BASE_URL } from "@/lib/site";
import ContenidoNoticia from "@/components/contenido/ContenidoNoticia";
import FirmaNoticia from "@/components/noticias/FirmaNoticia";
import BadgeComunidad from "@/components/noticias/BadgeComunidad";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const noticia = await traerNoticiaPorSlug(slug);

  if (!noticia) return { title: "Noticia no encontrada | MuzikChile" };

  const titulo = noticia.titular;

  /**
   * El cuerpo es HTML con shortcodes: hay que reducirlo a texto plano antes de
   * usarlo como descripción. Si no, el meta queda con las etiquetas y los
   * `[youtube:ID]` visibles en Google y en las tarjetas al compartir.
   */
  const descripcion =
    noticia.bajada?.trim() ||
    (noticia.cuerpo ? aTextoPlano(noticia.cuerpo, 160) : "") ||
    `Publicado por ${noticia.artistas?.nombre ?? "un artista"} en MuzikChile`;

  return {
    title: `${titulo} | MuzikChile`,
    description: descripcion,
    alternates: { canonical: `/noticias/${noticia.slug}` },
    openGraph: {
      title: titulo,
      description: descripcion,
      images: noticia.imagen_url ? [noticia.imagen_url] : [],
      url: `${BASE_URL}/noticias/${noticia.slug}`,
      type: "article",
      publishedTime: noticia.fecha_publicacion,
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descripcion,
      images: noticia.imagen_url ? [noticia.imagen_url] : [],
    },
  };
}

export default async function NoticiaPage({ params }: Props) {
  const { slug } = await params;
  const noticia = await traerNoticiaPorSlug(slug);

  // No existe, o existe pero no está publicada: para el público es lo mismo.
  if (!noticia) notFound();

  return (
    <div style={{ backgroundColor: TEMA.fondo }} className="min-h-screen">
      <article className="max-w-[720px] mx-auto px-4 sm:px-6 py-12">
        <Link
          href="/noticias"
          className="inline-flex items-center gap-1.5 mb-8 transition-colors"
          style={{
            fontFamily: F.body,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontSize: "13px",
            color: TEMA.texto2,
          }}
        >
          <ArrowLeft size={14} />
          Noticias
        </Link>

        {/* Imagen destacada */}
        {noticia.imagen_url && (
          <div
            className="rounded-lg overflow-hidden border mb-8"
            style={{ borderColor: TEMA.borde }}
          >
            <img
              src={noticia.imagen_url}
              alt={noticia.titular}
              className="w-full object-cover"
              style={{ maxHeight: "460px" }}
            />
          </div>
        )}

        {/* Categoría + fecha */}
        <div className="flex items-center gap-3 flex-wrap mb-4">
          {noticia.categoria && (
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full border"
              style={{
                borderColor: C.rojo,
                color: C.rojoClaro,
                fontFamily: F.body,
                fontSize: "12px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {etiquetaCategoria(noticia.categoria)}
            </span>
          )}
          {origenNoticia(noticia) === "comunidad" && <BadgeComunidad grande />}
          <span style={{ fontFamily: F.body, fontSize: "13px", color: TEMA.texto3 }}>
            {fechaLarga(noticia.fecha_publicacion)}
          </span>
        </div>

        {/* Titular */}
        <h1
          style={{
            fontFamily: F.titulo,
            fontSize: "clamp(34px, 6vw, 52px)",
            lineHeight: 1.08,
            letterSpacing: "0.02em",
            color: C.blanco,
          }}
        >
          {noticia.titular}
        </h1>

        {/* Bajada como subtítulo */}
        {noticia.bajada && (
          <p
            className="mt-4"
            style={{
              fontFamily: F.body,
              fontSize: "19px",
              lineHeight: 1.6,
              color: TEMA.textoClaro,
              fontWeight: 500,
            }}
          >
            {noticia.bajada}
          </p>
        )}

        {/* Firma: la redacción sin enlace; un artista, enlazado a su ficha. */}
        <FirmaNoticia autor={noticia.artistas} variante="ficha" />

        {/*
          Cuerpo. Antes era `whitespace-pre-wrap` con texto plano; ahora pasa
          por ContenidoNoticia, que sanitiza el HTML en el servidor y expande
          los embeds. El texto plano de las noticias existentes se envuelve en
          párrafos automáticamente, así que no se rompe.
        */}
        <ContenidoNoticia cuerpo={noticia.cuerpo} />

        {/* Cierre */}
        <div
          className="mt-12 pt-8"
          style={{ borderTop: `1px solid ${TEMA.borde}` }}
        >
          <Link
            href="/noticias"
            className="inline-flex items-center gap-1.5 transition-colors"
            style={{
              fontFamily: F.body,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontSize: "14px",
              color: TEMA.texto2,
            }}
          >
            <ArrowLeft size={14} />
            Volver a noticias
          </Link>
        </div>
      </article>
    </div>
  );
}
