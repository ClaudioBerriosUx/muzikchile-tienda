import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página no encontrada | MuzikChile",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: "#111111" }}
    >
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "13px",
          color: "#e8003d",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}
      >
        Error 404
      </p>

      <h1
        style={{
          fontFamily: "var(--font-titulo)",
          fontSize: "44px",
          color: "#ffffff",
          lineHeight: 1.1,
          marginBottom: "12px",
        }}
      >
        Esta página no existe
      </h1>

      <p
        className="max-w-md"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "16px",
          color: "rgba(255,255,255,0.65)",
          lineHeight: 1.6,
          marginBottom: "28px",
        }}
      >
        Puede que el enlace esté roto o que la sección todavía no esté publicada.
      </p>

      <Link
        href="/"
        className="inline-flex items-center justify-center h-11 px-8 rounded-md font-semibold transition-colors"
        style={{
          fontFamily: "var(--font-body)",
          backgroundColor: "#e8003d",
          color: "#ffffff",
        }}
      >
        Volver al inicio
      </Link>
    </div>
  );
}
