import type { Metadata } from "next";
import PanelShell from "./PanelShell";

export const dynamic = "force-dynamic";

/**
 * El panel del artista nunca se indexa. Esto es independiente del noindex
 * global de `app/layout.tsx`: cuando ese se quite en el lanzamiento, /panel
 * debe seguir fuera del índice.
 *
 * `robots.ts` además lo bloquea vía Disallow, pero un Disallow no es un
 * noindex: una URL bloqueada puede indexarse igual si alguien la enlaza.
 * Por eso van los dos.
 *
 * Este layout es un Server Component solo para poder exportar `metadata`;
 * toda la lógica (guard de sesión, sidebar, sign out) vive en `PanelShell`.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PanelShell>{children}</PanelShell>;
}
