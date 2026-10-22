import Image from "next/image";
import Link from "next/link";
import { C, F, TEMA } from "@/lib/portada";
import type { AutorNoticia } from "@/lib/noticias";
import SelloVerificado from "@/components/tienda/SelloVerificado";

/**
 * Enlace estirado: va en el <Link> del titular de una tarjeta, cuyo contenedor
 * es `relative`. El `::after` cubre toda la tarjeta, así que se puede hacer clic
 * en cualquier parte, y la firma (`relative z-10`) queda encima con su propio
 * enlace sin anidar un <a> dentro de otro. El foco se dibuja sobre el `::after`
 * para que el anillo rodee la tarjeta y no solo el titular.
 */
export const ENLACE_ESTIRADO =
  "after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-tema-azul-texto";

/** Proporción de `public/logo.svg` (ver components/layout/Logo.tsx). */
const RATIO_LOGO = 432.146 / 167.061;

/**
 * Logo sin enlace. `<Logo/>` siempre envuelve en un <Link> al inicio, y acá no
 * corresponde: en las tarjetas quedaría un enlace dentro de otro.
 */
function LogoFirma({ alto }: { alto: number }) {
  return (
    <Image
      src="/logo.svg"
      alt=""
      width={Math.round(alto * RATIO_LOGO)}
      height={alto}
      style={{ height: alto, width: "auto" }}
      className="shrink-0"
    />
  );
}

function Avatar({ autor, tam }: { autor: AutorNoticia; tam: number }) {
  return (
    <span className="relative shrink-0" style={{ width: tam, height: tam }}>
      {autor.foto_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- la foto puede venir de cualquier host
        <img
          src={autor.foto_url}
          alt=""
          className="w-full h-full rounded-full object-cover"
          style={{ border: `${tam >= 40 ? 2 : 1}px solid ${C.rojo}` }}
        />
      ) : (
        <span
          className="w-full h-full rounded-full flex items-center justify-center"
          style={{ backgroundColor: C.rojo, color: C.blanco, fontFamily: F.body, fontSize: tam * 0.45 }}
          aria-hidden="true"
        >
          {autor.nombre.charAt(0).toUpperCase()}
        </span>
      )}
      {autor.verificado && (
        <SelloVerificado size={tam >= 40 ? 18 : 12} className="-bottom-1 -right-1" />
      )}
    </span>
  );
}

/**
 * Firma de una noticia.
 *
 * - Editorial: logo + "Redacción MuzikChile", sin enlace (los perfiles
 *   editoriales no tienen ficha pública: /artista/[slug] les da 404).
 * - Artista: foto, nombre, sello de verificado y enlace a su ficha.
 *
 * `tarjeta` es la línea compacta de los listados. Su enlace lleva `relative z-10`
 * para quedar por encima del enlace estirado de la tarjeta (ver TarjetaNoticia).
 * `ficha` es el bloque grande de /noticias/[slug].
 */
export default function FirmaNoticia({
  autor,
  variante,
}: {
  autor: AutorNoticia | null;
  variante: "tarjeta" | "ficha";
}) {
  if (!autor) return null;
  const editorial = autor.es_editorial;

  if (variante === "tarjeta") {
    const texto = {
      fontFamily: F.body,
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      fontSize: "12px",
      color: C.rojoClaro,
    } as const;

    if (editorial) {
      return (
        <span className="inline-flex items-center gap-2 min-w-0">
          <LogoFirma alto={16} />
          <span className="truncate" style={texto}>Redacción MuzikChile</span>
        </span>
      );
    }
    return (
      <Link
        href={`/artista/${autor.slug}`}
        className="relative z-10 inline-flex items-center gap-2 min-w-0 hover:underline"
        style={texto}
      >
        <Avatar autor={autor} tam={22} />
        <span className="truncate">{autor.nombre}</span>
      </Link>
    );
  }

  const clases = "group flex items-center gap-3 mt-8 p-4 rounded-lg border transition-colors";
  const estilo = { borderColor: TEMA.borde, backgroundColor: TEMA.superficie };
  const nombre = {
    fontFamily: F.body,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontSize: "17px",
    color: C.blanco,
  } as const;
  const rotulo = { fontFamily: F.body, fontSize: "12px", color: TEMA.texto3 };

  if (editorial) {
    return (
      <div className={clases} style={estilo}>
        <LogoFirma alto={30} />
        <span className="min-w-0">
          <span className="block" style={rotulo}>Escrito por</span>
          <span className="block truncate" style={nombre}>Redacción MuzikChile</span>
        </span>
      </div>
    );
  }

  return (
    <Link href={`/artista/${autor.slug}`} className={clases} style={estilo}>
      <Avatar autor={autor} tam={44} />
      <span className="min-w-0">
        <span className="block" style={rotulo}>Publicado por</span>
        <span className="block truncate" style={nombre}>{autor.nombre}</span>
      </span>
      <span
        className="ml-auto shrink-0"
        style={{
          fontFamily: F.body,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontSize: "12px",
          color: C.rojoClaro,
        }}
      >
        Ver ficha →
      </span>
    </Link>
  );
}
