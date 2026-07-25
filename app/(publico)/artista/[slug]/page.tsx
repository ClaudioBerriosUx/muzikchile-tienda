import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { traerArtistaPorSlug } from "@/lib/artistas";
import ArtistaClient from "./ArtistaClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // Misma consulta que usa la página: `cache()` la resuelve una sola vez por request.
  const artista = await traerArtistaPorSlug(slug);

  if (!artista) return {};

  const titulo = artista.seo_titulo ||
    `${artista.nombre} | Merch en MuzikChile`;
  const descripcion = artista.seo_descripcion ||
    artista.bio?.slice(0, 160) ||
    `Compra merch oficial de ${artista.nombre} en MuzikChile`;

  return {
    title: titulo,
    description: descripcion,
    openGraph: {
      title: titulo,
      description: descripcion,
      images: artista.foto_url ? [artista.foto_url] : [],
      url: `https://tienda.muzikchile.cl/artista/${artista.slug}`,
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descripcion,
      images: artista.foto_url ? [artista.foto_url] : [],
    },
  };
}

export default async function ArtistaPage({ params }: Props) {
  const { slug } = await params;

  /**
   * Comprobación server-side de existencia. Sin esto, un slug inventado
   * devolvía HTTP 200 con un "Artista no encontrado" pintado en el cliente
   * (soft 404), y esta ruta está en el sitemap.
   *
   * Solo se comprueba EXISTENCIA, no visibilidad: no se filtra por
   * `tienda_activa` ni `verificado`. Ver la nota en el reporte — hoy hay
   * artistas con ambos flags en false cuyas fichas se enlazan desde las
   * noticias, y filtrarlos rompería esos enlaces.
   *
   * El detalle lo sigue renderizando `ArtistaClient`, igual que antes.
   */
  const artista = await traerArtistaPorSlug(slug);
  if (!artista) notFound();

  return <ArtistaClient slug={slug} />;
}
