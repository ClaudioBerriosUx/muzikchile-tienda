"use client";

import { useRef } from "react";
import { Maximize2 } from "lucide-react";
import { C, F } from "@/lib/portada";

/** El reproductor vive en el Channel; acá solo se embebe. */
const SRC_SEÑAL = "https://tv.muzikchile.cl/tv?embedded=true";

export default function Hero() {
  const contenedor = useRef<HTMLDivElement>(null);

  const pantallaCompleta = () => {
    const el = contenedor.current;
    if (!el) return;
    // El iframe es de otro origen: no se puede pedir fullscreen sobre su
    // documento, así que se expande el contenedor local.
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.();
    }
  };

  return (
    <section
      style={{
        background: `linear-gradient(180deg, ${C.negro} 0%, ${C.negroSuave} 100%)`,
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-14">
        {/* Badge EN VIVO */}
        <div className="flex justify-center mb-6">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border"
            style={{
              borderColor: C.rojo,
              backgroundColor: "rgba(204,0,0,0.08)",
              fontFamily: F.barlowC,
              fontSize: "13px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: C.blanco,
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: C.rojo }}
              aria-hidden
            />
            En vivo — señal online
          </span>
        </div>

        {/* Reproductor */}
        <div
          ref={contenedor}
          className="relative w-full rounded-xl overflow-hidden border"
          style={{ borderColor: C.borde, backgroundColor: C.negro }}
        >
          <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
            <iframe
              src={SRC_SEÑAL}
              title="Señal en vivo de MuzikChile TV"
              className="absolute inset-0 w-full h-full"
              style={{ border: 0 }}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>

          <button
            type="button"
            onClick={pantallaCompleta}
            aria-label="Pantalla completa"
            className="absolute bottom-3 right-3 w-9 h-9 rounded-md flex items-center justify-center transition-colors"
            style={{
              backgroundColor: "rgba(0,0,0,0.65)",
              border: `1px solid ${C.borde}`,
              color: C.blanco,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = C.rojo;
              e.currentTarget.style.borderColor = C.rojo;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.65)";
              e.currentTarget.style.borderColor = C.borde;
            }}
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
