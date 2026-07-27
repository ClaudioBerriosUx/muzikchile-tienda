import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { C, F } from "@/lib/portada";
import { etiquetaCategoria } from "@/lib/publicaciones";

/**
 * Server Component: las noticias se leen en el servidor.
 *
 * Usa el cliente anon directo (sin cookies) igual que `app/sitemap.ts`: no hace
 * falta sesión para leer publicaciones públicas, y evitar `cookies()` deja que
 * la ruta pueda cachearse en vez de volverse dinámica por sesión.
 *
 * El RLS `publicaciones_select_publico` ya limita a estado='publicada' +
 * visibilidad='publica'; los filtros explícitos son defensa en profundidad.
 */
interface NoticiaPortada {
  id: string;
  titular: string;
  bajada: string | null;
  imagen_url: string | null;
  slug: string;
  categoria: string | null;
  created_at: string;
  artistas: { nombre: string } | null;
}

async function traerNoticias(): Promise<NoticiaPortada[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  const supabase = createClient<Database>(url, key);

  const { data, error } = await supabase
    .from("publicaciones")
    .select("id, titular, bajada, imagen_url, slug, categoria, created_at, artistas(nombre)")
    .eq("estado", "publicada")
    .eq("tipo", "noticia")
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    // Una portada sin noticias es preferible a una portada caída.
    console.error("[portada] error cargando noticias:", error.message);
    return [];
  }
  return data ?? [];
}

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Estilo de tarjeta compartido por las cuatro piezas de la grilla. */
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

/**
 * Badge de categoría.
 *
 * `etiquetaCategoria` devuelve "—" para una categoría desconocida o nula; en
 * ese caso no se pinta nada, porque un badge con un guion es peor que ningún
 * badge. Por eso devuelve null en vez de renderizar el fallback.
 *
 * ⚠️ Hoy las 8 noticias migradas son `categoria: 'general'`, así que todas
 * muestran "GENERAL". SHOW / PRENSA / LANZAMIENTO aparecerán cuando alguien
 * las clasifique — el vocabulario ya existe en `lib/publicaciones.ts`.
 */
function Badge({ categoria, flotante = false }: { categoria: string | null; flotante?: boolean }) {
  const etiqueta = etiquetaCategoria(categoria);
  if (etiqueta === "—") return null;

  return (
    <span
      className={flotante ? "absolute top-3 left-3" : "self-start"}
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
        // Sobre la imagen necesita despegarse del fondo, que puede ser claro.
        boxShadow: flotante ? "0 2px 8px rgba(0,0,0,0.45)" : undefined,
      }}
    >
      {etiqueta}
    </span>
  );
}

/** Marcador para cuando la noticia no trae imagen. */
function SinImagen() {
  return <div className="w-full h-full" style={{ backgroundColor: "#141414" }} />;
}

export default async function UltimasNoticias() {
  const noticias = await traerNoticias();

  // Igual que el original: sin noticias publicadas, la sección no existe.
  if (noticias.length === 0) return null;

  const [principal, ...secundarias] = noticias;

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

        {/*
          Grilla 55/45. Las dos columnas quedan a la misma altura porque grid
          estira los items por defecto (`align-items: stretch`): la destacada
          crece hasta igualar a la columna derecha sin que haya que fijarle
          alto. En móvil colapsa a una sola columna y el orden del DOM
          —destacada, secundarias, CTA— es el orden de lectura correcto.
        */}
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-5">
          {/* ── COLUMNA IZQUIERDA: la destacada ───────────────────────────── */}
          <Link
            href={`/noticias/${principal.slug}`}
            className="group rounded-lg overflow-hidden border transition-all duration-200 hover:-translate-y-1 flex flex-col"
            style={TARJETA}
          >
            <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
              {principal.imagen_url ? (
                <img
                  src={principal.imagen_url}
                  alt={principal.titular}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <SinImagen />
              )}
              <Badge categoria={principal.categoria} flotante />
            </div>

            {/* `flex-1` para que el bloque de texto absorba el alto sobrante
                cuando la columna derecha es más alta que esta tarjeta. */}
            <div className="p-6 flex flex-col gap-2.5 flex-1">
              <div className="flex items-center gap-3">
                <Autor nombre={principal.artistas?.nombre} />
                <span style={{ fontFamily: F.body, fontSize: "12px", color: C.grisTenue }}>
                  {fecha(principal.created_at)}
                </span>
              </div>

              <h3
                style={{
                  fontFamily: F.titulo,
                  fontSize: "32px",
                  lineHeight: 1.12,
                  letterSpacing: "0.02em",
                  color: C.blanco,
                }}
              >
                {principal.titular}
              </h3>

              {/* Las dos noticias más recientes vienen con `bajada` vacía desde
                  la migración del Channel, así que hoy esto no se pinta. */}
              {principal.bajada && (
                <p
                  className="line-clamp-4"
                  style={{ fontFamily: F.body, fontSize: "15px", color: C.gris, lineHeight: 1.65 }}
                >
                  {principal.bajada}
                </p>
              )}
            </div>
          </Link>

          {/* ── COLUMNA DERECHA: dos horizontales + CTA ───────────────────── */}
          <div className="flex flex-col gap-5">
            {secundarias.map((n) => (
              <Link
                key={n.id}
                href={`/noticias/${n.slug}`}
                className="group rounded-lg overflow-hidden border transition-all duration-200 hover:-translate-y-1 flex"
                style={TARJETA}
              >
                <div className="w-[120px] sm:w-[140px] shrink-0 overflow-hidden">
                  {n.imagen_url ? (
                    <img
                      src={n.imagen_url}
                      alt={n.titular}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <SinImagen />
                  )}
                </div>

                <div className="p-4 flex flex-col gap-2 min-w-0">
                  <Badge categoria={n.categoria} />

                  <h4
                    className="line-clamp-2"
                    style={{
                      fontFamily: F.titulo,
                      fontSize: "19px",
                      lineHeight: 1.2,
                      letterSpacing: "0.02em",
                      color: C.blanco,
                    }}
                  >
                    {n.titular}
                  </h4>

                  <div className="flex items-center gap-2 flex-wrap mt-auto">
                    <span style={{ fontFamily: F.body, fontSize: "11px", color: C.grisTenue }}>
                      {fecha(n.created_at)}
                    </span>
                    <Autor nombre={n.artistas?.nombre} />
                  </div>
                </div>
              </Link>
            ))}

            {/*
              CTA al archivo. Misma tarjeta que las demás pero sin imagen.

              `mt-auto` lo empuja al fondo de la columna: si la destacada es más
              alta, el hueco sobrante queda ARRIBA del CTA y no entre las dos
              noticias, que es lo que mantiene el bloque alineado por abajo.
            */}
            <Link
              href="/noticias"
              className="group mt-auto rounded-lg border transition-all duration-200 hover:-translate-y-1 flex items-center justify-between gap-4 p-5"
              style={TARJETA}
            >
              <span
                style={{
                  fontFamily: F.titulo,
                  fontSize: "20px",
                  lineHeight: 1.2,
                  letterSpacing: "0.02em",
                  color: C.blanco,
                  textTransform: "uppercase",
                }}
              >
                Revisa el archivo completo de notas
              </span>

              {/*
                La flecha se corre a la derecha y se enciende en el hover.

                El color va por clases y NO en el `style` inline: un estilo
                inline le gana en especificidad a `hover:`, así que mientras
                `color` estuviera ahí el cambio de tono no se vería. Es el mismo
                tropiezo que ya documentó el Footer con los iconos de redes.
                Los hexes son C.rojo y C.rojoAcento.

                `inline-block` porque `translate` no aplica a un elemento
                inline, que es lo que sería un <span> por defecto.
              */}
              <span
                className="inline-block shrink-0 text-[#CC0000] transition-all duration-200 group-hover:translate-x-1 group-hover:text-[#FF2200]"
                style={{ fontSize: "26px", lineHeight: 1 }}
              >
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
