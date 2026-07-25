import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { traerProductoPorId } from "@/lib/productos";
import ProductoClient from "./ProductoClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // Misma consulta que usa la página: `cache()` la resuelve una sola vez por request.
  const producto = await traerProductoPorId(id);

  if (!producto) return {};

  const artista     = producto.artistas;
  const titulo      = `${producto.nombre} | MuzikChile`;
  const descripcion = producto.descripcion?.slice(0, 160) ||
    `${producto.nombre}${artista ? ` de ${artista.nombre}` : ""}`;
  const imagen      = (producto.imagenes as string[] | null)?.[0];

  return {
    title: titulo,
    description: descripcion,
    openGraph: {
      title: titulo,
      description: descripcion,
      images: imagen ? [imagen] : [],
      url: `https://tienda.muzikchile.cl/producto/${id}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descripcion,
      images: imagen ? [imagen] : [],
    },
  };
}

export default async function ProductoPage({ params }: Props) {
  const { id } = await params;

  /**
   * Comprobación server-side de existencia. Sin esto, un id inventado devolvía
   * HTTP 200 con un "Producto no encontrado" pintado en el cliente (soft 404).
   *
   * El detalle lo sigue renderizando `ProductoClient`, igual que antes.
   */
  const producto = await traerProductoPorId(id);
  if (!producto) notFound();

  return <ProductoClient id={id} />;
}
