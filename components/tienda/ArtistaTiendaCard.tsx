import Image from "next/image";
import Link from "next/link";

interface Props {
  artista: {
    nombre: string;
    slug: string;
    fotoUrl?: string | null;
    verificado?: boolean | null;
  };
}

/**
 * Tarjeta-enlace destacada hacia la tienda del artista (`/artista/[slug]`).
 * Todo el bloque es un solo <Link>; el halo y los íconos son decorativos.
 * #1E3A56 (inicio del degradado) no tiene token `--tema-*`: va literal.
 */
export default function ArtistaTiendaCard({ artista }: Props) {
  const { nombre, slug, fotoUrl, verificado } = artista;

  return (
    <Link
      href={`/artista/${slug}`}
      aria-label={`Ver tienda de ${nombre}`}
      className="group relative grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-4 overflow-hidden rounded-xl border border-tema-azul bg-[linear-gradient(100deg,#1E3A56_0%,#131F2C_70%)] px-[18px] py-4 no-underline transition-[transform,border-color,box-shadow] duration-[180ms] hover:-translate-y-0.5 hover:border-tema-azul-texto hover:no-underline hover:shadow-[0_12px_32px_rgba(0,0,0,0.35),0_0_0_1px_rgba(127,166,211,0.35)] focus-visible:no-underline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-tema-azul-texto"
    >
      <span
        className="pointer-events-none absolute -right-5 -top-10 h-[180px] w-[180px] rounded-full bg-[radial-gradient(circle,rgba(127,166,211,0.22),transparent_70%)]"
        aria-hidden="true"
      />

      <span className="relative h-14 w-14">
        <span className="block h-14 w-14 overflow-hidden rounded-full border-2 border-tema-azul-texto bg-tema-azul-fondo">
          {fotoUrl ? (
            <Image src={fotoUrl} alt="" width={56} height={56} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl uppercase text-tema-texto font-heading" aria-hidden="true">
              {nombre.charAt(0)}
            </span>
          )}
        </span>
        {verificado && (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-tema-azul-fondo bg-tema-azul"
            aria-hidden="true"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#EDEDED" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
      </span>

      <span className="relative flex min-w-0 flex-col gap-[3px]">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-tema-azul-etiqueta">
          Tienda oficial del artista
        </span>
        <span className="font-heading text-[19px] font-normal uppercase leading-none text-tema-texto sm:text-[22px]">
          Ver tienda de {nombre}
        </span>
        <span className="truncate text-[13px] text-tema-azul-texto-suave">
          Más música, merch y noticias en su ficha
        </span>
      </span>

      <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-tema-rojo shadow-[0_6px_18px_rgba(176,47,60,0.35)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EDEDED" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </span>
    </Link>
  );
}
