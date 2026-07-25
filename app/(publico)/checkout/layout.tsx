import type { Metadata } from "next";

/**
 * Cubre /checkout y sus resultados (/exito, /error, /pendiente): ninguna debe
 * indexarse nunca, ni siquiera después de quitar el noindex global.
 *
 * `page.tsx` es un Client Component y no puede exportar `metadata`.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
