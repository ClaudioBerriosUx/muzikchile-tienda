"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ExternalLink } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import CarritoDrawer from "@/components/ui/CarritoDrawer";
import { NAV_LINKS, ACCESO_ARTISTAS_HREF } from "./nav-links";

/**
 * La altura de 64px es un contrato, no una decisión estética: `Sidebar` usa
 * `top-16` + `calc(100vh - 64px)` y los filtros de la home usan `sticky top-16`.
 * Cambiarla los descuadra a los dos.
 */
const ALTURA = "64px";

export default function Header() {
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const esActivo = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 md:px-6"
      style={{ backgroundColor: "#111111", height: ALTURA }}
    >
      {/* Logo */}
      <Link
        href="/"
        className="flex items-center gap-1 shrink-0"
        style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "22px" }}
      >
        <span className="text-white">MuzikChile</span>
        <span style={{ color: "#e8003d" }}>·</span>
      </Link>

      {/* Navegación desktop */}
      <NavigationMenu className="hidden md:flex flex-1 justify-start">
        <NavigationMenuList className="gap-1">
          {NAV_LINKS.map((link) => {
            const activo = !link.external && esActivo(link.href);
            const clases =
              "px-3 py-2 rounded-md text-sm transition-colors hover:bg-white/10 focus:bg-white/10 data-active:bg-white/10";

            return (
              <NavigationMenuItem key={link.href}>
                <NavigationMenuLink
                  className={clases}
                  style={{
                    fontFamily: "Barlow, sans-serif",
                    color: activo ? "#ffffff" : "rgba(255,255,255,0.75)",
                    borderBottom: activo
                      ? "2px solid #e8003d"
                      : "2px solid transparent",
                  }}
                  render={
                    link.external ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer" />
                    ) : (
                      <Link href={link.href} />
                    )
                  }
                >
                  {link.label}
                  {link.external && <ExternalLink size={12} className="opacity-60" />}
                </NavigationMenuLink>
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>

      {/* Acciones derecha */}
      <div className="flex items-center gap-3 md:gap-4 shrink-0 ml-auto md:ml-0">
        <Link
          href={ACCESO_ARTISTAS_HREF}
          className="hidden sm:inline-flex items-center h-9 px-4 rounded-md text-sm font-semibold transition-colors"
          style={{
            fontFamily: "Barlow, sans-serif",
            backgroundColor: "#e8003d",
            color: "#ffffff",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#c5002e")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#e8003d")}
        >
          Acceso artistas
        </Link>

        <CarritoDrawer />

        {/* Menú móvil */}
        <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
          <SheetTrigger
            className="md:hidden text-white bg-transparent border-0 p-0 cursor-pointer flex items-center"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </SheetTrigger>

          <SheetContent
            side="right"
            className="w-[280px] flex flex-col p-0"
            style={{ backgroundColor: "#111111" }}
          >
            <div className="px-6 py-4 border-b" style={{ borderColor: "#2a2a2a" }}>
              <SheetTitle
                className="text-white"
                style={{ fontFamily: "Oswald, sans-serif", fontSize: "18px", fontWeight: 700 }}
              >
                Menú
              </SheetTitle>
            </div>

            <nav className="flex flex-col py-2">
              {NAV_LINKS.map((link) => {
                const activo = !link.external && esActivo(link.href);
                const estilo: React.CSSProperties = {
                  fontFamily: "Barlow, sans-serif",
                  color: activo ? "#ffffff" : "rgba(255,255,255,0.75)",
                  borderLeft: activo
                    ? "3px solid #e8003d"
                    : "3px solid transparent",
                };
                const clases =
                  "flex items-center gap-2 px-6 py-3 text-sm transition-colors hover:bg-white/10";

                return link.external ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={clases}
                    style={estilo}
                    onClick={() => setMenuAbierto(false)}
                  >
                    {link.label}
                    <ExternalLink size={12} className="opacity-60" />
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={clases}
                    style={estilo}
                    onClick={() => setMenuAbierto(false)}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto p-6 border-t" style={{ borderColor: "#2a2a2a" }}>
              <Link
                href={ACCESO_ARTISTAS_HREF}
                onClick={() => setMenuAbierto(false)}
                className="flex items-center justify-center w-full h-11 rounded-md text-sm font-semibold"
                style={{
                  fontFamily: "Barlow, sans-serif",
                  backgroundColor: "#e8003d",
                  color: "#ffffff",
                }}
              >
                Acceso artistas
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
