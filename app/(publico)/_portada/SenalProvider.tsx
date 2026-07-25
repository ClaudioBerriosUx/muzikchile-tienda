"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Estado compartido entre el hero (señal en vivo) y los videos destacados.
 *
 * El hero es un iframe de tv.muzikchile.cl: otro origen, así que no se le puede
 * pedir que pause por postMessage ni tocar su <video>. La única forma de callar
 * su audio desde acá es sacarlo de la página — se le cambia el `src` a
 * about:blank y se restaura al cerrar el modal.
 *
 * Efecto secundario asumido: al restaurar, la señal recarga desde cero. Da
 * igual, es una transmisión en vivo; no hay posición que retomar.
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
