import type { Metadata } from "next";
import AdminShell from "./AdminShell";

export const dynamic = "force-dynamic";

/**
 * El panel de administración nunca se indexa. Ver la nota en
 * `app/panel/layout.tsx`: Disallow en robots.ts y noindex acá son cosas
 * distintas y se necesitan las dos.
 *
 * Este layout es un Server Component solo para poder exportar `metadata`;
 * toda la lógica (guard de rol admin, sidebar con badge, sign out) vive en
 * `AdminShell`.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
