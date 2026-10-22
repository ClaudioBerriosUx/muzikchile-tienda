"use client";

import { useEffect, useRef, useState } from "react";
import { C, F } from "@/lib/portada";
import { PATHS_MARCA } from "@/components/layout/iconos-marca";
import { urlInstagram, urlPostInstagram } from "@/lib/embed-instagram";

/**
 * Post o reel de Instagram dentro de una noticia, con CARGA DIFERIDA.
 *
 * Hasta que el lector hace clic no hay iframe ni ninguna petición a Meta (y por
 * lo tanto ninguna cookie suya): solo una tarjeta con un enlace al post. Recién
 * al pedirlo se monta el iframe a `/embed/captioned/`.
 *
 * No se usa embed.js de Instagram: el iframe puro basta, y así no corre script
 * de terceros en nuestra página. El alto se ajusta con los mensajes `MEASURE`
 * que manda el propio iframe, filtrados por origen y por ventana emisora.
 *
 * Si el post se borró o no permite inserción, un iframe de otro origen no lo
 * puede reportar: Instagram muestra su propio aviso adentro. Por eso el enlace
 * "Ver publicación en Instagram" queda SIEMPRE visible bajo el iframe, y si no
 * llega ninguna medida en TIEMPO_ESPERA el iframe se retira y queda solo el
 * enlace — nunca un hueco sin salida.
 *
 * `valor` llega validado por `validarInstagram` ("p/CODIGO" o "reel/CODIGO").
 */

const ORIGEN_INSTAGRAM = "https://www.instagram.com";
const ALTO_INICIAL = 640;
const TIEMPO_ESPERA = 10_000;

type Estado = "tarjeta" | "cargando" | "listo" | "fallido";

/** El iframe manda `{"type":"MEASURE","details":{"height":N}}`, a veces como string. */
function altoDeMensaje(data: unknown): number | null {
  let msg = data;
  if (typeof msg === "string") {
    try {
      msg = JSON.parse(msg);
    } catch {
      return null;
    }
  }
  if (!msg || typeof msg !== "object") return null;
  const { type, details } = msg as { type?: unknown; details?: { height?: unknown } };
  const alto = details?.height;
  return type === "MEASURE" && typeof alto === "number" && alto > 0 ? alto : null;
}

export default function EmbedInstagram({ valor }: { valor: string }) {
  const [estado, setEstado] = useState<Estado>("tarjeta");
  const [alto, setAlto] = useState(ALTO_INICIAL);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const esReel = valor.startsWith("reel/");
  const urlPost = urlPostInstagram(valor);

  useEffect(() => {
    if (estado !== "cargando" && estado !== "listo") return;

    const alRecibir = (e: MessageEvent) => {
      if (e.origin !== ORIGEN_INSTAGRAM) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      const medida = altoDeMensaje(e.data);
      if (medida === null) return;
      setAlto(Math.min(Math.ceil(medida), 2000));
      setEstado("listo");
    };
    window.addEventListener("message", alRecibir);

    // Sin ninguna medida a tiempo: el post no carga (borrado, privado, sin
    // inserción o bloqueado por el navegador). Queda solo el enlace.
    const espera =
      estado === "cargando" ? window.setTimeout(() => setEstado("fallido"), TIEMPO_ESPERA) : undefined;

    return () => {
      window.removeEventListener("message", alRecibir);
      window.clearTimeout(espera);
    };
  }, [estado]);

  const enlace = (texto: string) => (
    <a
      href={urlPost}
      target="_blank"
      rel="noopener noreferrer"
      className="underline-offset-4 hover:underline"
      style={{ fontFamily: F.body, fontSize: "14px", color: C.rojoClaro }}
    >
      {texto} →
    </a>
  );

  if (estado === "tarjeta") {
    return (
      <div
        className="my-8 mx-auto w-full max-w-[540px] rounded-lg border p-5 flex flex-col gap-4"
        style={{ borderColor: C.borde, backgroundColor: C.negroSuave }}
      >
        <div className="flex items-center gap-3">
          <span
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center border"
            style={{ borderColor: C.rojo, color: C.rojoClaro }}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d={PATHS_MARCA.instagram} />
            </svg>
          </span>
          <div className="min-w-0">
            <p style={{ fontFamily: F.body, fontSize: "15px", fontWeight: 600, color: C.blanco }}>
              {esReel ? "Reel de Instagram" : "Publicación de Instagram"}
            </p>
            <p style={{ fontFamily: F.body, fontSize: "12px", color: C.gris }}>
              Al cargarla, Instagram puede guardar cookies en tu navegador.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <button
            type="button"
            onClick={() => setEstado("cargando")}
            className="h-10 px-4 rounded-md text-sm font-semibold"
            style={{ fontFamily: F.body, backgroundColor: C.rojo, color: C.blanco }}
          >
            Cargar publicación
          </button>
          {enlace("Ver en Instagram")}
        </div>
      </div>
    );
  }

  return (
    <div className="my-8 mx-auto w-full max-w-[540px] flex flex-col items-center gap-3">
      {estado !== "fallido" && (
        <iframe
          ref={iframeRef}
          src={urlInstagram(valor)}
          title={esReel ? "Reel de Instagram" : "Publicación de Instagram"}
          className="w-full rounded-lg"
          style={{ border: 0, height: `${alto}px`, backgroundColor: C.blanco }}
          // Sin allow-same-origin el embed no carga; sin allow-top-navigation
          // no puede llevarse la pestaña. Los enlaces del post abren en otra.
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="strict-origin-when-cross-origin"
          onError={() => setEstado("fallido")}
        />
      )}
      {estado === "fallido" && (
        <p style={{ fontFamily: F.body, fontSize: "13px", color: C.gris }}>
          No se pudo mostrar la publicación aquí.
        </p>
      )}
      {enlace("Ver publicación en Instagram")}
    </div>
  );
}
