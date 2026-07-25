import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { NAV_LINKS, ACCESO_ARTISTAS_HREF } from "./nav-links";

/** Redes de MuzikChile (la plataforma, no las de cada artista). */
const REDES = [
  { label: "Instagram", href: "https://instagram.com/muzikchile" },
  { label: "YouTube",   href: "https://youtube.com/@muzikchile" },
  { label: "Spotify",   href: "https://open.spotify.com/user/muzikchile" },
  { label: "TikTok",    href: "https://tiktok.com/@muzikchile" },
];

/** Placeholders: estas rutas todavía no existen. */
const LEGALES = [
  { label: "Términos y condiciones", href: "/terminos" },
  { label: "Política de privacidad", href: "/privacidad" },
  { label: "Despachos y devoluciones", href: "/despachos" },
  { label: "Contacto", href: "/contacto" },
];

const tituloColumna: React.CSSProperties = {
  fontFamily: "Oswald, sans-serif",
  fontSize: "13px",
  fontWeight: 600,
  color: "#ffffff",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: "14px",
};

const linkStyle: React.CSSProperties = {
  fontFamily: "Barlow, sans-serif",
  fontSize: "14px",
  color: "rgba(255,255,255,0.65)",
};

export default function Footer() {
  const año = new Date().getFullYear();

  return (
    <footer style={{ backgroundColor: "#111111" }} className="mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-12 grid gap-10 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Marca */}
        <div>
          <Link
            href="/"
            className="flex items-center gap-1"
            style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "22px" }}
          >
            <span className="text-white">MuzikChile</span>
            <span style={{ color: "#e8003d" }}>·</span>
          </Link>
          <p className="mt-3 max-w-xs" style={{ ...linkStyle, lineHeight: 1.6 }}>
            Plataforma de la comunidad de artistas chilenos: videos, noticias,
            convocatorias y merch oficial.
          </p>
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
                  <Link
                    href={link.href}
                    className="hover:text-white transition-colors"
                    style={linkStyle}
                  >
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
            <li>
              <Link
                href={ACCESO_ARTISTAS_HREF}
                className="hover:text-white transition-colors"
                style={linkStyle}
              >
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
                <Link
                  href={link.href}
                  className="hover:text-white transition-colors"
                  style={linkStyle}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Redes */}
        <div>
          <h2 style={tituloColumna}>Síguenos</h2>
          <ul className="flex flex-col gap-2.5">
            {REDES.map((red) => (
              <li key={red.href}>
                <a
                  href={red.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                  style={linkStyle}
                >
                  {red.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #2a2a2a" }}>
        <div className="max-w-6xl mx-auto px-6 py-5">
          <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.45)" }}>
            © {año} MuzikChile. Hecho en Chile.
          </p>
        </div>
      </div>
    </footer>
  );
}
