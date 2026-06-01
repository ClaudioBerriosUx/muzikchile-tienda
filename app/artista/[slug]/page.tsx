import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ArtistaClient from "./ArtistaClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: artista } = await supabase
    .from("artistas")
    .select("nombre, bio, foto_url, seo_titulo, seo_descripcion, slug")
    .eq("slug", slug)
    .single();

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
  return <ArtistaClient slug={slug} />;
}
