/**
 * Fondo con atmósfera del bloque de bienvenida ("Conéctate con la música
 * chilena"). Solo capas decorativas: el titular y la bajada no cambian.
 *
 * Server Component sin estado y TODO estático: nada de animaciones ni
 * transiciones. El grano de película ya lo pone `GrainOverlay` (fijo, global en
 * la portada); acá no se agrega otro.
 *
 * Se monta como primer hijo de una <section> con `relative overflow-hidden`;
 * el contenido va en un hermano `relative` encima. Todas las capas son
 * `absolute`, `pointer-events-none` y `aria-hidden`.
 *
 * Colores: solo la paleta tema en rgba (#1C1C1C, #161616, #EDEDED, rojo
 * #B02F3C, azul #2C567F). Las capas son tenues a propósito: el titular
 * (#EDEDED) y la bajada (tema-texto-2) tienen que seguir pasando AA encima.
 */

const MASCARA_GRILLA = "radial-gradient(ellipse 70% 80% at 50% 50%, #000 20%, transparent 75%)";

const CAPA = "pointer-events-none absolute";

export default function BienvenidaFondo() {
  return (
    <div aria-hidden="true" className={`${CAPA} inset-0 select-none`}>
      {/* 1. Degradado base: continúa el final del Hero (#1C1C1C) hacia el fondo. */}
      <div className={`${CAPA} inset-0`} style={{ background: "linear-gradient(180deg, #1C1C1C 0%, #161616 100%)" }} />

      {/* 2. Grilla tenue de papel milimetrado, solo al centro. */}
      <div
        className={`${CAPA} inset-0`}
        style={{
          backgroundImage:
            "linear-gradient(rgba(237,237,237,0.035) 1px, transparent 1px), " +
            "linear-gradient(90deg, rgba(237,237,237,0.035) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: MASCARA_GRILLA,
          WebkitMaskImage: MASCARA_GRILLA,
        }}
      />

      {/* 3. Halo rojo central. */}
      <div
        className={`${CAPA} left-1/2 top-1/2 h-[420px] w-[1100px] -translate-x-1/2 -translate-y-1/2`}
        style={{ background: "radial-gradient(ellipse, rgba(176,47,60,0.22) 0%, rgba(176,47,60,0) 65%)" }}
      />

      {/* 4. Halo azul lateral: profundidad, equilibra el rojo. */}
      <div
        className={`${CAPA} -bottom-[220px] -right-[160px] h-[560px] w-[560px] rounded-full`}
        style={{ background: "radial-gradient(circle, rgba(44,86,127,0.16) 0%, rgba(44,86,127,0) 68%)" }}
      />

      {/* 5. Palabra fantasma, cortada por el overflow de la sección. */}
      <span
        className={`${CAPA} bottom-[-0.18em] left-1/2 -translate-x-1/2 whitespace-nowrap font-heading uppercase`}
        style={{
          // Mínimo 96px y no 140: a 140 la palabra mide ~430px y en un móvil de
          // 375 se cortaba por los dos lados. Desde ~640px de ancho manda 22vw.
          fontSize: "clamp(96px, 22vw, 300px)",
          fontWeight: 400,
          lineHeight: 1,
          letterSpacing: "0.02em",
          color: "transparent",
          WebkitTextStroke: "1px rgba(237,237,237,0.06)",
        }}
      >
        Escena
      </span>
    </div>
  );
}
