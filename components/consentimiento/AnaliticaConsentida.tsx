"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { useConsentimiento } from "@/lib/consentimiento";

type VentanaGa = Window & Record<string, unknown>;

/** Borra las cookies de GA (_ga, _ga_<id>) del host y del dominio padre. */
function borrarCookiesGa() {
  const nombres = document.cookie
    .split(";")
    .map((c) => c.split("=")[0].trim())
    .filter((n) => n === "_ga" || n.startsWith("_ga_"));
  const host = location.hostname;
  const dominios = [host, `.${host.split(".").slice(-2).join(".")}`];
  for (const n of nombres) {
    document.cookie = `${n}=; Max-Age=0; path=/`;
    for (const d of dominios) document.cookie = `${n}=; Max-Age=0; path=/; domain=${d}`;
  }
}

/**
 * Carga Google Analytics solo con la categoría `analitica` aceptada (ver
 * components/Analitica.tsx, que arma `init`). Un <Script> ya ejecutado no se
 * descarga al desmontarse, así que retirar el permiso apaga GA con
 * `muzik-ga-off` y borra sus cookies.
 */
export default function AnaliticaConsentida({ gaId, init }: { gaId: string; init: string }) {
  const permitido = useConsentimiento()?.analitica === true;
  // Una vez cargado, los <Script> se quedan montados (descargarlos no se puede).
  const [cargado, setCargado] = useState(false);
  if (permitido && !cargado) setCargado(true);

  useEffect(() => {
    const w = window as unknown as VentanaGa;
    if (permitido) {
      w["muzik-ga-off"] = false;
    } else if (cargado) {
      w["muzik-ga-off"] = true;
      w[`ga-disable-${gaId}`] = true;
      borrarCookiesGa();
    }
    const revisar = w["muzik-ga-revisar"];
    if (typeof revisar === "function") revisar();
  }, [permitido, cargado, gaId]);

  if (!cargado) return null;

  return (
    <>
      <Script id="ga-init" strategy="afterInteractive">
        {init}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
    </>
  );
}
