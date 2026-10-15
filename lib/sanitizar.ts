import sanitizeHtml from "sanitize-html";
// Con extensión: `scripts/verificar-sanitizacion.mjs` importa este archivo
// directo con Node, que no resuelve rutas sin extensión.
import { esOptimizable as esHostDeImagenPermitido } from "./imagenes-remotas.ts";

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
 * Atributos permitidos, en cualquier etiqueta permitida salvo <img> (que se
 * recorta a ATRIBUTOS_IMG en `filtrarImg`).
 *
 * Ojo con lo que NO está: `style` (permite exfiltración vía url()), `srcset`,
 * `on*`, `id` (rompe las anclas de la página).
 *
 * Tampoco hay `data-*`, y es a propósito: los bloques de embed de TipTap se
 * extraen ANTES de sanitizar (ver `trocearContenido`), así que el sanitizador
 * nunca necesita conservarlos.
 */
const ATRIBUTOS_PERMITIDOS = [
  "title", "class",
];

/**
 * <img> acepta solo esto. `src` además tiene que ser https y de un host de
 * `lib/imagenes-remotas.ts` (nuestro Storage y el del Channel); si no, la
 * imagen entera se descarta.
 *
 * Por qué una allowlist de hosts: una imagen externa en el cuerpo es un pixel
 * de rastreo (el dueño del servidor ve IP y navegador de cada lector) y puede
 * cambiar de contenido después de moderada. Las del admin se suben al bucket
 * `noticias`, así que pasan.
 */
const ATRIBUTOS_IMG = ["src", "alt", "width", "height"];

/** width/height: solo un número de píxeles razonable ("640"), nada de "100%;x". */
const DIMENSION = /^\d{1,4}$/;

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
    if (!URI_PERMITIDA.test(limpio)) delete atributos[nombre];
  }
  return atributos;
}

/**
 * Deja en <img> solo ATRIBUTOS_IMG, y `src` solo si es https de un host
 * permitido. Sin `src` válido, `exclusiveFilter` descarta la etiqueta.
 */
function filtrarImg(atributos: sanitizeHtml.Attributes): sanitizeHtml.Attributes {
  const limpios: sanitizeHtml.Attributes = {};
  for (const nombre of ATRIBUTOS_IMG) {
    const valor = atributos[nombre];
    if (valor !== undefined) limpios[nombre] = valor;
  }

  const src = limpios.src?.replace(ESPACIOS_URI, "");
  if (src && esHostDeImagenPermitido(src)) limpios.src = src;
  else delete limpios.src;

  for (const dim of ["width", "height"] as const) {
    if (limpios[dim] !== undefined && !DIMENSION.test(limpios[dim])) delete limpios[dim];
  }
  return limpios;
}

const OPCIONES: sanitizeHtml.IOptions = {
  allowedTags: TAGS_PERMITIDOS,
  allowedAttributes: {
    "*": ATRIBUTOS_PERMITIDOS,
    // target/rel: solo para que sobrevivan los valores que fija el transform de
    // <a>; los que traiga el HTML original se pisan siempre.
    a: ["href", "target", "rel"],
    // `filtrarImg` quita después lo que "*" le agrega (title, class).
    img: ATRIBUTOS_IMG,
  },
  // Una <img> que se quedó sin src (host no permitido, data:, http:) no aporta
  // nada: se borra entera.
  exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  // Las etiquetas no permitidas se quitan pero su texto se conserva (como el
  // KEEP_CONTENT por defecto de DOMPurify), salvo las de SIN_CONTENIDO.
  disallowedTagsMode: "discard",
  nonTextTags: SIN_CONTENIDO,
  // Segunda capa, además de `filtrarUris`.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["https"] },
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: true,
  // `style` no está permitido; que ni se intente parsear.
  parseStyleAttributes: false,
  transformTags: {
    "*": (tagName, attribs) => ({
      tagName,
      attribs: filtrarUris(tagName, attribs),
    }),
    img: (tagName, attribs) => ({
      tagName,
      attribs: filtrarImg(attribs),
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
