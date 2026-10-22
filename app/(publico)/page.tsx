import type { Metadata } from "next";
import { TEMA } from "@/lib/portada";
import SenalProvider from "./_portada/SenalProvider";
import Hero from "./_portada/Hero";
import VideosDestacados from "./_portada/VideosDestacados";
import UltimasNoticias from "./_portada/UltimasNoticias";
import Bienvenida from "./_portada/Bienvenida";
import { traerCifrasChannel } from "@/lib/cifras-channel";
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
 * La bienvenida (paso 3) pasa directo a los videos, sin línea de corte: los
 * dos bloques se leen como una sola zona. Ver `_portada/Bienvenida.tsx`.
 *
 * ⚠️ Todavía no es pública de cara a buscadores: el noindex global de
 * `app/layout.tsx` sigue puesto y el dominio sigue redirigido. Eso se levanta
 * en el lanzamiento, no en esta tanda.
 *
 * El catálogo de productos, que antes vivía acá, ahora está en /tienda.
 */
export default async function PortadaPage() {
  // Si falla, `null`: la bienvenida se pinta sin cifras.
  const cifras = await traerCifrasChannel();

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
          ── Bienvenida: encabezado de la zona de contenido ──
          Kicker, H1, bajada y cifras reales del Channel sobre `BienvenidaFondo`.
          Ver `_portada/Bienvenida.tsx` antes de tocar paddings o colores.
        */}
        <Bienvenida cifras={cifras} />

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
