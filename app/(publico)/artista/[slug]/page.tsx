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

  // Los editoriales no tienen ficha pública: la página responde 404.
  if (!artista || artista.es_editorial) return {};

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
   * Se comprueba EXISTENCIA y que no sea un perfil editorial. NO se filtra por
   * `tienda_activa` ni `verificado`: hoy hay artistas con ambos flags en false
   * cuyas fichas se enlazan desde las noticias, y filtrarlos rompería esos
   * enlaces.
   *
   * Los perfiles editoriales (la redacción MuzikChile) viven en `artistas` por
   * conveniencia del modelo de datos, pero NO son artistas: no tienen tienda ni
   * biografía musical, y esta página los mostraría con la UI de tienda de
   * artista. Para el público no existen como ficha.
   *
   * El detalle lo sigue renderizando `ArtistaClient`, igual que antes.
   */
  const artista = await traerArtistaPorSlug(slug);
  if (!artista || artista.es_editorial) notFound();

  return <ArtistaClient slug={slug} />;
}
