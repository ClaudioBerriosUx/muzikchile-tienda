"use client";

import { useEffect, useRef } from "react";
import { Maximize2, Pause } from "lucide-react";
import { C, F, MARCA } from "@/lib/portada";
import { useSenal } from "./SenalProvider";
import {
  MODO_INTERRUPCION,
  MSG_READY,
  ORIGEN_CHANNEL,
  REQUIERE_HANDSHAKE,
  enviarAlChannel,
} from "./protocolo-senal";

/** El reproductor vive en el Channel; acá solo se embebe. */
const SRC_SEÑAL = "https://tv.muzikchile.cl/tv?embedded=true";

export default function Hero() {
  const contenedor = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { silenciada } = useSenal();

  /**
   * ¿El iframe ya puede recibir órdenes?
   *
   * Con el protocolo legacy arranca en true: el listener del Channel se monta
   * junto con su componente y nunca anuncia nada. Si se esperara un
   * `muzik-embed-ready` que hoy no llega, no se enviaría ni un comando.
   *
   * Con el protocolo embed arranca en false y se levanta al recibir el ready.
   */
  const listo = useRef(!REQUIERE_HANDSHAKE);

  /** Última intención pedida mientras el iframe todavía no estaba listo. */
  const pendiente = useRef<boolean | null>(null);

  // Handshake del iframe (solo relevante con el protocolo embed).
  useEffect(() => {
    const alRecibir = (evento: MessageEvent) => {
      // Nunca confiar en un mensaje sin verificar de dónde viene.
      if (evento.origin !== ORIGEN_CHANNEL) return;

      const tipo =
        typeof evento.data === "object" && evento.data !== null
          ? (evento.data as { type?: string }).type
          : evento.data;

      if (tipo !== MSG_READY) return;

      listo.current = true;

      // Si el usuario abrió un destacado antes de que el iframe estuviera
      // listo, la orden no se pierde: se aplica ahora.
      if (pendiente.current !== null) {
        enviarAlChannel(
          iframeRef.current,
          pendiente.current ? "interrumpir" : "reanudar"
        );
        pendiente.current = null;
      }
    };

    window.addEventListener("message", alRecibir);
    return () => window.removeEventListener("message", alRecibir);
  }, []);

  /**
   * Traduce el estado compartido a una orden concreta al reproductor.
   *
   * Antes esto se hacía cambiando el `src` a about:blank, lo que descargaba el
   * reproductor y lo obligaba a recargar al volver. Con postMessage el iframe
   * nunca se recarga.
   *
   * Este efecto sí corresponde: sincroniza estado de React con un sistema
   * externo (el reproductor del otro origen). No hace setState, así que no
   * dispara renders en cascada.
   */
  useEffect(() => {
    if (!listo.current) {
      // Se guarda la última intención, no una cola: si el usuario abre y cierra
      // varios videos antes del ready, solo importa cómo debe quedar al final.
      pendiente.current = silenciada;
      return;
    }

    enviarAlChannel(iframeRef.current, silenciada ? "interrumpir" : "reanudar");
  }, [silenciada]);

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
        {/*
          Badge "Sonando ahora".

          Alineado a la izquierda, a ras del borde del reproductor: los dos
          cuelgan del mismo contenedor, así que basta con no centrarlo.

          El halo y el punto son el mismo rojo de marca; lo que los distingue es
          la opacidad, que `.halo-senal` modula en `globals.css`. Por eso el halo
          no lleva un `rgba()` propio: el hex vive solo en el token.
        */}
        <div
          className="mb-6"
          style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
        >
          <span
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "8px",
              height: "8px",
            }}
            aria-hidden
          >
            <span
              className="halo-senal"
              style={{
                position: "absolute",
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                backgroundColor: MARCA.rojo,
              }}
            />
            <span
              style={{
                position: "relative",
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                backgroundColor: MARCA.rojo,
              }}
            />
          </span>

          <span
            style={{
              color: MARCA.texto,
              fontSize: "12px",
              letterSpacing: "1px",
              fontWeight: 500,
              fontFamily: F.body,
              // Las mayúsculas las pone el CSS: en el JSX el texto queda legible
              // y traducible, y no hay que reescribirlo si el estilo cambia.
              textTransform: "uppercase",
            }}
          >
            Sonando ahora
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
              ref={iframeRef}
              // El src es fijo: la pausa va por postMessage, así que el
              // reproductor nunca se descarga ni se recarga.
              src={SRC_SEÑAL}
              title="Señal en vivo de MuzikChile TV"
              className="absolute inset-0 w-full h-full"
              style={{ border: 0 }}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />

            {/* Semitransparente, no opaco: ahora el reproductor sigue montado y
                se ve el cuadro congelado detrás. Taparlo del todo haría parecer
                que se descargó, que es justo lo que dejó de pasar. */}
            {silenciada && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none"
                style={{ backgroundColor: "rgba(0,0,0,0.72)" }}
              >
                <span
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ border: `2px solid ${C.borde}`, color: C.gris }}
                >
                  <Pause size={20} />
                </span>
                <p
                  style={{
                    fontFamily: F.body,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    fontSize: "13px",
                    color: C.gris,
                    textAlign: "center",
                  }}
                >
                  {/* El texto sigue al modo activo para no mentir: hoy la señal
                      se pausa de verdad; en modo "silenciar" seguiría corriendo. */}
                  {MODO_INTERRUPCION === "pausar" ? "Señal en pausa" : "Señal silenciada"}
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
