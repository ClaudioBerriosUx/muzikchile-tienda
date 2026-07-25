/**
 * Control del reproductor del Channel embebido en el Hero, vía postMessage.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTADO DE LA VERIFICACIÓN (2026-07-25, contra `origin/main` recién traído del
 * repo muzik-channel)
 *
 * Lo que EXISTE hoy en el Channel — `src/components/VideoPlayer.tsx:59-69`:
 *
 *     const handleMessage = (event: MessageEvent) => {
 *       if (event.data === 'muzik_pause') setIsPlaying(false);
 *       if (event.data === 'muzik_play')  setIsPlaying(true);
 *     };
 *
 * Y `isPlaying` baja hasta `YouTubePlayer.tsx:368-372`, que ejecuta
 * `globalPlayer.pause()` / `.play()`. O sea: la pausa es real.
 *
 * Lo que NO existe (buscado en todo `src` de origin/main):
 *   · `muzik-embed-ready`      — el iframe nunca anuncia que está listo
 *   · `muzik-embed-control`    — no hay listener para ese formato
 *   · `set-audio` / mute       — no hay comando de silencio
 *   · `LiveStreamPlayer`       — ese archivo no existe; /tv monta `VideoPlayer`
 *
 * Por eso el protocolo activo es LEGACY. El protocolo EMBED está escrito y listo
 * para cuando el Channel efectivamente lo publique: basta cambiar
 * `PROTOCOLO_ACTIVO` a "embed".
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Origen exacto del iframe. Nunca '*'. */
export const ORIGEN_CHANNEL = "https://tv.muzikchile.cl";

/** Mensaje con el que el iframe anunciaría estar listo (aún no implementado). */
export const MSG_READY = "muzik-embed-ready";

type Protocolo = "legacy" | "embed";
type Modo = "pausar" | "silenciar";

interface ConfigSenal {
  /**
   * "legacy" → strings 'muzik_pause'/'muzik_play' (lo único que el Channel
   *            entiende hoy).
   * "embed"  → objetos { type: 'muzik-embed-control', ... } (aún no publicado).
   */
  protocolo: Protocolo;
  /**
   * Qué pasa al abrir un video destacado:
   * - "pausar":    congela y calla la señal. Único posible con legacy.
   * - "silenciar": la señal sigue corriendo muda de fondo. Necesita el comando
   *                `set-audio`, que HOY NO EXISTE en el Channel.
   */
  modo: Modo;
}

/**
 * ⚙️ EL INTERRUPTOR. Cuando el Channel publique el protocolo nuevo, cambiar a
 * `{ protocolo: "embed", modo: "silenciar" }` y listo — no hay que tocar nada más.
 *
 * (Va como objeto tipado y no como constantes sueltas porque TypeScript estrecha
 * un `const` a su literal, y entonces las ramas del otro valor quedan marcadas
 * como código imposible.)
 */
export const CONFIG: ConfigSenal = {
  protocolo: "legacy",
  modo: "pausar",
};

/** Reexportado por comodidad para la UI. */
export const MODO_INTERRUPCION = CONFIG.modo;

type Intencion = "interrumpir" | "reanudar";

/** Construye el payload según el protocolo activo y el modo elegido. */
function payload(intencion: Intencion): unknown {
  if (CONFIG.protocolo === "legacy") {
    // El legacy solo sabe pausar/reproducir; no hay variante de solo-silencio.
    return intencion === "interrumpir" ? "muzik_pause" : "muzik_play";
  }

  if (CONFIG.modo === "silenciar") {
    return {
      type: "muzik-embed-control",
      action: "set-audio",
      muted: intencion === "interrumpir",
    };
  }

  return {
    type: "muzik-embed-control",
    action: intencion === "interrumpir" ? "pause" : "play",
  };
}

/**
 * Envía la orden al reproductor embebido.
 *
 * No falla si el iframe todavía no montó: `contentWindow` puede ser null.
 */
export function enviarAlChannel(
  iframe: HTMLIFrameElement | null,
  intencion: Intencion
): void {
  const ventana = iframe?.contentWindow;
  if (!ventana) return;

  const mensaje = payload(intencion);

  ventana.postMessage(mensaje, ORIGEN_CHANNEL);
}

/**
 * ¿Hay que esperar el handshake antes de mandar comandos?
 *
 * Con el protocolo legacy, NO: el listener del Channel se monta con el
 * componente y nunca anuncia nada. Si acá se esperara un `muzik-embed-ready`
 * que jamás llega, no se enviaría ningún comando y la función quedaría muerta.
 */
export const REQUIERE_HANDSHAKE = CONFIG.protocolo === "embed";
