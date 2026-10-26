import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Logo from "./Logo";
import BotonPreferenciasCookies from "@/components/consentimiento/BotonPreferenciasCookies";
import { NAV_LINKS, ACCESO_ARTISTAS_HREF, TIENDA_VISIBLE } from "./nav-links";
import { C, F, TEMA } from "@/lib/portada";
import { PATHS_MARCA as PATHS } from "./iconos-marca";

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

/**
 * Solo rutas que existen. "Términos y condiciones" (/terminos) y "Despachos y
 * devoluciones" (/despachos) se sacaron para el lanzamiento porque daban 404.
 */
const LEGALES = [
  { label: "Política de privacidad", href: "/privacidad" },
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
  color: TEMA.texto2,
};

export default function Footer() {
  return (
    <footer style={{ backgroundColor: TEMA.fondoProfundo }} className="mt-auto">
      <div className={`max-w-6xl mx-auto px-6 py-12 grid gap-10 grid-cols-1 sm:grid-cols-2 ${TIENDA_VISIBLE ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
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
                style={{ border: `1px solid ${TEMA.borde}` }}
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
            <li>
              {/* Vuelve a abrir el banner de consentimiento (lib/consentimiento.ts). */}
              <BotonPreferenciasCookies className="hover:text-white transition-colors text-left" style={linkStyle} />
            </li>
          </ul>
        </div>

        {/* Tienda: oculta en los menús mientras TIENDA_VISIBLE sea false. */}
        {TIENDA_VISIBLE && (
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
        )}
      </div>

      <div style={{ borderTop: `1px solid ${TEMA.borde}` }}>
        <div className="max-w-6xl mx-auto px-6 py-5">
          <p style={{ fontFamily: F.body, fontSize: "13px", color: TEMA.texto3 }}>
            MuzikChile 2024 — 2026
          </p>
        </div>
      </div>
    </footer>
  );
}
