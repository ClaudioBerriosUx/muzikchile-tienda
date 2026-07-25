"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error boundary global. Tiene que ser Client Component y recibir `reset`:
 * es el contrato de Next para este archivo.
 *
 * No muestra `error.message` al usuario a propósito — puede traer detalles de
 * Postgres o del backend. El detalle va a la consola; el `digest` sirve para
 * cruzarlo con los logs de Vercel.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: "#111111" }}
    >
      <p
        style={{
          fontFamily: "Barlow, sans-serif",
          fontSize: "13px",
          color: "#e8003d",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}
      >
        Algo salió mal
      </p>

      <h1
        style={{
          fontFamily: "Oswald, sans-serif",
          fontSize: "44px",
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1.1,
          marginBottom: "12px",
        }}
      >
        Error inesperado
      </h1>

      <p
        className="max-w-md"
        style={{
          fontFamily: "Barlow, sans-serif",
          fontSize: "16px",
          color: "rgba(255,255,255,0.65)",
          lineHeight: 1.6,
          marginBottom: "28px",
        }}
      >
        Tuvimos un problema al cargar esta sección. Puedes reintentar o volver al
        inicio.
      </p>

      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center h-11 px-8 rounded-md font-semibold transition-colors cursor-pointer"
          style={{
            fontFamily: "Barlow, sans-serif",
            backgroundColor: "#e8003d",
            color: "#ffffff",
          }}
        >
          Reintentar
        </button>

        <Link
          href="/"
          className="inline-flex items-center justify-center h-11 px-8 rounded-md border transition-colors"
          style={{
            fontFamily: "Barlow, sans-serif",
            borderColor: "rgba(255,255,255,0.25)",
            color: "#ffffff",
          }}
        >
          Volver al inicio
        </Link>
      </div>

      {error.digest && (
        <p
          className="mt-8"
          style={{
            fontFamily: "monospace",
            fontSize: "12px",
            color: "rgba(255,255,255,0.35)",
          }}
        >
          {error.digest}
        </p>
      )}
    </div>
  );
}
