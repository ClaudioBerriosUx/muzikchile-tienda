"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { F } from "@/lib/portada";
import {
  alPedirPreferencias,
  guardarConsentimiento,
  leerConsentimiento,
  useConsentimiento,
} from "@/lib/consentimiento";

/**
 * Aviso de cookies y contenido de terceros (ver lib/consentimiento.ts).
 * Aparece hasta que la persona decide, y de nuevo desde "Preferencias de
 * cookies" del footer.
 *
 * Tarjeta flotante abajo a la izquierda (en móvil, ancho completo menos 16 px
 * por lado): no bloquea la página. Los tres botones son idénticos: rechazar no
 * puede costar más que aceptar. Si no caben en una fila pasan a dos, pero cada
 * uno conserva el mismo ancho (grid auto-fit, no flex-grow).
 */
export default function BannerConsentimiento() {
  const consentimiento = useConsentimiento();
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState(false);
  const [analitica, setAnalitica] = useState(false);
  const [contenido, setContenido] = useState(false);

  useEffect(
    () =>
      alPedirPreferencias(() => {
        const actual = leerConsentimiento();
        setAnalitica(actual?.analitica ?? false);
        setContenido(actual?.contenido ?? false);
        setDetalle(true);
        setAbierto(true);
      }),
    []
  );

  // undefined: todavía hidratando; no se muestra nada hasta saber.
  const visible = abierto || consentimiento === null;
  if (consentimiento === undefined || !visible) return null;

  const elegir = (eleccion: { analitica: boolean; contenido: boolean }) => {
    guardarConsentimiento(eleccion);
    setAbierto(false);
    setDetalle(false);
  };

  const boton =
    "min-h-10 rounded-md border border-tema-borde-campo bg-tema-campo px-3 py-2 text-sm font-semibold text-tema-texto transition-colors hover:bg-tema-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tema-foco";

  return (
    <section
      role="region"
      aria-label="Cookies"
      className="fixed inset-x-4 z-50 flex max-h-[calc(100dvh-32px)] flex-col gap-3 overflow-y-auto rounded-xl border border-tema-borde bg-tema-superficie p-4 text-tema-texto shadow-[0_8px_32px_rgba(0,0,0,0.45)] sm:right-auto sm:w-[420px]"
      style={{ fontFamily: F.body, bottom: "max(16px, env(safe-area-inset-bottom, 0px))" }}
    >
      <p className="text-sm leading-snug text-tema-texto-2">
        Usamos cookies opcionales para medir visitas y cargar videos de terceros. Tú eliges.{" "}
        <Link href="/privacidad#cookies" className="text-tema-azul-texto underline underline-offset-2">
          Privacidad
        </Link>
      </p>

      {detalle && (
        <fieldset className="flex flex-col gap-3 border-t border-tema-borde pt-3">
          <legend className="sr-only">Categorías de cookies</legend>
          <Opcion
            id="consent-necesarias"
            titulo="Necesarias"
            texto="Sesión, carrito y avisos que ya cerraste. Siempre activas."
            marcada
            deshabilitada
          />
          <Opcion
            id="consent-analitica"
            titulo="Estadística"
            texto="Google Analytics cuenta visitas y páginas vistas (EE.UU.)."
            marcada={analitica}
            alCambiar={setAnalitica}
          />
          <Opcion
            id="consent-contenido"
            titulo="Contenido de terceros"
            texto="Videos y publicaciones de YouTube, Spotify e Instagram en las noticias."
            marcada={contenido}
            alCambiar={setContenido}
          />
        </fieldset>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(6rem,1fr))] gap-2">
        <button type="button" className={boton} onClick={() => elegir({ analitica: false, contenido: false })}>
          Rechazar
        </button>
        <button type="button" className={boton} onClick={() => elegir({ analitica: true, contenido: true })}>
          Aceptar
        </button>
        {detalle ? (
          <button type="button" className={boton} onClick={() => elegir({ analitica, contenido })}>
            Guardar
          </button>
        ) : (
          <button type="button" className={boton} onClick={() => setDetalle(true)}>
            Configurar
          </button>
        )}
      </div>
    </section>
  );
}

function Opcion({
  id,
  titulo,
  texto,
  marcada,
  deshabilitada,
  alCambiar,
}: {
  id: string;
  titulo: string;
  texto: string;
  marcada: boolean;
  deshabilitada?: boolean;
  alCambiar?: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 text-sm">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--tema-rojo)]"
        checked={marcada}
        disabled={deshabilitada}
        onChange={(e) => alCambiar?.(e.target.checked)}
      />
      <span className="flex flex-col leading-snug">
        <span className="font-semibold">{titulo}</span>
        <span className="text-tema-texto-3">{texto}</span>
      </span>
    </label>
  );
}
