import type { Metadata } from "next";
import { Geist_Mono, Anton, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";

/**
 * Las DOS tipografías del sitio. No hay una tercera: cualquier familia que se
 * agregue acá es una decisión de marca, no un parche local.
 *
 *   ANTON   → todos los titulares (h1–h4)
 *   DM SANS → todo el cuerpo: párrafos, botones, labels, nav, tarjetas
 *
 * Se cargan con next/font (self-hosted, sin request a Google en runtime) y se
 * exponen como CSS variables. El mapeo a los tokens `--font-titulo` /
 * `--font-body` vive en `app/globals.css`, que es el único lugar donde se
 * decide qué familia usa cada rol.
 *
 * `subsets: ["latin"]` cubre el rango U+00C0–U+00FF, o sea todos los acentos y
 * la ñ del español. No hace falta "latin-ext" para contenido en castellano.
 */
const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  // Anton tiene un solo peso. Ver la nota de `font-weight` en globals.css.
  weight: "400",
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

/** Solo para la utilidad `font-mono` (códigos de cupón, N° de comprobante). */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${anton.variable} ${dmSans.variable} ${geistMono.variable} h-full antialiased`}
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
