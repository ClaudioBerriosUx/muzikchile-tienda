import type { Metadata } from "next";
import { C, F, TEMA } from "@/lib/portada";
import SenalProvider from "./_portada/SenalProvider";
import Hero from "./_portada/Hero";
import VideosDestacados from "./_portada/VideosDestacados";
import UltimasNoticias from "./_portada/UltimasNoticias";
import BienvenidaFondo from "./_portada/BienvenidaFondo";
import GrainOverlay from "@/components/ui/GrainOverlay";
import PopupSuscripcion from "@/components/ui/PopupSuscripcion";

/**
 * ISR cada 5 minutos, por "Últimas noticias" (ver `app/(publico)/noticias`).
 * Si la regeneración falla, se sigue sirviendo la última portada buena.
 */
export const revalidate = 300;

const TITULO = "MuzikChile — Conéctate con la música chilena";
const DESCRIPCION =
  "Videos, noticias, convocatorias y merch de artistas chilenos. La señal online de MuzikChile.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/" },
  openGraph: { title: TITULO, description: DESCRIPCION, url: "/", type: "website" },
};

/**
 * Portada pública. Server Component: solo el hero (necesita requestFullscreen)
 * y los videos (modal + fetch al Channel) son islas cliente.
 *
 * Composición, de arriba abajo:
 *   1. Hero — el reproductor solo, sin texto de bienvenida colgando.
 *   2. respiro
 *   3. Bienvenida: H1 "Conéctate…" + bajada sobre `BienvenidaFondo`.
 *   4. Videos destacados
 *   5. Últimas noticias
 *
 * El paso 3 es una banda propia, cerrada por la línea de horizonte de
 * `BienvenidaFondo`. Ver el comentario de la sección "Conecta" antes de tocar
 * sus paddings.
 *
 * ⚠️ Todavía no es pública de cara a buscadores: el noindex global de
 * `app/layout.tsx` sigue puesto y el dominio sigue redirigido. Eso se levanta
 * en el lanzamiento, no en esta tanda.
 *
 * El catálogo de productos, que antes vivía acá, ahora está en /tienda.
 */
export default function PortadaPage() {
  return (
    <div style={{ backgroundColor: TEMA.fondo }}>
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

          Historia: primero compartía color con el final del Hero (el H1 se
          leía como bajada del reproductor); después pasó al fondo de
          `VideosDestacados` para agruparse con ellos.

          2026-10-21: pasó a ser una banda propia con fondo de atmósfera
          (`BienvenidaFondo`: degradado #1C1C1C → #161616, grilla, halos,
          "ESCENA" fantasma y línea de horizonte al pie). Con la línea cerrando
          la banda, el padding ya no es asimétrico: 64/72px en móvil y 88/96px
          en desktop (diseño de Claude Design). Antes era `pt-24 pb-4`, que
          pegaba el H1 a "VIDEOS DESTACADOS".
        */}
        <section
          style={{ backgroundColor: TEMA.fondo }}
          className="relative overflow-hidden px-5 pb-[72px] pt-16 md:px-10 md:pb-24 md:pt-[88px]"
        >
          <BienvenidaFondo />
          {/* `relative`: queda por encima de las capas absolutas del fondo. */}
          <div className="relative mx-auto max-w-3xl text-center">
            <h1
              style={{
                fontFamily: F.titulo,
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
                fontFamily: F.body,
                fontSize: "16px",
                lineHeight: 1.7,
                color: TEMA.texto2,
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

      {/*
        Popup del boletín. Solo en la portada: es la puerta de entrada y la
        única página donde interrumpir se justifica. Decide solo si aparece
        (15s o 30% de scroll, con cooldown en localStorage), así que montarlo
        no implica que se vea.
      */}
      <PopupSuscripcion />
    </div>
  );
}
