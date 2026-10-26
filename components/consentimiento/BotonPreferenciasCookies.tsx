"use client";

import { abrirPreferenciasCookies } from "@/lib/consentimiento";

/** Enlace del footer para cambiar la elección de cookies. */
export default function BotonPreferenciasCookies({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button type="button" onClick={abrirPreferenciasCookies} className={className} style={style}>
      Preferencias de cookies
    </button>
  );
}
