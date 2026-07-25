import type { Metadata } from "next";

/**
 * `page.tsx` es un Client Component y no puede exportar `metadata`, así que el
 * noindex de esta ruta vive acá.
 *
 * Esto es independiente del noindex global de `app/layout.tsx`: cuando ese se
 * quite en el lanzamiento, el carrito debe seguir fuera del índice.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CarritoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
