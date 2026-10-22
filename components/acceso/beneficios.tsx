import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Beneficios de estar en MuzikChile, para /login (diseño "Acceso Artistas",
 * opción 3A: dos columnas sin fotos, texto grande + marquesinas).
 *
 *   - Desktop: `PanelBeneficios`, la columna derecha entera.
 *   - Móvil y tablet: `ListaBeneficios`, bajo el formulario.
 *
 * Server Components sin estado. Lo único que se mueve son las marquesinas
 * (CSS puro, `.marquesina-pista` en globals.css), que son decorativas
 * (`aria-hidden`) y se quedan quietas con `prefers-reduced-motion`.
 *
 * Reemplaza a la opción 2A (mosaico con fotos opcionales de public/acceso/ y
 * carrusel en móvil).
 */

type Tono = "rojo" | "azul";

interface Beneficio {
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
    titulo: "Tu perfil, gratis",
    texto: "Tu música, tus redes y tu ciudad en un solo lugar, para que te encuentren en Chile y afuera.",
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
    titulo: "Tu tienda",
    texto: "Vende tu merch y tu música digital sin armar tu propia web. Los pagos van seguros por MercadoPago.",
    tono: "azul",
    icono: (
      <svg viewBox="0 0 24 24" {...trazo} aria-hidden>
        <path d="M6 7h12l-1 13H7z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
    ),
  },
  {
    titulo: "Tus noticias",
    texto: "Cuenta tus lanzamientos y tocatas en el medio de MuzikChile, junto a la redacción.",
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
    titulo: "En la señal",
    texto: "Tus videoclips pueden entrar a la rotación de MuzikChile TV, la señal continua de música chilena.",
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

const MARQUESINA_A = [
  "Solo por invitación", "Escena independiente", "Valparaíso", "Santiago",
  "Concepción", "Temuco", "Iquique", "Valdivia", "Antofagasta",
];
const MARQUESINA_B = [
  "Tu perfil", "Tu tienda", "Tus noticias", "En la señal", "MuzikChile TV",
  "La escena se escucha acá",
];

const TITULO_SECCION = "Qué ganas al estar en MuzikChile";

// ── Piezas ───────────────────────────────────────────────────────────────────

/**
 * Franja con palabras en bucle. El recorrido va duplicado y la pista se
 * desplaza -50%: al terminar, la segunda copia ocupa el lugar de la primera y
 * el salto no se nota.
 */
function Marquesina({
  palabras,
  duracion,
  retraso = "0s",
}: {
  palabras: string[];
  duracion: string;
  retraso?: string;
}) {
  const recorrido = palabras.map((p, i) => (
    <span
      key={p}
      className="inline-flex items-center gap-4 whitespace-nowrap pb-[9px] pr-4 pt-2.5 font-heading text-[13px] uppercase tracking-[0.22em]"
      style={{ fontWeight: 400, color: "color-mix(in srgb, var(--tema-texto) 70%, transparent)" }}
    >
      {p}
      <span className={cn("inline-block h-[5px] w-[5px] rounded-full", i % 2 ? "bg-tema-azul" : "bg-tema-rojo")} />
    </span>
  ));

  return (
    <div
      aria-hidden="true"
      data-marquesina
      className="overflow-hidden whitespace-nowrap border-y border-tema-borde"
      style={{ background: "color-mix(in srgb, var(--tema-fondo) 50%, transparent)" }}
    >
      <div
        className="marquesina-pista inline-flex"
        style={{ "--marquesina-duracion": duracion, "--marquesina-retraso": retraso } as React.CSSProperties}
      >
        <div className="inline-flex">{recorrido}</div>
        <div className="inline-flex">{recorrido}</div>
      </div>
    </div>
  );
}

function CajaIcono({ b, tam }: { b: Beneficio; tam: "lg" | "md" }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border text-tema-texto",
        b.tono === "rojo" ? "border-tema-rojo bg-tema-rojo-fondo" : "border-tema-azul bg-tema-azul-fondo",
        tam === "lg" ? "h-11 w-11 rounded-xl [&_svg]:h-5 [&_svg]:w-5" : "h-10 w-10 rounded-[10px] [&_svg]:h-[18px] [&_svg]:w-[18px]"
      )}
    >
      {b.icono}
    </div>
  );
}

// ── Desktop ──────────────────────────────────────────────────────────────────

/**
 * Columna derecha en desktop: fondo con grilla y halos, marquesina arriba,
 * los 4 beneficios en Anton grande y otra marquesina abajo. El `className`
 * debe incluir el display, p. ej. `hidden lg:flex`.
 */
export function PanelBeneficios({ className }: { className?: string }) {
  return (
    <aside
      aria-label={TITULO_SECCION}
      className={cn(
        "relative min-w-0 flex-col justify-between overflow-hidden border-l border-tema-borde",
        className
      )}
      style={{ background: "linear-gradient(180deg, var(--tema-superficie) 0%, var(--tema-fondo) 100%)" }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(237,237,237,0.03) 1px, transparent 1px), " +
              "linear-gradient(90deg, rgba(237,237,237,0.03) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, #000 10%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, #000 10%, transparent 80%)",
          }}
        />
        <div
          className="absolute -right-[120px] -top-[120px] h-[460px] w-[460px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(176,47,60,0.2) 0%, rgba(176,47,60,0) 68%)" }}
        />
        <div
          className="absolute -bottom-40 -left-[120px] h-[460px] w-[460px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(44,86,127,0.2) 0%, rgba(44,86,127,0) 68%)" }}
        />
      </div>

      {/* Baja lo que la cápsula del header tapa (14px): si no, el borde superior
          de la marquesina queda bajo el vidrio. */}
      <div className="relative pt-[calc(var(--header-ocupa)-var(--alto-header))]">
        <Marquesina palabras={MARQUESINA_A} duracion="44s" />
      </div>

      <div className="relative flex flex-1 flex-col justify-center px-11 py-7">
        <div className="mx-auto w-full max-w-[620px]">
          <p className="m-0 mb-2 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.22em] text-tema-texto-3">
            <span aria-hidden="true" className="h-0.5 w-6 bg-tema-rojo" />
            {TITULO_SECCION}
          </p>
          <ol className="m-0 flex list-none flex-col p-0">
            {BENEFICIOS.map((b, i) => (
              <li
                key={b.titulo}
                className={cn(
                  "grid grid-cols-[52px_minmax(0,1fr)] items-start gap-[18px] py-[22px]",
                  i > 0 && "border-t border-tema-borde"
                )}
              >
                <div className="flex flex-col items-center gap-2.5">
                  <CajaIcono b={b} tam="lg" />
                  <span aria-hidden="true" className="font-heading text-xs tracking-[0.14em] text-tema-texto-3" style={{ fontWeight: 400 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <p className="m-0 font-heading text-[34px] uppercase leading-[0.98] text-tema-texto" style={{ fontWeight: 400 }}>
                    {b.titulo}
                  </p>
                  <p className="m-0 max-w-[420px] text-[15px] leading-[1.6] text-tema-texto-2" style={{ textWrap: "pretty" }}>
                    {b.texto}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="relative">
        <Marquesina palabras={MARQUESINA_B} duracion="52s" retraso="-9s" />
      </div>
    </aside>
  );
}

// ── Móvil y tablet ───────────────────────────────────────────────────────────

/**
 * Bajo el formulario, pegada abajo y a todo el ancho (anula el padding
 * horizontal de 22px de la columna): marquesina y la lista compacta.
 */
export function ListaBeneficios({ className }: { className?: string }) {
  return (
    <section aria-label={TITULO_SECCION} className={cn("-mx-[22px] mt-auto pt-6 md:-mx-10", className)}>
      <Marquesina palabras={MARQUESINA_A} duracion="36s" />
      <ol className="m-0 flex list-none flex-col px-[22px] pt-1.5 md:px-10">
        {BENEFICIOS.map((b) => (
          <li
            key={b.titulo}
            className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3.5 border-b border-tema-borde py-4"
          >
            <CajaIcono b={b} tam="md" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="m-0 font-heading text-2xl uppercase leading-none text-tema-texto" style={{ fontWeight: 400 }}>
                {b.titulo}
              </p>
              <p className="m-0 text-[13.5px] leading-[1.5] text-tema-texto-2">{b.texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
