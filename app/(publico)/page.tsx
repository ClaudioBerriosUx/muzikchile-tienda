import type { Metadata } from "next";
import { C, F } from "@/lib/portada";
import SenalProvider from "./_portada/SenalProvider";
import Hero from "./_portada/Hero";
import VideosDestacados from "./_portada/VideosDestacados";
import UltimasNoticias from "./_portada/UltimasNoticias";
import GrainOverlay from "@/components/ui/GrainOverlay";

export const metadata: Metadata = {
  title: "MuzikChile — Conéctate con la música chilena",
  description:
    "Videos, noticias, convocatorias y merch de artistas chilenos. La señal online de MuzikChile.",
};

/**
 * Portada pública. Server Component: solo el hero (necesita requestFullscreen)
 * y los videos (modal + fetch al Channel) son islas cliente.
 *
 * Composición, de arriba abajo:
 *   1. Hero — el reproductor solo, sin texto de bienvenida colgando.
 *   2. respiro negro
 *   3. H1 "Conéctate…" + bajada — encabezado de la zona de contenido.
 *   4. Videos destacados
 *   5. Últimas noticias
 *
 * Los pasos 3 y 4 comparten fondo (`C.negro`) a propósito: es lo que los agrupa
 * como una sola zona y despega el H1 del reproductor. Ver el comentario largo
 * en la sección "Conecta" antes de tocar esos paddings.
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

        {/*
          ── Conecta: encabezado de la zona de contenido ──

          Va pegado a `VideosDestacados`, no al Hero. El orden en el DOM es el
          mismo de siempre; lo que cambió es de qué lado cae el corte visual.

          Antes esta sección era `negroSuave`, igual que el final del degradado
          del Hero: compartían banda, así que el H1 se leía como bajada del
          reproductor. Ahora es `negro`, el mismo fondo de `VideosDestacados`,
          y las dos secciones se leen como un solo bloque encabezado por el H1.
          Cambiar este color es el cambio, no un retoque de paso.

          Padding deliberadamente asimétrico:
          · `pt-24` (96px) + los `pb-14` del Hero = 152px de respiro negro tras
            el reproductor, que queda solo arriba como protagonista.
          · `pb-4` (16px) + los `pt-14` de `VideosDestacados` = 72px hasta
            "VIDEOS DESTACADOS": aire suficiente para que respire, poco para que
            se despegue.
          La proporción ~2:1 entre los dos huecos es lo que hace que el H1 se
          agrupe hacia abajo y no hacia arriba.
        */}
        <section style={{ backgroundColor: C.negro }} className="pt-24 pb-4">
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

      {/*
        Grano de película, EN PRUEBA. Va montado solo acá y no en el layout: si
        convence, se sube a `app/layout.tsx` y cubre el sitio entero.

        Es `position: fixed`, así que cubre el viewport completo —incluido el
        Footer, que vive en el layout— sin importar dónde esté en el árbol.
        Se monta al final por claridad; el z-index es lo que decide el orden de
        pintado, no el orden en el DOM.
      */}
      <GrainOverlay />
    </div>
  );
}
