"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CarritoDrawer from "@/components/ui/CarritoDrawer";
import { cn } from "@/lib/utils";
import Logo from "./Logo";
import { NAV_LINKS, ACCESO_ARTISTAS_HREF, type NavLink } from "./nav-links";

/**
 * Header del sitio público: una "cápsula flotante" de vidrio oscuro.
 *
 * Solo lo monta `app/(publico)/layout.tsx`. /panel y /admin usan
 * `HeaderPanel` (el header clásico de 64px, del que depende su `Sidebar`).
 *
 * MEDIDAS (contrato con `--alto-header` y `--header-ocupa` de globals.css):
 *   - El contenedor es sticky en `top: 0` con `padding-top: 14px`, así la
 *     cápsula queda siempre a 14px del borde, quieta o con scroll.
 *   - Cápsula de 62px → el header mide 76px, pero con `margin-bottom: -14px`
 *     ocupa 62px en el flujo (`--alto-header`); los 14px de abajo quedan bajo
 *     el vidrio.
 *   - Pegada arriba, la cápsula tapa hasta los 76px (`--header-ocupa`): lo
 *     usan los sticky de la página y el `scroll-padding-top` de <html>.
 *
 * El menú sale de NAV_LINKS (lo comparte el Footer): solo rutas que existen.
 * No hay botón de búsqueda porque no hay buscador global.
 */

/** Foco visible común a todos los controles del header. */
const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tema-foco";

function esActivo(pathname: string, link: NavLink) {
  if (link.external) return false;
  if (link.href === "/") return pathname === "/";
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

/** Enlace del menú: interno con <Link>, externo en pestaña nueva. */
function EnlaceNav({
  link,
  activo,
  className,
  onClick,
  children,
}: {
  link: NavLink;
  activo: boolean;
  className: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link href={link.href} aria-current={activo ? "page" : undefined} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

/** Punto rojo de 6px que marca el ítem activo. */
function PuntoActivo() {
  return <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-tema-rojo" />;
}

/** Flecha diagonal ↗ en su cuadradito, a la derecha del CTA. */
function FlechaCta() {
  return (
    <span
      aria-hidden="true"
      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-tema-fondo/25"
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9 9 3M4 3h5v5" />
      </svg>
    </span>
  );
}

// ── Menú segmentado (desktop ≥ 1024px) ───────────────────────────────────────

function NavSegmentado({ pathname }: { pathname: string }) {
  return (
    <ul className="m-0 hidden min-w-0 flex-[0_1_auto] list-none gap-0.5 overflow-hidden rounded-xl border border-tema-borde bg-tema-fondo p-1 lg:flex">
      {NAV_LINKS.map((link) => {
        const activo = esActivo(pathname, link);
        return (
          <li key={link.href} className="flex shrink-0">
            <EnlaceNav
              link={link}
              activo={activo}
              className={cn(
                "flex items-center gap-[7px] whitespace-nowrap rounded-[9px] px-3 py-2 text-sm transition-all duration-150",
                FOCO,
                activo
                  ? "bg-tema-activo font-medium text-tema-texto shadow-[inset_0_1px_0_rgba(237,237,237,0.05)]"
                  : "text-tema-texto-2 hover:bg-tema-campo hover:text-tema-texto"
              )}
            >
              {activo && <PuntoActivo />}
              {link.label}
            </EnlaceNav>
          </li>
        );
      })}
    </ul>
  );
}

// ── Menú móvil (< 1024px) ────────────────────────────────────────────────────

function BotonHamburguesa({
  abierto,
  onClick,
  botonRef,
}: {
  abierto: boolean;
  onClick: () => void;
  botonRef: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={botonRef}
      type="button"
      onClick={onClick}
      aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
      aria-expanded={abierto}
      aria-controls="menu-movil"
      className={cn(
        "flex h-11 w-11 shrink-0 cursor-pointer flex-col items-start justify-center gap-[5px] rounded-[10px] border border-tema-borde bg-tema-campo px-[13px] lg:hidden",
        FOCO
      )}
    >
      <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-tema-texto" />
      <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-tema-texto" />
      <span aria-hidden="true" className="h-0.5 w-2.5 rounded-full bg-tema-rojo" />
    </button>
  );
}

function MenuMovil({ pathname, onNavegar }: { pathname: string; onNavegar: () => void }) {
  return (
    // Es un <nav> propio: el de desktop está oculto (display: none) bajo 1024px.
    <nav
      id="menu-movil"
      aria-label="Principal"
      className="absolute inset-x-0 top-[calc(100%+8px)] rounded-2xl border border-tema-borde bg-tema-campo/96 p-2 shadow-[0_14px_40px_rgba(22,22,22,0.55)] backdrop-blur-[18px] lg:hidden"
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {NAV_LINKS.map((link) => {
          const activo = esActivo(pathname, link);
          return (
            <li key={link.href}>
              <EnlaceNav
                link={link}
                activo={activo}
                onClick={onNavegar}
                className={cn(
                  "flex min-h-11 items-center gap-[7px] rounded-[10px] px-[18px] py-3.5 text-base transition-colors duration-150",
                  FOCO,
                  activo
                    ? "bg-tema-activo font-medium text-tema-texto"
                    : "text-tema-texto-2 hover:bg-tema-hover hover:text-tema-texto"
                )}
              >
                {activo && <PuntoActivo />}
                {link.label}
              </EnlaceNav>
            </li>
          );
        })}
      </ul>
      <Link
        href={ACCESO_ARTISTAS_HREF}
        onClick={onNavegar}
        className={cn(
          "mt-2 flex min-h-12 w-full items-center justify-center gap-[9px] rounded-[10px] bg-tema-rojo px-4 text-[15px] font-medium text-tema-texto transition-colors duration-150 hover:bg-tema-rojo-hover",
          FOCO
        )}
      >
        Acceso artistas
        <FlechaCta />
      </Link>
    </nav>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

export default function Header() {
  const pathname = usePathname();

  /**
   * El menú guarda la ruta en la que se abrió: al navegar, `pathname` cambia y
   * el menú queda cerrado solo, sin un efecto que lo cierre.
   */
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const abierto = abiertoEn === pathname;
  const cerrar = () => setAbiertoEn(null);

  const raizRef = useRef<HTMLDivElement>(null);
  const hamburguesaRef = useRef<HTMLButtonElement>(null);

  // Escape y clic/toque fuera de la cápsula o del panel.
  useEffect(() => {
    if (!abierto) return;

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAbiertoEn(null);
      hamburguesaRef.current?.focus();
    };
    const alPresionar = (e: PointerEvent) => {
      if (!raizRef.current?.contains(e.target as Node)) setAbiertoEn(null);
    };

    document.addEventListener("keydown", alTeclear);
    document.addEventListener("pointerdown", alPresionar);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("pointerdown", alPresionar);
    };
  }, [abierto]);

  return (
    <header className="sticky top-0 z-40 -mb-3.5 px-6 pt-3.5">
      <div ref={raizRef} className="relative mx-auto max-w-[1300px]">
        <div
          className="flex h-[62px] items-center justify-between gap-5 rounded-2xl border border-tema-borde bg-tema-campo/78 pl-[22px] pr-2.5 shadow-[0_14px_40px_rgba(22,22,22,0.55),inset_0_1px_0_rgba(237,237,237,0.04)] backdrop-blur-[18px] backdrop-saturate-[1.2]"
        >
          {/* Logo oficial + "CHILE", apoyado en la base del wordmark (el SVG no
              tiene aire abajo: su borde inferior es la base de las letras). */}
          <Logo alto={36} prioridad className={cn("gap-[5px] rounded-md", FOCO)}>
            <span
              aria-hidden="true"
              className="self-end text-[10px] font-bold leading-[8px] tracking-[0.24em] text-tema-texto-tenue"
            >
              CHILE
            </span>
          </Logo>

          <nav aria-label="Principal" className="hidden min-w-0 lg:flex">
            <NavSegmentado pathname={pathname} />
          </nav>

          {/* Acciones */}
          <div className="flex shrink-0 items-center gap-2">
            <CarritoDrawer variante="capsula" />

            <span aria-hidden="true" className="mx-1 hidden h-[26px] w-px bg-tema-borde min-[1080px]:block" />

            <Link
              href={ACCESO_ARTISTAS_HREF}
              className={cn(
                "hidden items-center gap-[9px] whitespace-nowrap rounded-[10px] bg-tema-rojo py-[11px] pl-[18px] pr-3.5 text-sm font-medium text-tema-texto transition-colors duration-150 hover:bg-tema-rojo-hover lg:flex",
                FOCO
              )}
            >
              {/* Entre 1024 y 1080px no entra el texto completo. */}
              <span className="min-[1080px]:hidden">Artistas</span>
              <span className="hidden min-[1080px]:inline">Acceso artistas</span>
              <FlechaCta />
            </Link>

            <BotonHamburguesa
              abierto={abierto}
              botonRef={hamburguesaRef}
              onClick={() => setAbiertoEn(abierto ? null : pathname)}
            />
          </div>
        </div>

        {abierto && <MenuMovil pathname={pathname} onNavegar={cerrar} />}
      </div>
    </header>
  );
}
