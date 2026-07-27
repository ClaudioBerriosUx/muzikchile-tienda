import { C, F } from "@/lib/portada";
import { sanitizarHtml } from "@/lib/sanitizar";
import {
  pareceHtml,
  textoPlanoAHtml,
  trocearContenido,
  urlSpotify,
  urlYoutube,
  type Embed,
} from "@/lib/embeds";

/**
 * Renderiza el cuerpo de una noticia: HTML rico + embeds.
 *
 * Es un Server Component. La sanitización corre acá, en el servidor, antes de
 * que el HTML llegue al navegador. YouTube y Spotify son iframes puros, así que
 * no hace falta JS de cliente para nada.
 *
 * ORDEN DE OPERACIONES (importa):
 *   1. Si el cuerpo es texto plano, se escapa y se envuelve en párrafos.
 *   2. Se TROCEA buscando embeds (shortcodes y bloques TipTap).
 *   3. Cada trozo de HTML se sanitiza por separado.
 *   4. Cada embed se renderiza como componente React con una URL construida
 *      desde cero a partir de un ID ya validado.
 *
 * El paso 2 va antes del 3 a propósito: DOMPurify borra los `data-*` de los
 * bloques de TipTap, así que si se sanitizara primero, la info del embed se
 * perdería. Y no debilita nada: el HTML nunca se renderiza sin sanitizar, y de
 * los embeds solo se extraen tipo e id, que se validan contra patrones
 * estrictos antes de usarse.
 */

// ── Embeds ───────────────────────────────────────────────────────────────────

function MarcoResponsivo({
  children,
  proporcion = "16 / 9",
}: {
  children: React.ReactNode;
  proporcion?: string;
}) {
  return (
    <div
      className="relative w-full my-8 rounded-lg overflow-hidden border"
      style={{ aspectRatio: proporcion, borderColor: C.borde }}
    >
      {children}
    </div>
  );
}

function EmbedYoutube({ id }: { id: string }) {
  return (
    <MarcoResponsivo>
      <iframe
        src={urlYoutube(id)}
        title="Video de YouTube"
        className="absolute inset-0 w-full h-full"
        style={{ border: 0 }}
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </MarcoResponsivo>
  );
}

function EmbedSpotify({ valor }: { valor: string }) {
  // Los tracks son bajos; los álbumes y playlists necesitan más alto.
  const esCorto = valor.startsWith("track/") || valor.startsWith("episode/");
  return (
    <div className="my-8 rounded-lg overflow-hidden border" style={{ borderColor: C.borde }}>
      <iframe
        src={urlSpotify(valor)}
        title="Reproductor de Spotify"
        className="w-full"
        style={{ border: 0, height: esCorto ? "152px" : "352px" }}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </div>
  );
}

const ETIQUETA: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "X",
};

/**
 * Instagram, TikTok y X necesitan cargar el script de cada plataforma y
 * reprocesar el DOM al montar. Por ahora se muestra un enlace claro al post
 * original en vez de un embed.
 *
 * TODO: reemplazar por el embed real cargando el script correspondiente solo si
 * hay un embed de ese tipo en el contenido (window.instgrm.Embeds.process(),
 * el de TikTok y widgets.twitter.js).
 */
function EmbedEnlace({ tipo, url }: { tipo: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 my-8 p-4 rounded-lg border transition-colors"
      style={{ borderColor: C.borde, backgroundColor: C.negroSuave }}
    >
      <span
        className="shrink-0 px-2 py-0.5 rounded-full border"
        style={{
          borderColor: C.rojo,
          color: C.rojoClaro,
          fontFamily: F.body,
          fontSize: "12px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {ETIQUETA[tipo] ?? tipo}
      </span>
      <span
        className="truncate"
        style={{ fontFamily: F.body, fontSize: "14px", color: C.grisClaro }}
      >
        Ver publicación en {ETIQUETA[tipo] ?? tipo}
      </span>
      <span
        className="ml-auto shrink-0"
        style={{ fontFamily: F.body, fontSize: "13px", color: C.rojoClaro }}
      >
        Abrir →
      </span>
    </a>
  );
}

function RenderEmbed({ embed }: { embed: Embed }) {
  if (embed.tipo === "youtube") return <EmbedYoutube id={embed.valor} />;
  if (embed.tipo === "spotify") return <EmbedSpotify valor={embed.valor} />;
  return <EmbedEnlace tipo={embed.tipo} url={embed.valor} />;
}

// ── Componente principal ─────────────────────────────────────────────────────

/**
 * ¿Vale la pena renderizar este trozo de HTML?
 *
 * Al sacar un shortcode que estaba solo en su párrafo queda un `<p></p>` vacío,
 * que se ve como un hueco. Se descartan los trozos sin texto, salvo que traigan
 * contenido propio (una imagen, un separador).
 */
function tieneContenido(html: string): boolean {
  if (/<(img|hr|figure)\b/i.test(html)) return true;
  return html.replace(/<[^>]*>/g, "").trim().length > 0;
}

export default function ContenidoNoticia({ cuerpo }: { cuerpo: string | null }) {
  if (!cuerpo?.trim()) return null;

  // La noticia que ya existe tiene el cuerpo en texto plano.
  const base = pareceHtml(cuerpo) ? cuerpo : textoPlanoAHtml(cuerpo);

  const trozos = trocearContenido(base).filter(
    (t) => t.clase === "embed" || tieneContenido(t.html)
  );

  return (
    <div className="contenido-noticia mt-8">
      {trozos.map((trozo, i) =>
        trozo.clase === "embed" ? (
          <RenderEmbed key={i} embed={trozo.embed} />
        ) : (
          <div
            key={i}
            // Sanitizado en el servidor, justo arriba. Nunca se pasa el cuerpo
            // crudo por acá.
            dangerouslySetInnerHTML={{ __html: sanitizarHtml(trozo.html) }}
          />
        )
      )}
    </div>
  );
}
