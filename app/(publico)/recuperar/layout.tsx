import type { Metadata } from "next";

/**
 * `page.tsx` es un Client Component y no puede exportar `metadata`.
 * Igual que /login y /registro, esta pantalla no se indexa.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function RecuperarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
