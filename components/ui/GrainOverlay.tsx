/**
 * Capa de grano (film grain) sobre toda la pantalla.
 *
 * El ruido se genera con `feTurbulence` de SVG embebido como data-URI: no hay
 * archivo de imagen que descargar ni que versionar. El navegador rasteriza ese
 * SVG UNA vez al pintar el fondo; la animación después solo mueve la capa, así
 * que el filtro no se recalcula por frame.
 *
 * ── Perillas ───────────────────────────────────────────────────────────────
 * Los tres valores de abajo son los que conviene tocar para calibrar el efecto.
 */

/**
 * Qué tan visible es el grano. Rango útil en este sitio: 0.05 – 0.15.
 *
 * Subida de 0.08 a 0.12 junto con el arreglo de la animación: a 0.08 la textura
 * se veía, pero el temblor no — el ojo detecta mucho peor el MOVIMIENTO de algo
 * de bajo contraste que su presencia. Un poco más de opacidad es lo que hace
 * que el salto de fotograma se lea.
 *
 * ⚠️ La referencia usaba 0.8, pero eso era con `difference`, que es un modo
 * mucho más agresivo. Con `screen` y fondo casi negro, 0.8 sería una tormenta
 * de nieve.
 */
const OPACIDAD = 0.12;

/**
 * Modo de fusión. Importa MÁS de lo que parece en este sitio, porque la portada
 * es casi negra (#000000 / #0a0a0a) y varios modos se anulan sobre negro:
 *
 * · "screen"      ← actual. Sobre negro el resultado es el propio grano, así que
 *                   se ve parejo en toda la página. Aclara: el negro puro deja
 *                   de serlo y pasa a un gris muy oscuro con textura.
 * · "difference"  El de la referencia. Sobre negro da exactamente lo mismo que
 *                 `screen`; la diferencia aparece sobre zonas claras, donde
 *                 invierte y se pone agresivo. Subir la opacidad con cuidado.
 * · "overlay"     ⚠️ INVISIBLE sobre negro. La fórmula es 2·fondo·grano, y con
 *                 fondo 0 el resultado es 0 pase lo que pase. Solo se vería
 *                 sobre las miniaturas de video y el reproductor.
 * · "soft-light"  ⚠️ Igual de invisible sobre negro, por la misma razón.
 *
 * O sea: los dos modos "suaves" no sirven mientras el fondo sea negro. Si en la
 * tanda de color el fondo pasa a `--bg-base` (#0B0D12) siguen sin funcionar —
 * es casi negro también.
 */
const MEZCLA: React.CSSProperties["mixBlendMode"] = "screen";

/** Duración de un ciclo completo. Más corto = más nervioso, más "8mm". */
const DURACION = "8s";

/**
 * Por debajo del header sticky y del menú móvil (z-50) y del modal de video
 * (z-100), y por encima del contenido normal. Ese orden es el que hace que el
 * grano NO tiña la navegación ni el modal.
 */
const Z_INDEX = 15;

/**
 * El SVG del ruido.
 *
 * · `fractalNoise` da grano parejo; `turbulence` haría nubarrones.
 * · `stitchTiles='stitch'` hace que el mosaico calce sin costuras visibles.
 * · `feColorMatrix saturate 0` lo pasa a gris: sin esto el ruido sale de
 *   colores y se ve como interferencia de TV, no como grano de película.
 *
 * El `#` de `url(#g)` va crudo a propósito: `encodeURIComponent` lo convierte
 * en %23, que es lo que el data-URI necesita. Escribirlo ya codificado lo
 * dejaría como %2523 y el filtro no resolvería.
 */
const RUIDO_SVG =
  `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>` +
  `<filter id='g'>` +
  `<feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/>` +
  `<feColorMatrix type='saturate' values='0'/>` +
  `</filter>` +
  `<rect width='160' height='160' filter='url(#g)'/>` +
  `</svg>`;

const RUIDO = `data:image/svg+xml,${encodeURIComponent(RUIDO_SVG)}`;

export default function GrainOverlay() {
  return (
    <div
      className="grano-overlay"
      aria-hidden
      style={{
        position: "fixed",
        /*
          La capa mide el TRIPLE del viewport y se ancla desplazada, de modo que
          al moverse nunca asome un borde. Los offsets son los de la referencia.

          Con estos valores la capa va de -50% a +250% en horizontal y de -110%
          a +190% en vertical: sobra medio viewport a cada lado y cerca de uno
          entero arriba y abajo. Las traslaciones de los keyframes (±8% del
          elemento = ±24% de pantalla) caben ahí con holgura.

          ⚠️ COSTO: 300% × 300% son 9 viewports de capa compuesta, contra los 4
          que serían a 200%. En una pantalla de 1920×1080 eso es del orden de
          ~75MB de textura en GPU (el navegador tesela y no rasteriza todo de
          una, pero el orden de magnitud es ese). Para el movimiento que hacen
          hoy los keyframes, 200%/-50%/-50% alcanzaría de sobra y costaría menos
          de la mitad: si aparece jank en equipos modestos, ese es el primer
          dial que hay que bajar, y no hace falta tocar los keyframes.
        */
        top: "-110%",
        left: "-50%",
        width: "300%",
        height: "300%",
        zIndex: Z_INDEX,
        // Sin esto la capa se comería todos los clics de la portada.
        pointerEvents: "none",
        opacity: OPACIDAD,
        mixBlendMode: MEZCLA,
        backgroundImage: `url("${RUIDO}")`,
        backgroundRepeat: "repeat",
        /*
          Longhand a propósito: pisa solo la duración del shorthand `animation`
          que define la clase, sin tocar el nombre. Así el bloque de
          prefers-reduced-motion (que pone `animation: none`) sigue ganando.
        */
        animationDuration: DURACION,
      }}
    />
  );
}
