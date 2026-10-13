import Script from "next/script";

/**
 * Google Analytics 4 (gtag.js). Es el MISMO ID que mide tv.muzikchile.cl
 * (muzik-channel/index.html): las visitas de los dos sitios caen en la misma
 * propiedad y se separan por nombre de host.
 *
 * Se monta en app/(publico)/layout.tsx, no en el layout raíz, para que la
 * etiqueta no aparezca en el HTML de /panel ni /admin.
 *
 * Solo se renderiza en producción (VERCEL_ENV) y si existe NEXT_PUBLIC_GA_ID,
 * que se carga en Vercel solo para Production. En local y en previews no hay
 * etiqueta.
 *
 * Cambios de página: Next navega con history.pushState sin recargar, y los
 * cuenta la medición mejorada de GA4 ("cambios de página según el historial
 * del navegador"), la misma que usa el Channel, que también es SPA. No hay
 * page_view manual.
 */

/** Rutas que NO se miden (prefijos). Algunas viven en (publico) y cargan la etiqueta. */
const RUTAS_PRIVADAS = [
  "/admin",
  "/panel",
  "/checkout",
  "/carrito",
  "/login",
  "/registro",
  "/recuperar",
];

export default function Analitica() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (process.env.VERCEL_ENV !== "production" || !gaId) return null;

  /*
    Va ANTES de gtag('config'). Usa el apagado oficial de gtag
    (window['ga-disable-<ID>'] = true) en las rutas privadas.

    Se recalcula en cada cambio de URL envolviendo pushState/replaceState y
    escuchando popstate. Un useEffect con usePathname llegaría tarde: Next
    cambia la URL antes de que corra el efecto, y GA ya habría mandado el
    page_view de /login o /checkout al entrar desde un Link.
  */
  const init = `
(function () {
  var id = ${JSON.stringify(gaId)};
  var privadas = ${JSON.stringify(RUTAS_PRIVADAS)};
  function revisar() {
    var p = location.pathname;
    window["ga-disable-" + id] = privadas.some(function (r) {
      return p === r || p.indexOf(r + "/") === 0;
    });
  }
  ["pushState", "replaceState"].forEach(function (m) {
    var original = history[m];
    history[m] = function () {
      var r = original.apply(this, arguments);
      revisar();
      return r;
    };
  });
  window.addEventListener("popstate", revisar);
  revisar();
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", id);
})();
`;

  return (
    <>
      <Script id="ga-init" strategy="afterInteractive">
        {init}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
    </>
  );
}
