import type { Metadata } from "next";

/**
 * `page.tsx` es un Client Component y no puede exportar `metadata`.
 * Las pantallas de autenticación no se indexan.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
