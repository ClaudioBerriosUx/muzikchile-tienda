import { existsSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Beneficios de estar en MuzikChile, para /login (diseño "Acceso Artistas",
 * opción 2A): mosaico en desktop, carrusel bajo el formulario en móvil.
 *
 * Server Component a propósito: revisa en el build qué fotos existen en
 * `public/acceso/`. Las fotos son opcionales; sin archivo se ve solo el
 * degradado, sin pedir una imagen que daría 404.
 */

type Tono = "rojo" | "azul";

interface Beneficio {
  clave: "ficha" | "tienda" | "noticias" | "senal";
  titulo: string;
  texto: string;
  tono: Tono;
  icono: ReactNode;
}

const trazo = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const BENEFICIOS: Beneficio[] = [
  {
    clave: "ficha",
    titulo: "Tu ficha, gratis",
    texto: "Perfil público con tu música, redes y ciudad, visible para público de Chile y del extranjero.",
    tono: "rojo",
    icono: (
      <svg viewBox="0 0 24 24" {...trazo} aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <circle cx="9" cy="11" r="2" />
        <path d="M5.8 16c.6-1.6 1.9-2.4 3.2-2.4s2.6.8 3.2 2.4" />
        <line x1="14.5" y1="10" x2="18" y2="10" />
        <line x1="14.5" y1="13.5" x2="18" y2="13.5" />
      </svg>
    ),
  },
  {
    clave: "tienda",
    titulo: "Tu tienda",
    texto: "Vende tu merch y tu música digital con pago seguro por MercadoPago.",
    tono: "azul",
    icono: (
      <svg viewBox="0 0 24 24" {...trazo} aria-hidden>
        <path d="M6 7h12l-1 13H7z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
    ),
  },
  {
    clave: "noticias",
    titulo: "Tus noticias",
    texto: "Publica lanzamientos y shows en el medio de MuzikChile.",
    tono: "rojo",
    icono: (
      <svg viewBox="0 0 24 24" {...trazo} aria-hidden>
        <rect x="4" y="4" width="16" height="16" rx="2.5" />
        <line x1="8" y1="9" x2="16" y2="9" />
        <line x1="8" y1="12.5" x2="16" y2="12.5" />
        <line x1="8" y1="16" x2="12.5" y2="16" />
      </svg>
    ),
  },
  {
    clave: "senal",
    titulo: "En la señal",
    texto: "Tus videos pueden sonar en la señal de MuzikChile TV.",
    tono: "azul",
    icono: (
      <svg viewBox="0 0 24 24" {...trazo} aria-hidden>
        <rect x="3" y="5" width="18" height="12" rx="2" />
        <polygon points="10 8.5 15 11 10 13.5" />
        <line x1="8" y1="20.5" x2="16" y2="20.5" />
      </svg>
    ),
  },
];

/** URL de la foto si el archivo existe en public/acceso/, si no null. */
function foto(clave: Beneficio["clave"]): string | null {
  const archivo = `${clave}.webp`;
  return existsSync(path.join(process.cwd(), "public", "acceso", archivo))
    ? `/acceso/${archivo}`
    : null;
}

/** Degradado del diseño: color del tono abajo, fondo arriba. */
function degradado(tono: Tono, medio: number) {
  const color = tono === "rojo" ? "var(--tema-rojo)" : "var(--tema-azul)";
  return (
    `linear-gradient(to top, color-mix(in srgb, ${color} 88%, transparent) 0%, ` +
    `color-mix(in srgb, var(--tema-fondo) 72%, transparent) ${medio}%, ` +
    `color-mix(in srgb, var(--tema-fondo) 40%, transparent) 100%)`
  );
}

/** Tarjeta: foto opcional + degradado + contenido abajo. */
function Tarjeta({
  b,
  medio,
  className,
  children,
}: {
  b: Beneficio;
  medio: number;
  className?: string;
  children: ReactNode;
}) {
  const url = foto(b.clave);
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-tema-borde bg-tema-fondo", className)}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- foto decorativa local, sin optimización necesaria
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div aria-hidden className="absolute inset-0" style={{ background: degradado(b.tono, medio) }} />
      <div className="absolute inset-x-0 bottom-0">{children}</div>
    </div>
  );
}

function CajaIcono({ b, tam }: { b: Beneficio; tam: "lg" | "md" | "sm" }) {
  const caja = { lg: "h-11 w-11 [&_svg]:h-[22px] [&_svg]:w-[22px]", md: "h-[34px] w-[34px] [&_svg]:h-[17px] [&_svg]:w-[17px]", sm: "h-7 w-7 [&_svg]:h-3.5 [&_svg]:w-3.5" }[tam];
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-[10px] border text-tema-texto", caja)}
      style={{
        background: "color-mix(in srgb, var(--tema-fondo) 55%, transparent)",
        borderColor: "color-mix(in srgb, var(--tema-texto) 28%, transparent)",
      }}
    >
      {b.icono}
    </div>
  );
}

/** Desktop: la ficha ocupa la columna izquierda entera; las otras tres, apiladas. */
export function MosaicoBeneficios({ className }: { className?: string }) {
  const [principal, ...resto] = BENEFICIOS;
  return (
    <aside
      aria-label="Qué ganas al estar en MuzikChile"
      className={cn(
        "relative grid min-w-0 grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] grid-rows-3 gap-3 border-l border-tema-borde bg-tema-superficie p-4",
        className
      )}
    >
      <Tarjeta b={principal} medio={52} className="row-span-3">
        <div className="flex flex-col gap-3 px-6 py-[26px]">
          <CajaIcono b={principal} tam="lg" />
          <p className="m-0 font-heading text-[40px]/none uppercase text-tema-texto">{principal.titulo}</p>
          <p className="m-0 max-w-[300px] text-[15px] leading-[1.6] text-tema-texto">{principal.texto}</p>
          <div
            aria-hidden
            className="mb-0.5 mt-2 h-px"
            style={{ background: "color-mix(in srgb, var(--tema-texto) 28%, transparent)" }}
          />
          <p className="m-0 font-heading text-[30px]/none uppercase text-tema-texto text-balance">
            La escena se escucha acá
          </p>
        </div>
      </Tarjeta>
      {resto.map((b) => (
        <Tarjeta key={b.clave} b={b} medio={60} className="min-h-0">
          <div className="flex flex-col gap-2 px-[18px] py-4">
            <CajaIcono b={b} tam="md" />
            <p className="m-0 font-heading text-[26px]/none uppercase text-tema-texto">{b.titulo}</p>
            <p className="m-0 text-[13px] leading-[1.5] text-tema-texto">{b.texto}</p>
          </div>
        </Tarjeta>
      ))}
    </aside>
  );
}

/** Móvil y tablet: carrusel horizontal con scroll-snap, bajo el formulario. */
export function CarruselBeneficios({ className }: { className?: string }) {
  return (
    <section aria-label="Qué ganas al estar en MuzikChile" className={cn("w-full pt-6", className)}>
      <div className="mb-2.5 flex items-center justify-between">
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.2em] text-tema-texto-3">
          Qué ganas al estar en MuzikChile
        </p>
        <span aria-hidden className="text-xs text-tema-texto-3">Desliza →</span>
      </div>
      <div className="-mx-[22px] flex snap-x snap-mandatory scroll-pl-[22px] gap-2.5 overflow-x-auto px-[22px] [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
        {BENEFICIOS.map((b) => (
          <Tarjeta key={b.clave} b={b} medio={62} className="h-[138px] flex-[0_0_76%] snap-start md:flex-[0_0_48%]">
            <div className="flex flex-col gap-[5px] px-3.5 py-3">
              <div className="flex items-center gap-[9px]">
                <CajaIcono b={b} tam="sm" />
                <p className="m-0 font-heading text-[22px]/none uppercase text-tema-texto">{b.titulo}</p>
              </div>
              <p className="m-0 text-[12.5px] leading-[1.45] text-tema-texto">{b.texto}</p>
            </div>
          </Tarjeta>
        ))}
        <div aria-hidden className="flex-[0_0_2px]" />
      </div>
    </section>
  );
}
