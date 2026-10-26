"use client";

import { useState } from "react";
import { F } from "@/lib/portada";
import { guardarConsentimiento, leerConsentimiento, useConsentimiento } from "@/lib/consentimiento";
import { cn } from "@/lib/utils";

/**
 * Contenido de un tercero (iframe de tv., YouTube, Spotify, Instagram) que
 * solo se monta con permiso: si la categoría `contenido` está aceptada, o si la
 * persona hace clic en "Cargar" en este bloque. Mientras tanto no se pide nada
 * al tercero.
 *
 * `children` puede venir renderizado desde el servidor (ContenidoNoticia): un
 * iframe que no se monta no hace ninguna request.
 */
export default function ContenidoTercero({
  proveedor,
  detalle,
  className,
  style,
  children,
}: {
  /** Quién recibe la visita al cargar, p. ej. "YouTube". */
  proveedor: string;
  /** Qué se carga, en una línea. */
  detalle?: string;
  /** Tamaño del aviso: debe ocupar lo mismo que el contenido. */
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const consentimiento = useConsentimiento();
  const [estaVez, setEstaVez] = useState(false);

  if (consentimiento?.contenido || estaVez) return <>{children}</>;

  const permitirSiempre = () => {
    guardarConsentimiento({ analitica: leerConsentimiento()?.analitica ?? false, contenido: true });
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-tema-borde bg-tema-superficie p-4 text-center",
        className
      )}
      style={{ fontFamily: F.body, ...style }}
    >
      <p className="text-sm text-tema-texto" style={{ maxWidth: "52ch" }}>
        {detalle ?? `Contenido de ${proveedor}.`}
      </p>
      <p className="text-xs text-tema-texto-3" style={{ maxWidth: "52ch" }}>
        Al cargarlo, {proveedor} recibe tu visita y puede guardar cookies.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => setEstaVez(true)}
          className="rounded-md bg-tema-rojo px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-tema-rojo-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tema-foco"
        >
          Cargar
        </button>
        <button
          type="button"
          onClick={permitirSiempre}
          className="rounded-md border border-tema-borde-campo px-4 py-2 text-sm font-semibold text-tema-texto transition-colors hover:bg-tema-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tema-foco"
        >
          Permitir siempre
        </button>
      </div>
    </div>
  );
}
