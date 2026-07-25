"use client";

import { useRef } from "react";
import { Maximize2, Pause } from "lucide-react";
import { C, F } from "@/lib/portada";
import { useSenal } from "./SenalProvider";

/** El reproductor vive en el Channel; acá solo se embebe. */
const SRC_SEÑAL = "https://tv.muzikchile.cl/tv?embedded=true";

export default function Hero() {
  const contenedor = useRef<HTMLDivElement>(null);
  const { silenciada } = useSenal();

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
              // Cambiar el src a about:blank descarga la señal y con ella su
              // audio; al volver a SRC_SEÑAL el iframe la recarga.
              src={silenciada ? "about:blank" : SRC_SEÑAL}
              title="Señal en vivo de MuzikChile TV"
              className="absolute inset-0 w-full h-full"
              style={{ border: 0 }}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />

            {/* Sin esto, el hero se ve como un rectángulo negro roto mientras
                el modal está abierto. */}
            {silenciada && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none"
                style={{ backgroundColor: C.negro }}
              >
                <span
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ border: `2px solid ${C.borde}`, color: C.gris }}
                >
                  <Pause size={20} />
                </span>
                <p
                  style={{
                    fontFamily: F.barlowC,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    fontSize: "13px",
                    color: C.gris,
                    textAlign: "center",
                  }}
                >
                  Señal en pausa
                  <br />
                  <span style={{ color: C.grisTenue, letterSpacing: "0.08em" }}>
                    mientras ves el video
                  </span>
                </p>
              </div>
            )}
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
