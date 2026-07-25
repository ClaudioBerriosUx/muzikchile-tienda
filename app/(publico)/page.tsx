import type { Metadata } from "next";
import { C, F } from "@/lib/portada";
import SenalProvider from "./_portada/SenalProvider";
import Hero from "./_portada/Hero";
import VideosDestacados from "./_portada/VideosDestacados";
import UltimasNoticias from "./_portada/UltimasNoticias";

export const metadata: Metadata = {
  title: "MuzikChile — Conéctate con la música chilena",
  description:
    "Videos, noticias, convocatorias y merch de artistas chilenos. La señal online de MuzikChile.",
};

/**
 * Portada pública. Server Component: solo el hero (necesita requestFullscreen)
 * y los videos (modal + fetch al Channel) son islas cliente.
 *
 * ⚠️ Todavía no es pública de cara a buscadores: el noindex global de
 * `app/layout.tsx` sigue puesto y el dominio sigue redirigido. Eso se levanta
 * en el lanzamiento, no en esta tanda.
 *
 * El catálogo de productos, que antes vivía acá, ahora está en /tienda.
 */
export default function PortadaPage() {
  return (
    <div style={{ backgroundColor: C.negro }}>
      {/*
        Hero y VideosDestacados comparten estado: al abrir un destacado hay que
        callar la señal en vivo, o suenan las dos a la vez. El provider los
        envuelve a los dos; `UltimasNoticias` queda fuera porque no participa
        (y así sigue siendo Server Component).
      */}
      <SenalProvider>
        <Hero />

        {/* ── Conecta ── */}
        <section style={{ backgroundColor: C.negroSuave }} className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h1
              style={{
                fontFamily: F.oswald,
                fontSize: "clamp(30px, 5vw, 52px)",
                fontWeight: 700,
                letterSpacing: "0.01em",
                lineHeight: 1.1,
                color: C.blanco,
                textTransform: "uppercase",
              }}
            >
              Conéctate con la música chilena
            </h1>

            <p
              className="mt-5"
              style={{
                fontFamily: F.dmSans,
                fontSize: "16px",
                lineHeight: 1.7,
                color: C.gris,
              }}
            >
              Nos mueve la pasión por los cantantes chilenos. Descubre el talento de
              los artistas chilenos, llevándote lo mejor del sonido local.
            </p>
          </div>
        </section>

        <VideosDestacados />
      </SenalProvider>

      <UltimasNoticias />
    </div>
  );
}
