"use client";

import Link from "next/link";
import CarritoDrawer from "@/components/ui/CarritoDrawer";

export default function Header() {
  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-6"
      style={{ backgroundColor: "#111111", height: "64px" }}
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

      {/* Búsqueda */}
      <div className="flex-1 mx-8 max-w-md">
        <input
          type="search"
          placeholder="Buscar artistas, merch, música..."
          className="w-full rounded-md px-4 py-2 text-white text-sm focus:outline-none transition-colors"
          style={{
            backgroundColor: "#1e1e1e",
            border: "1px solid #333",
            color: "#ffffff",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#e8003d")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#333")}
        />
      </div>

      {/* Derecha */}
      <div className="flex items-center gap-4 shrink-0">
        <Link
          href="/panel"
          className="text-white text-sm hover:text-[#e8003d] transition-colors"
          style={{ fontFamily: "Barlow, sans-serif" }}
        >
          Soy artista
        </Link>

        <CarritoDrawer />
      </div>
    </header>
  );
}
