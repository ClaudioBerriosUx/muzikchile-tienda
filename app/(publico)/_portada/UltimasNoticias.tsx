import Link from "next/link";
import { C, F } from "@/lib/portada";
import { etiquetaCategoria } from "@/lib/publicaciones";
import { traerNoticias, fechaCorta } from "@/lib/noticias";
import ImagenNoticia from "@/components/noticias/ImagenNoticia";

/**
 * Server Component: las noticias se leen en el servidor con `traerNoticias`
 * (lib/noticias.ts), la misma consulta del feed /noticias.
 *
 * Composición, imágenes en formato Instagram 4:5:
 *   1. Destacada (la más reciente) a todo el ancho: imagen a 1/3, texto al lado.
 *   2. Fila de 3 tarjetas (noticias 2–4): imagen arriba, badge + fecha y titular.
 */

/**
 * `sizes` de cada imagen. Salen del contenedor `max-w-6xl` con `px-6`: 1104px
 * útiles en escritorio.
 * - Destacada: 1/3 de la tarjeta desde `sm`; en móvil, todo el ancho.
 * - Fila: 3 columnas con gap-5 en `lg` (≈355px), 2 en `sm`, 1 en móvil.
 */
const SIZES_DESTACADA = "(min-width: 1152px) 368px, (min-width: 640px) 33vw, 100vw";
const SIZES_FILA = "(min-width: 1152px) 355px, (min-width: 1024px) 31vw, (min-width: 640px) 48vw, 100vw";

/** Estilo de tarjeta compartido por la destacada y las de la fila. */
const TARJETA: React.CSSProperties = {
  borderColor: C.borde,
  backgroundColor: C.negro,
};

/**
 * Autor de la nota. Hoy es siempre "MuzikChile" —las 8 noticias migradas del
 * Channel cuelgan de ese registro de `artistas`—, pero sale del dato y no
 * hardcodeado: cuando un artista publique lo suyo, aparecerá su nombre.
 */
function Autor({ nombre }: { nombre: string | null | undefined }) {
  if (!nombre) return null;
  return (
    <span
      style={{
        fontFamily: F.body,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        fontSize: "12px",
        color: C.rojoClaro,
      }}
    >
      {nombre}
    </span>
  );
}

function Fecha({ iso }: { iso: string }) {
  return (
    <span style={{ fontFamily: F.body, fontSize: "12px", color: C.grisTenue }}>
      {fechaCorta(iso)}
    </span>
  );
}

/**
 * Badge de categoría.
 *
 * `etiquetaCategoria` devuelve "—" para una categoría desconocida o nula; en
 * ese caso no se pinta nada, porque un badge con un guion es peor que ningún
 * badge.
 *
 * ⚠️ Hoy las 8 noticias migradas son `categoria: 'general'`, así que todas
 * muestran "GENERAL". SHOW / PRENSA / LANZAMIENTO aparecerán cuando alguien
 * las clasifique — el vocabulario ya existe en `lib/publicaciones.ts`.
 */
function Badge({ categoria }: { categoria: string | null }) {
  const etiqueta = etiquetaCategoria(categoria);
  if (etiqueta === "—") return null;

  return (
    <span
      style={{
        fontFamily: F.body,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        fontSize: "10px",
        fontWeight: 600,
        color: C.blanco,
        backgroundColor: C.rojo,
        padding: "4px 9px",
        borderRadius: "3px",
      }}
    >
      {etiqueta}
    </span>
  );
}

export default async function UltimasNoticias() {
  const noticias = await traerNoticias(4);

  // Sin noticias publicadas, la sección no existe.
  if (noticias.length === 0) return null;

  const [principal, ...fila] = noticias;

  return (
    <section style={{ backgroundColor: C.negroSuave }} className="py-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Encabezado */}
        <div className="flex items-end justify-between gap-4 mb-8">
          <h2
            className="pl-4"
            style={{
              fontFamily: F.titulo,
              fontSize: "38px",
              letterSpacing: "0.04em",
              color: C.blanco,
              lineHeight: 1.1,
              borderLeft: "4px solid transparent",
              borderImage: `linear-gradient(180deg, ${C.rojo}, ${C.rojoAcento}) 1`,
            }}
          >
            ÚLTIMAS NOTICIAS
          </h2>

          <Link
            href="/noticias"
            className="shrink-0 transition-colors"
            style={{
              fontFamily: F.body,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontSize: "14px",
              color: C.gris,
            }}
          >
            Ver todas →
          </Link>
        </div>

        {/* ── DESTACADA ─────────────────────────────────────────────────────
            Móvil: imagen arriba a todo el ancho, texto abajo. Desde `sm`, dos
            columnas 1fr/2fr con el texto centrado verticalmente: el alto lo
            pone la imagen 4:5, y el texto se acomoda en el centro. */}
        <Link
          href={`/noticias/${principal.slug}`}
          className="group grid grid-cols-1 sm:grid-cols-[1fr_2fr] rounded-lg overflow-hidden border transition-all duration-200 hover:-translate-y-1"
          style={TARJETA}
        >
          <ImagenNoticia src={principal.imagen_url} alt={principal.titular} sizes={SIZES_DESTACADA} />

          <div className="p-6 sm:p-8 lg:p-12 flex flex-col justify-center gap-4 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge categoria={principal.categoria} />
              <Autor nombre={principal.artistas?.nombre} />
              <span style={{ color: C.grisTenue, fontSize: "12px" }} aria-hidden>·</span>
              <Fecha iso={principal.created_at} />
            </div>

            <h3
              style={{
                fontFamily: F.titulo,
                fontSize: "clamp(28px, 3.5vw, 44px)",
                lineHeight: 1.08,
                letterSpacing: "0.02em",
                color: C.blanco,
              }}
            >
              {principal.titular}
            </h3>

            {/* Bajada, o extracto del cuerpo si viene vacía (lib/noticias.ts). */}
            {principal.resumen && (
              <p
                className="line-clamp-4"
                style={{ fontFamily: F.body, fontSize: "16px", color: C.gris, lineHeight: 1.65 }}
              >
                {principal.resumen}
              </p>
            )}

            {/*
              Un <span> y no un <Link>: toda la tarjeta ya es el enlace, y un
              <a> dentro de otro es HTML inválido.

              El color va por clases y NO inline: un estilo inline le gana en
              especificidad a `group-hover:`, igual que en los iconos del
              Footer. Los hexes son C.rojo y C.rojoAcento.
            */}
            <span
              className="inline-flex items-center gap-2 self-start text-[#CC0000] transition-colors duration-200 group-hover:text-[#FF2200]"
              style={{
                fontFamily: F.body,
                fontSize: "14px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Leer nota completa
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
            </span>
          </div>
        </Link>

        {/* ── FILA: noticias 2, 3 y 4 ───────────────────────────────────────
            1 columna en móvil, 3 en escritorio. En tablet (2 columnas) la
            tercera tarjeta se oculta para que la fila quede 2 + 0 y no con una
            tarjeta huérfana: `sm:hidden lg:flex` la saca solo entre sm y lg. */}
        {fila.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-5">
            {fila.map((n, i) => (
              <Link
                key={n.id}
                href={`/noticias/${n.slug}`}
                className={`group rounded-lg overflow-hidden border transition-all duration-200 hover:-translate-y-1 flex flex-col ${
                  i === 2 ? "sm:hidden lg:flex" : ""
                }`}
                style={TARJETA}
              >
                <ImagenNoticia src={n.imagen_url} alt={n.titular} sizes={SIZES_FILA} />

                <div className="p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge categoria={n.categoria} />
                    <Fecha iso={n.created_at} />
                  </div>

                  <h4
                    className="line-clamp-3"
                    style={{
                      fontFamily: F.titulo,
                      fontSize: "22px",
                      lineHeight: 1.15,
                      letterSpacing: "0.02em",
                      color: C.blanco,
                    }}
                  >
                    {n.titular}
                  </h4>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
