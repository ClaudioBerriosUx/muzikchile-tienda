import type { Metadata } from "next";

/**
 * `page.tsx` es un Client Component y no puede exportar `metadata`.
 * Set-password tras el magic link de invitación: nunca se indexa.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function RegistroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fondo del tema también en el contenedor: aunque la página quedara más baja
  // que la pantalla, nunca asoma el fondo claro del body.
  return <div className="bg-tema-fondo">{children}</div>;
}
