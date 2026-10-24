import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { traerProductoPorId } from "@/lib/productos";
import ProductoClient, { type CobroProducto } from "./ProductoClient";
import { leerConfigCobro, modoCobro } from "@/lib/cobro";
import { clienteServicio } from "@/lib/mp/conexiones";
import { BASE_URL } from "@/lib/site";

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
    alternates: { canonical: `/producto/${id}` },
    // Producto de un artista de prueba: solo por URL directa, sin indexar.
    ...(artista?.es_prueba ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: titulo,
      description: descripcion,
      images: imagen ? [imagen] : [],
      url: `${BASE_URL}/producto/${id}`,
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

  return <ProductoClient id={id} cobro={await cobroDelProducto(producto.artista_id, !!producto.artistas?.cobros_activos)} />;
}

/**
 * Cómo cobra el artista del producto (lib/cobro.ts). Solo decide qué muestra
 * el botón: el que manda es cotizar, en el servidor. Si la configuración no se
 * puede leer, se muestra como centralizado y el checkout dirá lo que corresponda.
 */
async function cobroDelProducto(artistaId: string, cobrosActivos: boolean): Promise<CobroProducto> {
  try {
    const config = await leerConfigCobro(clienteServicio());
    return { directo: modoCobro(config, artistaId) === "marketplace", disponible: cobrosActivos };
  } catch (err) {
    console.error("[producto] no se pudo leer el modo de cobro:", err instanceof Error ? err.message : err);
    return { directo: false, disponible: true };
  }
}
