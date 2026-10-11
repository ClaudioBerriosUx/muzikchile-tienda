import type { Metadata } from "next";

/**
 * Metadata de /tienda. Vive en un layout porque page.tsx es Client Component
 * (filtros con useSearchParams) y un Client Component no puede exportar
 * `metadata`. El canonical es /tienda sin query: los filtros
 * (?categoria=, ?region=…) son vistas de la misma página.
 */
const TITULO = "Tienda | MuzikChile";
const DESCRIPCION = "El merch oficial de tus artistas chilenos favoritos.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/tienda" },
  openGraph: { title: TITULO, description: DESCRIPCION, url: "/tienda", type: "website" },
};

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
