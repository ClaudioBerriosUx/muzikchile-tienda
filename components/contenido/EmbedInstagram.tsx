"use client";

import { useEffect, useRef, useState } from "react";
import { C, F, TEMA } from "@/lib/portada";
import { PATHS_MARCA } from "@/components/layout/iconos-marca";
import { urlInstagram, urlPostInstagram } from "@/lib/embed-instagram";

/**
 * Post o reel de Instagram dentro de una noticia, con CARGA PEREZOSA.
 *
 * El iframe a `/embed/captioned/` se monta solo cuando el bloque se acerca a la
 * pantalla (IntersectionObserver con MARGEN_CARGA), no al abrir la página: una
 * nota que nadie lee hasta abajo no hace ninguna petición a Meta. Mientras
 * tanto, y hasta que llega la primera medida, se ve un esqueleto del mismo
 * alto inicial para que el contenido no salte.
 *
 * ⚠️ Al cargar, Instagram puede dejar cookies sin consentimiento previo. Queda
 * pendiente el aviso de cookies (ver PROGRESS.md).
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
const TIEMPO_ESPERA = 8_000;
const MARGEN_CARGA = "300px 0px";

type Estado = "espera" | "cargando" | "listo" | "fallido";

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
  const [estado, setEstado] = useState<Estado>("espera");
  const [alto, setAlto] = useState(ALTO_INICIAL);
  const bloqueRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const esReel = valor.startsWith("reel/");
  const titulo = esReel ? "Reel de Instagram" : "Publicación de Instagram";
  const urlPost = urlPostInstagram(valor);

  // Monta el iframe cuando el bloque entra en MARGEN_CARGA de la pantalla.
  useEffect(() => {
    if (estado !== "espera") return;
    const bloque = bloqueRef.current;
    if (!bloque) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          observador.disconnect();
          setEstado("cargando");
        }
      },
      { rootMargin: MARGEN_CARGA }
    );
    observador.observe(bloque);
    return () => observador.disconnect();
  }, [estado]);

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

  return (
    <div ref={bloqueRef} className="my-8 mx-auto w-full max-w-[540px] flex flex-col items-center gap-3">
      {estado !== "fallido" && (
        <div
          className="relative w-full"
          style={{ height: `${alto}px` }}
          aria-busy={estado !== "listo"}
        >
          {estado !== "espera" && (
            <iframe
              ref={iframeRef}
              src={urlInstagram(valor)}
              title={titulo}
              className="absolute inset-0 w-full h-full rounded-lg"
              style={{ border: 0, backgroundColor: C.blanco }}
              // Sin allow-same-origin el embed no carga; sin allow-top-navigation
              // no puede llevarse la pestaña. Los enlaces del post abren en otra.
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="strict-origin-when-cross-origin"
              onError={() => setEstado("fallido")}
            />
          )}
          {estado !== "listo" && <Esqueleto />}
        </div>
      )}
      {estado === "fallido" && (
        <p style={{ fontFamily: F.body, fontSize: "13px", color: TEMA.texto2 }}>
          No se pudo mostrar la publicación aquí.
        </p>
      )}
      <a
        href={urlPost}
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-4 hover:underline"
        style={{ fontFamily: F.body, fontSize: "14px", color: C.rojoClaro }}
      >
        Ver publicación en Instagram →
      </a>
    </div>
  );
}

/** Silueta de un post (cabecera, imagen cuadrada, líneas de texto) sobre el iframe. */
function Esqueleto() {
  const gris = { backgroundColor: TEMA.borde };
  return (
    <div
      className="absolute inset-0 rounded-lg border p-4 flex flex-col gap-4 overflow-hidden motion-safe:animate-pulse"
      style={{ borderColor: TEMA.borde, backgroundColor: TEMA.superficie }}
      aria-hidden
    >
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-full" style={gris} />
        <span className="h-3 w-32 rounded" style={gris} />
      </div>
      <div className="w-full aspect-square rounded flex items-center justify-center" style={gris}>
        <svg viewBox="0 0 24 24" width="36" height="36" fill={TEMA.superficie}>
          <path d={PATHS_MARCA.instagram} />
        </svg>
      </div>
      <span className="h-3 w-3/4 rounded" style={gris} />
      <span className="h-3 w-1/2 rounded" style={gris} />
    </div>
  );
}
