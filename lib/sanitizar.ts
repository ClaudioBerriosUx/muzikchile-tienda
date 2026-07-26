import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitización del HTML de las noticias.
 *
 * ⚠️ Esto NO es opcional ni una precaución teórica: el cuerpo de una publicación
 * lo escribe un ARTISTA desde su panel. Renderizar ese HTML crudo con
 * `dangerouslySetInnerHTML` sería XSS almacenado — cualquier artista podría
 * robar la sesión de quien lea su noticia, incluido un admin.
 *
 * Se usa allowlist (lo permitido se enumera; todo lo demás se borra), no
 * denylist. Una denylist siempre se queda corta.
 *
 * Corre en el servidor: `isomorphic-dompurify` usa jsdom en Node y el DOM real
 * en el navegador, así que el mismo módulo sirve en Server Components.
 */

/** Etiquetas permitidas. Nada de script, style, iframe, form, object, embed. */
const TAGS_PERMITIDOS = [
  "p", "br", "hr",
  "h1", "h2", "h3", "h4",
  "strong", "b", "em", "i", "u", "s",
  "a",
  "ul", "ol", "li",
  "blockquote",
  "img", "figure", "figcaption",
  // Contenedor de embeds que genera TipTap. El <div> se permite pero su
  // contenido se reemplaza después por un reproductor React; nunca se
  // renderiza HTML de terceros dentro.
  "div", "span",
];

/**
 * Atributos permitidos.
 *
 * Ojo con lo que NO está: `style` (permite exfiltración vía url()), `srcset`,
 * `on*` (los quita DOMPurify igual), `id` (rompe las anclas de la página).
 *
 * Tampoco hay `data-*`, y es a propósito: los bloques de embed de TipTap se
 * extraen ANTES de sanitizar (ver `trocearContenido`). Se probó la vía
 * contraria y no funciona — DOMPurify con `ALLOW_DATA_ATTR: false` borra todos
 * los data-* aunque estén listados acá, y el `<div data-embed …>` llegaba vacío.
 */
const ATRIBUTOS_PERMITIDOS = [
  "href", "src", "alt", "title", "class",
];

let ganchosListos = false;

/**
 * Fuerza `target="_blank"` + `rel="noopener noreferrer"` en todos los enlaces.
 *
 * Sin `noopener`, la página destino recibe `window.opener` y puede redirigir la
 * pestaña original a un phishing (tabnabbing).
 */
function registrarGanchos() {
  if (ganchosListos) return;

  DOMPurify.addHook("afterSanitizeAttributes", (nodo) => {
    if (nodo.tagName === "A") {
      nodo.setAttribute("target", "_blank");
      nodo.setAttribute("rel", "noopener noreferrer");
    }
  });

  ganchosListos = true;
}

/** Limpia el HTML del cuerpo de una publicación dejándolo apto para renderizar. */
export function sanitizarHtml(html: string): string {
  registrarGanchos();

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: TAGS_PERMITIDOS,
    ALLOWED_ATTR: ATRIBUTOS_PERMITIDOS,
    // Permite data-* solo dentro de la allowlist de arriba.
    ALLOW_DATA_ATTR: false,
    // Bloquea javascript:, data:text/html y similares en href/src.
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|\/|#)/i,

    /**
     * NO usar `USE_PROFILES`. Se probó con `{ html: true }` y AMPLÍA la
     * allowlist en vez de restringirla: reintroduce el perfil HTML completo de
     * DOMPurify y pisa `ALLOWED_TAGS`/`ALLOWED_ATTR`. En esa configuración
     * pasaban `<form>` (un artista podía incrustar un formulario de phishing en
     * medio de su noticia) y el atributo `style` (permite exfiltrar datos con
     * `url()` y superponer capas invisibles sobre la página).
     *
     * Con las listas explícitas de arriba y sin perfiles, svg/math/form/style
     * quedan fuera por omisión, que es como debe funcionar una allowlist.
     *
     * Tampoco usar `KEEP_CONTENT: false`. Se probó y borra los NODOS DE TEXTO:
     * `<h2>Título</h2>` salía como `<h2></h2>`, o sea, artículos vacíos. El
     * default (true) conserva el texto, y el contenido de `<script>`/`<style>`
     * se descarta igual porque DOMPurify los trae en FORBID_CONTENTS.
     */
  });
}
