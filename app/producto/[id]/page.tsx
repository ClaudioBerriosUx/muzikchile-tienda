import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ProductoClient from "./ProductoClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: producto } = await supabase
    .from("productos")
    .select("nombre, descripcion, imagenes, precio, artistas(nombre, slug)")
    .eq("id", id)
    .single();

  if (!producto) return {};

  const artista = (Array.isArray(producto.artistas) ? producto.artistas[0] : producto.artistas) as { nombre: string; slug: string } | null;
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
  return <ProductoClient id={id} />;
}
