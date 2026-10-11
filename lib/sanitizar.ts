import sanitizeHtml from "sanitize-html";

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
 * Usa `sanitize-html` (parser htmlparser2, JS puro) y no DOMPurify: en Node,
 * `isomorphic-dompurify` arrastra jsdom, y jsdom hace `require()` de paquetes
 * ESM (`html-encoding-sniffer` → `@exodus/bytes`). En el runtime de Vercel eso
 * tiraba ERR_REQUIRE_ESM al cargar el módulo (aun con Node 24.x), y TODA ficha
 * /noticias/[slug] daba 500 en producción — incluso un slug inexistente. No
 * reintroducir jsdom ni nada que lo arrastre. La configuración de
 * abajo reproduce exactamente la de DOMPurify que había antes; las diferencias
 * de comportamiento entre las dos librerías están compensadas una por una.
 *
 * Corre igual en el servidor (ContenidoNoticia) y en el navegador
 * (PublicacionForm, que sanitiza antes de guardar).
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
 * Atributos permitidos, en cualquier etiqueta permitida.
 *
 * Ojo con lo que NO está: `style` (permite exfiltración vía url()), `srcset`,
 * `on*`, `id` (rompe las anclas de la página).
 *
 * Tampoco hay `data-*`, y es a propósito: los bloques de embed de TipTap se
 * extraen ANTES de sanitizar (ver `trocearContenido`), así que el sanitizador
 * nunca necesita conservarlos.
 */
const ATRIBUTOS_PERMITIDOS = [
  "href", "src", "alt", "title", "class",
];

/**
 * Valores permitidos en `href` y `src`: http(s), mailto, rutas absolutas y
 * anclas. Bloquea javascript:, data:text/html, vbscript: y también las rutas
 * relativas sin barra. Es la misma regex que tenía DOMPurify
 * (`ALLOWED_URI_REGEXP`).
 */
const URI_PERMITIDA = /^(?:https?:|mailto:|\/|#)/i;

/**
 * Espacios y controles que el navegador ignora dentro de una URL: con ellos
 * `java\tscript:` sigue siendo `javascript:`. Se quitan antes de comparar
 * (igual que el ATTR_WHITESPACE de DOMPurify).
 */
const ESPACIOS_URI = /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g;

/**
 * Etiquetas cuyo contenido se descarta entero, no solo la etiqueta. Es la lista
 * FORBID_CONTENTS de DOMPurify: sin ella, sanitize-html conservaría como texto
 * lo que haya dentro de un <svg>, <template>, <iframe>, etc.
 */
const SIN_CONTENIDO = [
  "annotation-xml", "audio", "colgroup", "desc", "foreignobject", "head",
  "iframe", "math", "mi", "mn", "mo", "ms", "mtext", "noembed", "noframes",
  "noscript", "plaintext", "script", "style", "svg", "template", "thead",
  "title", "video", "xmp",
];

/** Quita `href`/`src` cuyo valor no pase la allowlist de URIs. */
function filtrarUris(
  etiqueta: string,
  atributos: sanitizeHtml.Attributes
): sanitizeHtml.Attributes {
  for (const nombre of ["href", "src"] as const) {
    const valor = atributos[nombre];
    if (valor === undefined) continue;

    const limpio = valor.replace(ESPACIOS_URI, "");
    // DOMPurify deja pasar data: en <img src> (no ejecuta nada dentro de una
    // imagen); se conserva para no cambiar el comportamiento.
    const dataEnImg = etiqueta === "img" && nombre === "src" && /^data:/i.test(limpio);

    if (!URI_PERMITIDA.test(limpio) && !dataEnImg) delete atributos[nombre];
  }
  return atributos;
}

const OPCIONES: sanitizeHtml.IOptions = {
  allowedTags: TAGS_PERMITIDOS,
  allowedAttributes: {
    "*": ATRIBUTOS_PERMITIDOS,
    // Solo para que sobrevivan los valores que fija el transform de <a>; los
    // que traiga el HTML original se pisan siempre.
    a: ["target", "rel"],
  },
  // Las etiquetas no permitidas se quitan pero su texto se conserva (como el
  // KEEP_CONTENT por defecto de DOMPurify), salvo las de SIN_CONTENIDO.
  disallowedTagsMode: "discard",
  nonTextTags: SIN_CONTENIDO,
  // Segunda capa, además de `filtrarUris`.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: true,
  // `style` no está permitido; que ni se intente parsear.
  parseStyleAttributes: false,
  transformTags: {
    "*": (tagName, attribs) => ({
      tagName,
      attribs: filtrarUris(tagName, attribs),
    }),
    /**
     * Fuerza `target="_blank"` + `rel="noopener noreferrer"` en todos los
     * enlaces.
     *
     * Sin `noopener`, la página destino recibe `window.opener` y puede
     * redirigir la pestaña original a un phishing (tabnabbing).
     */
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...filtrarUris(tagName, attribs),
        target: "_blank",
        rel: "noopener noreferrer",
      },
    }),
  },
};

/** Limpia el HTML del cuerpo de una publicación dejándolo apto para renderizar. */
export function sanitizarHtml(html: string): string {
  return sanitizeHtml(html, OPCIONES);
}
