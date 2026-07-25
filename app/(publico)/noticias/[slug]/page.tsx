import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { C, F } from "@/lib/portada";
import { etiquetaCategoria } from "@/lib/publicaciones";
import { traerNoticiaPorSlug, fechaLarga } from "@/lib/noticias";
import { BASE_URL } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const noticia = await traerNoticiaPorSlug(slug);

  if (!noticia) return { title: "Noticia no encontrada | MuzikChile" };

  const titulo = noticia.titular;
  const descripcion =
    noticia.bajada ??
    noticia.cuerpo?.slice(0, 160) ??
    `Publicado por ${noticia.artistas?.nombre ?? "un artista"} en MuzikChile`;

  return {
    title: `${titulo} | MuzikChile`,
    description: descripcion,
    openGraph: {
      title: titulo,
      description: descripcion,
      images: noticia.imagen_url ? [noticia.imagen_url] : [],
      url: `${BASE_URL}/noticias/${noticia.slug}`,
      type: "article",
      publishedTime: noticia.created_at,
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

  const artista = noticia.artistas;

  return (
    <div style={{ backgroundColor: C.negro }} className="min-h-screen">
      <article className="max-w-[720px] mx-auto px-4 sm:px-6 py-12">
        <Link
          href="/noticias"
          className="inline-flex items-center gap-1.5 mb-8 transition-colors"
          style={{
            fontFamily: F.barlowC,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontSize: "13px",
            color: C.gris,
          }}
        >
          <ArrowLeft size={14} />
          Noticias
        </Link>

        {/* Imagen destacada */}
        {noticia.imagen_url && (
          <div
            className="rounded-lg overflow-hidden border mb-8"
            style={{ borderColor: C.borde }}
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
                fontFamily: F.barlowC,
                fontSize: "12px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {etiquetaCategoria(noticia.categoria)}
            </span>
          )}
          <span style={{ fontFamily: F.dmSans, fontSize: "13px", color: C.grisTenue }}>
            {fechaLarga(noticia.created_at)}
          </span>
        </div>

        {/* Titular */}
        <h1
          style={{
            fontFamily: F.bebas,
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
              fontFamily: F.dmSans,
              fontSize: "19px",
              lineHeight: 1.6,
              color: C.grisClaro,
              fontWeight: 500,
            }}
          >
            {noticia.bajada}
          </p>
        )}

        {/* Atribución: cada noticia es puerta de entrada al artista */}
        {artista && (
          <Link
            href={`/artista/${artista.slug}`}
            className="group flex items-center gap-3 mt-8 p-4 rounded-lg border transition-colors"
            style={{ borderColor: C.borde, backgroundColor: C.negroSuave }}
          >
            {artista.foto_url ? (
              <img
                src={artista.foto_url}
                alt={artista.nombre}
                className="w-11 h-11 rounded-full object-cover shrink-0"
                style={{ border: `2px solid ${C.rojo}` }}
              />
            ) : (
              <span
                className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center"
                style={{
                  backgroundColor: C.rojo,
                  color: C.blanco,
                  fontFamily: F.bebas,
                  fontSize: "20px",
                }}
              >
                {artista.nombre.charAt(0).toUpperCase()}
              </span>
            )}

            <span className="min-w-0">
              <span
                className="block"
                style={{
                  fontFamily: F.dmSans,
                  fontSize: "12px",
                  color: C.grisTenue,
                }}
              >
                Publicado por
              </span>
              <span
                className="block truncate"
                style={{
                  fontFamily: F.barlowC,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontSize: "17px",
                  color: C.blanco,
                }}
              >
                {artista.nombre}
              </span>
            </span>

            <span
              className="ml-auto shrink-0"
              style={{
                fontFamily: F.barlowC,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontSize: "12px",
                color: C.rojoClaro,
              }}
            >
              Ver ficha →
            </span>
          </Link>
        )}

        {/* Cuerpo */}
        {noticia.cuerpo && (
          <div
            className="mt-8 whitespace-pre-wrap"
            style={{
              fontFamily: F.dmSans,
              fontSize: "16px",
              lineHeight: 1.8,
              color: C.grisClaro,
            }}
          >
            {noticia.cuerpo}
          </div>
        )}

        {/* Cierre */}
        <div
          className="mt-12 pt-8"
          style={{ borderTop: `1px solid ${C.borde}` }}
        >
          <Link
            href="/noticias"
            className="inline-flex items-center gap-1.5 transition-colors"
            style={{
              fontFamily: F.barlowC,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontSize: "14px",
              color: C.gris,
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
