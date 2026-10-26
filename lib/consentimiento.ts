import { useSyncExternalStore } from "react";

/**
 * Consentimiento de cookies y contenido de terceros. Nada de terceros se carga
 * sin permiso:
 *   - `analitica`: Google Analytics (components/Analitica.tsx).
 *   - `contenido`: la señal de MuzikChile TV del hero (tv. carga YouTube y su
 *     propio Google Analytics) y los embeds de YouTube, Spotify e Instagram de
 *     las noticias (components/consentimiento/ContenidoTercero.tsx).
 * Lo necesario (sesión, carrito, aviso del boletín) no pide permiso.
 *
 * Se guarda en localStorage (`muzik_consentimiento`) con versión y fecha. Si
 * cambia lo que se pide (otra categoría, otro tercero), se sube la versión y
 * el banner vuelve a aparecer.
 */

export const VERSION_CONSENTIMIENTO = 1;
const CLAVE = "muzik_consentimiento";
const EVENTO_CAMBIO = "muzik:consentimiento";
const EVENTO_ABRIR = "muzik:preferencias-cookies";

export interface Consentimiento {
  analitica: boolean;
  contenido: boolean;
  version: number;
  fecha: string;
}

/**
 * undefined = todavía no se sabe (servidor e hidratación);
 * null = la persona no ha decidido; objeto = lo que eligió.
 */
export type EstadoConsentimiento = Consentimiento | null | undefined;

// Si localStorage no está disponible (modo privado estricto), la elección vale
// mientras dure la pestaña.
let enMemoria: string | null = null;
let ultimoCrudo: string | null | undefined;
let ultimoValor: Consentimiento | null = null;

function leerCrudo(): string | null {
  try {
    return localStorage.getItem(CLAVE) ?? enMemoria;
  } catch {
    return enMemoria;
  }
}

export function leerConsentimiento(): Consentimiento | null {
  const crudo = leerCrudo();
  // Mismo texto → mismo objeto: useSyncExternalStore exige una instantánea estable.
  if (crudo === ultimoCrudo) return ultimoValor;
  ultimoCrudo = crudo;
  try {
    const v = crudo ? JSON.parse(crudo) : null;
    ultimoValor =
      v && v.version === VERSION_CONSENTIMIENTO && typeof v.analitica === "boolean" && typeof v.contenido === "boolean"
        ? v
        : null;
  } catch {
    ultimoValor = null;
  }
  return ultimoValor;
}

export function guardarConsentimiento(eleccion: { analitica: boolean; contenido: boolean }) {
  const valor: Consentimiento = { ...eleccion, version: VERSION_CONSENTIMIENTO, fecha: new Date().toISOString() };
  const crudo = JSON.stringify(valor);
  enMemoria = crudo;
  try {
    localStorage.setItem(CLAVE, crudo);
  } catch {
    // queda en memoria
  }
  window.dispatchEvent(new Event(EVENTO_CAMBIO));
}

function suscribir(avisar: () => void) {
  window.addEventListener(EVENTO_CAMBIO, avisar);
  window.addEventListener("storage", avisar); // otra pestaña
  return () => {
    window.removeEventListener(EVENTO_CAMBIO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

export function useConsentimiento(): EstadoConsentimiento {
  return useSyncExternalStore<EstadoConsentimiento>(suscribir, leerConsentimiento, () => undefined);
}

/** Vuelve a mostrar el panel de preferencias (enlace del footer). */
export function abrirPreferenciasCookies() {
  window.dispatchEvent(new Event(EVENTO_ABRIR));
}

export function alPedirPreferencias(fn: () => void) {
  window.addEventListener(EVENTO_ABRIR, fn);
  return () => window.removeEventListener(EVENTO_ABRIR, fn);
}
