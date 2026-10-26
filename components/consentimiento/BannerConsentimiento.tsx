"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
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
 * cookies" del footer. No bloquea la página: es una franja abajo, no un modal.
 *
 * "Solo necesarias" tiene el mismo peso visual que "Aceptar todo": rechazar no
 * puede costar más que aceptar.
 */
export default function BannerConsentimiento() {
  const consentimiento = useConsentimiento();
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState(false);
  const [analitica, setAnalitica] = useState(false);
  const [contenido, setContenido] = useState(false);
  const idTitulo = useId();

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
    "rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tema-foco";

  return (
    <section
      role="region"
      aria-labelledby={idTitulo}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-tema-borde bg-tema-superficie text-tema-texto shadow-[0_-8px_24px_rgba(0,0,0,0.35)]"
      style={{ fontFamily: F.body, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-1">
          <h2 id={idTitulo} className="text-sm font-semibold">
            Cookies y contenido de terceros
          </h2>
          <p className="text-sm text-tema-texto-2" style={{ maxWidth: "75ch" }}>
            Usamos lo necesario para que el sitio funcione (tu sesión y el carrito). Con tu permiso,
            también medimos visitas con Google Analytics y cargamos los videos y publicaciones de
            YouTube, Spotify e Instagram que aparecen en las noticias, que pueden guardar sus propias
            cookies. Más detalle en la{" "}
            <Link href="/privacidad#cookies" className="text-tema-azul-texto underline">
              política de privacidad
            </Link>
            .
          </p>
        </div>

        {detalle && (
          <fieldset className="flex flex-col gap-3 rounded-md border border-tema-borde p-3">
            <legend className="px-1 text-xs uppercase tracking-wider text-tema-texto-3">Elegir</legend>
            <Opcion
              id="consent-necesarias"
              titulo="Necesarias"
              texto="Sesión de artistas, carrito y avisos que ya cerraste. Siempre activas."
              marcada
              deshabilitada
            />
            <Opcion
              id="consent-analitica"
              titulo="Estadística (Google Analytics)"
              texto="Cuenta visitas y páginas vistas. Google procesa los datos en EE.UU."
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

        <div className="flex flex-wrap gap-2">
          {detalle ? (
            <button type="button" className={`${boton} bg-tema-rojo text-white hover:bg-tema-rojo-hover`} onClick={() => elegir({ analitica, contenido })}>
              Guardar mi elección
            </button>
          ) : (
            <button type="button" className={`${boton} border border-tema-borde-campo hover:bg-tema-hover`} onClick={() => setDetalle(true)}>
              Elegir
            </button>
          )}
          <button type="button" className={`${boton} border border-tema-borde-campo hover:bg-tema-hover`} onClick={() => elegir({ analitica: false, contenido: false })}>
            Solo necesarias
          </button>
          <button type="button" className={`${boton} bg-tema-rojo text-white hover:bg-tema-rojo-hover`} onClick={() => elegir({ analitica: true, contenido: true })}>
            Aceptar todo
          </button>
        </div>
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
        className="mt-1 h-4 w-4 accent-[var(--tema-rojo)]"
        checked={marcada}
        disabled={deshabilitada}
        onChange={(e) => alCambiar?.(e.target.checked)}
      />
      <span className="flex flex-col">
        <span className="font-semibold">{titulo}</span>
        <span className="text-tema-texto-2">{texto}</span>
      </span>
    </label>
  );
}
