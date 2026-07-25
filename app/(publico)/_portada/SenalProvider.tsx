"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Estado compartido entre el hero (señal en vivo) y los videos destacados:
 * al abrir un destacado hay que pausar la señal, o suenan las dos a la vez.
 *
 * Este provider solo lleva el estado. Quién lo traduce a una acción concreta es
 * el Hero, que envía `muzik_pause` / `muzik_play` al iframe por postMessage
 * (ver `protocolo-senal.ts`).
 *
 * Antes se hacía cambiando el `src` a about:blank, que descargaba el
 * reproductor y lo obligaba a recargar. El Channel expone control por
 * postMessage, así que ya no hace falta.
 */
interface Senal {
  silenciada: boolean;
  silenciar: () => void;
  restaurar: () => void;
}

/** Default no-op: usar el hero fuera del provider no debe romper nada. */
const SenalContext = createContext<Senal>({
  silenciada: false,
  silenciar: () => {},
  restaurar: () => {},
});

export function useSenal() {
  return useContext(SenalContext);
}

export default function SenalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [silenciada, setSilenciada] = useState(false);

  const silenciar = useCallback(() => setSilenciada(true), []);
  const restaurar = useCallback(() => setSilenciada(false), []);

  const valor = useMemo(
    () => ({ silenciada, silenciar, restaurar }),
    [silenciada, silenciar, restaurar]
  );

  return <SenalContext.Provider value={valor}>{children}</SenalContext.Provider>;
}
