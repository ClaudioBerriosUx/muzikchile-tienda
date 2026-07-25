import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Bebas_Neue,
  Oswald,
  DM_Sans,
  Barlow_Condensed,
} from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Tipografías de la portada.
 *
 * Se cargan con next/font (self-hosted, sin request a Google en runtime) y se
 * exponen como CSS variables. El resto del sitio sigue usando el @import de
 * `globals.css` con `fontFamily` inline — no se tocó para no repaginar páginas
 * existentes.
 */
const bebasNeue = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "MuzikChile Tienda",
  description: "Marketplace de música chilena",
  // ⚠️ noindex global — quitar SOLO en el lanzamiento (ver Plan MuzikChile 2.0).
  //
  // Bloquea el sitio completo para buscadores. Es deliberado mientras la
  // plataforma está en construcción; NO es un descuido.
  //
  // Al quitarlo, las rutas privadas NO quedan expuestas: /panel, /admin,
  // /checkout, /carrito, /login y /registro declaran su propio noindex en sus
  // layouts, y robots.ts bloquea /panel, /admin y /api.
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} ${oswald.variable} ${dmSans.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      {/*
        suppressHydrationWarning: extensiones del navegador (ColorZilla con
        `cz-shortcut-listen`, entre otras) inyectan atributos en <body> antes de
        que React hidrate, provocando un mismatch falso.

        Solo afecta a los atributos y al texto de ESTE elemento, un nivel de
        profundidad: los errores de hidratación reales en los hijos se siguen
        reportando normalmente.
      */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
