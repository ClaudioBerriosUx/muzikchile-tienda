import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Logo from "./Logo";
import { NAV_LINKS, ACCESO_ARTISTAS_HREF } from "./nav-links";
import { C, F } from "@/lib/portada";

/**
 * lucide-react v1 ya no exporta iconos de marca (Facebook, Instagram, Twitter),
 * así que van como SVG inline con los paths de simple-icons.
 */
const PATHS = {
  facebook:
    "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
  x:
    "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  instagram:
    "M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 01-2.88 0 1.44 1.44 0 012.88 0z",
  spotify:
    "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z",
} as const;

/**
 * Cuentas oficiales de MuzikChile. Las de antes eran placeholders inventados
 * (`/muzikchile` en las cuatro plataformas): ninguna resolvía a una cuenta real.
 *
 * Ojo con las que no son adivinables — si hay que reescribirlas, se copian de la
 * plataforma, no se deducen del nombre de la marca:
 *   · Instagram es `muzikchilecl`, no `muzikchile`.
 *   · El usuario de Spotify es un id numérico, no un handle.
 */
const REDES = [
  { label: "Facebook",  href: "https://web.facebook.com/muzikchile/",                        path: PATHS.facebook },
  { label: "X",         href: "https://x.com/Muzikchile",                                    path: PATHS.x },
  { label: "Instagram", href: "https://www.instagram.com/muzikchilecl/",                     path: PATHS.instagram },
  { label: "Spotify",   href: "https://open.spotify.com/user/31vwdbu464l2bt3lqquh76gwhuda",  path: PATHS.spotify },
];

/** Placeholders: estas rutas todavía no existen. */
const LEGALES = [
  { label: "Términos y condiciones", href: "/terminos" },
  { label: "Política de privacidad", href: "/privacidad" },
  { label: "Despachos y devoluciones", href: "/despachos" },
  { label: "Contacto", href: "/contacto" },
];

const tituloColumna: React.CSSProperties = {
  fontFamily: F.body,
  fontSize: "13px",
  fontWeight: 600,
  color: C.blanco,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  marginBottom: "14px",
};

const linkStyle: React.CSSProperties = {
  fontFamily: F.body,
  fontSize: "14px",
  color: C.gris,
};

export default function Footer() {
  return (
    <footer style={{ backgroundColor: C.negro }} className="mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-12 grid gap-10 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Marca */}
        <div>
          <Logo alto={44} />

          <p className="mt-3 max-w-xs" style={{ ...linkStyle, lineHeight: 1.6 }}>
            Plataforma de la comunidad de artistas chilenos: videos, noticias,
            convocatorias y merch oficial.
          </p>

          {/*
            Redes.

            El hover va por clases de Tailwind y NO por `onMouseEnter` como el
            botón del Header: este Footer es Server Component, y un handler de
            eventos no cruza esa frontera. `text-brand-rojo` sale del `@theme`
            de `globals.css`, así que el hex #BF0411 vive en un solo lugar.

            El color tiene que ir en clases, no en el `style` inline: un estilo
            inline le gana en especificidad a `hover:` y el hover no se vería.
            Por eso ahí abajo solo queda el borde.

            El `fill="currentColor"` del SVG es lo que hace que el icono herede
            ese color y se anime con la transición del <a>.
          */}
          <div className="flex items-center gap-3 mt-5">
            {REDES.map((r) => (
              <a
                key={r.label}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`MuzikChile en ${r.label}`}
                className="w-9 h-9 rounded-md flex items-center justify-center text-white hover:text-brand-rojo transition-colors duration-200"
                style={{ border: `1px solid ${C.borde}` }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
                  <path d={r.path} />
                </svg>
              </a>
            ))}
          </div>
        </div>

        {/* Navegación */}
        <div>
          <h2 style={tituloColumna}>Explorar</h2>
          <ul className="flex flex-col gap-2.5">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                {link.external ? (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                    style={linkStyle}
                  >
                    {link.label}
                    <ExternalLink size={11} className="opacity-60" />
                  </a>
                ) : (
                  <Link href={link.href} className="hover:text-white transition-colors" style={linkStyle}>
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
            <li>
              <Link href={ACCESO_ARTISTAS_HREF} className="hover:text-white transition-colors" style={linkStyle}>
                Acceso artistas
              </Link>
            </li>
          </ul>
        </div>

        {/* Legales */}
        <div>
          <h2 style={tituloColumna}>Legal</h2>
          <ul className="flex flex-col gap-2.5">
            {LEGALES.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-white transition-colors" style={linkStyle}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Tienda */}
        <div>
          <h2 style={tituloColumna}>Tienda</h2>
          <ul className="flex flex-col gap-2.5">
            <li>
              <Link href="/tienda" className="hover:text-white transition-colors" style={linkStyle}>
                Ver catálogo
              </Link>
            </li>
            <li>
              <Link href="/carrito" className="hover:text-white transition-colors" style={linkStyle}>
                Mi carrito
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${C.borde}` }}>
        <div className="max-w-6xl mx-auto px-6 py-5">
          <p style={{ fontFamily: F.body, fontSize: "13px", color: C.grisTenue }}>
            MuzikChile 2024 — 2026
          </p>
        </div>
      </div>
    </footer>
  );
}
