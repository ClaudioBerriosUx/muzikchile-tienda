import { F, TEMA } from "@/lib/portada";
import { formatearCifra, type CifrasChannel } from "@/lib/cifras-channel";
import BienvenidaFondo from "./BienvenidaFondo";

/**
 * Bienvenida de la portada: kicker, H1 "Conéctate con la música chilena",
 * bajada y cifras reales del Channel (diseño de Claude Design · Portada).
 *
 * Server Component y estático: sin animaciones (las barras de ecualizador del
 * diseño quedaron fuera a propósito).
 *
 * `cifras` llega de `traerCifrasChannel`. Si es null (la consulta falló o no
 * hay credenciales) el bloque de cifras no se pinta: nunca números de relleno.
 *
 * Padding 64/72px en móvil y 88/96px en desktop. Sin línea de horizonte al pie:
 * en el diseño la bienvenida pasa directo a "Videos destacados".
 *
 * Gris de kicker y etiquetas: `tema-texto-3` (#9A9A9A) y no el #7A7A7A del
 * diseño, que a 11–12px sobre #1C1C1C queda en ~3.9:1, bajo AA.
 */

function Raya() {
  return <span aria-hidden="true" className="h-0.5 w-[26px] bg-tema-rojo" />;
}

function Cifra({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-heading text-[34px] leading-none text-tema-texto" style={{ fontWeight: 400 }}>
        {formatearCifra(valor)}
      </span>
      <span className="text-xs uppercase tracking-[0.14em] text-tema-texto-3">{etiqueta}</span>
    </div>
  );
}

export default function Bienvenida({ cifras }: { cifras: CifrasChannel | null }) {
  return (
    <section
      style={{ backgroundColor: TEMA.fondo }}
      className="relative overflow-hidden px-5 pb-[72px] pt-16 md:px-10 md:pb-24 md:pt-[88px]"
    >
      <BienvenidaFondo />

      {/* `relative`: queda por encima de las capas absolutas del fondo. */}
      <div className="relative mx-auto flex max-w-[1360px] flex-col items-center gap-[22px] text-center">
        <p className="m-0 flex items-center gap-3">
          <Raya />
          <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-tema-texto-3">
            Vitrina de la escena independiente
          </span>
          <Raya />
        </p>

        <h1
          className="m-0 max-w-[900px] text-tema-texto"
          style={{
            fontFamily: F.titulo,
            fontWeight: 400,
            fontSize: "clamp(40px, 7vw, 76px)",
            lineHeight: 0.94,
            letterSpacing: "0.005em",
            textTransform: "uppercase",
            textWrap: "balance",
          }}
        >
          Conéctate con la música chilena
        </h1>

        <p
          className="m-0 max-w-[640px] text-[17px] leading-[1.7] text-tema-texto-2"
          style={{ fontFamily: F.body, textWrap: "pretty" }}
        >
          Nos mueve la pasión por los artistas chilenos. Descubre el talento local,
          escucha lo que se está grabando hoy y llévate lo mejor del sonido de Chile
          a donde estés.
        </p>

        {cifras && (
          // 20px en móvil: con 34 las tres cifras no caben en 375 y la tercera
          // bajaba sola a otra fila.
          <div className="flex flex-wrap justify-center gap-5 pt-[18px] sm:gap-[34px]">
            <Cifra valor={cifras.artistas} etiqueta="Artistas" />
            <span aria-hidden="true" className="w-px self-stretch bg-tema-borde" />
            <Cifra valor={cifras.ciudades} etiqueta="Ciudades" />
            <span aria-hidden="true" className="w-px self-stretch bg-tema-borde" />
            <Cifra valor={cifras.videos} etiqueta="Videos" />
          </div>
        )}
      </div>
    </section>
  );
}
