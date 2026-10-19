import { cn } from "@/lib/utils";

/**
 * Qué ícono lleva un producto sin foto. En la base `productos.tipo` solo vale
 * `fisico` | `digital`; "merch" vs "música física" sale de la subcategoría
 * (los productos cuelgan de Poleras, Cassettes, EPs…, no de la categoría padre).
 */
export type TipoVisual = "fisica" | "merch" | "digital";

const SLUGS_MUSICA_FISICA = ["musica-fisica", "vinilos", "cassettes", "cds"];

export function tipoVisual(tipo: string | null | undefined, categoriaSlug?: string | null): TipoVisual {
  if (tipo === "digital") return "digital";
  if (categoriaSlug && SLUGS_MUSICA_FISICA.includes(categoriaSlug)) return "fisica";
  return "merch";
}

export function IconoTipo({ tipo, size = 28 }: { tipo: TipoVisual; size?: number }) {
  const props = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (tipo === "fisica") {
    return (
      <svg {...props}>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="8.5" cy="12" r="1.9" />
        <circle cx="15.5" cy="12" r="1.9" />
        <line x1="8.5" y1="16" x2="15.5" y2="16" />
      </svg>
    );
  }
  if (tipo === "digital") {
    return (
      <svg {...props}>
        <line x1="4" y1="10" x2="4" y2="14" />
        <line x1="8" y1="7" x2="8" y2="17" />
        <line x1="12" y1="4" x2="12" y2="20" />
        <line x1="16" y1="8" x2="16" y2="16" />
        <line x1="20" y1="10" x2="20" y2="14" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M8 4l-5 3 2 4 2-1v10h10V10l2 1 2-4-5-3a4 4 0 0 1-8 0z" />
    </svg>
  );
}

/**
 * Relleno para productos sin foto: rayado tenue + ícono del tipo en un círculo.
 * Ocupa todo su contenedor (que debe ser `relative`). Con `rotulo` muestra la
 * etiqueta "Merch · foto pronto" abajo; en miniaturas (carrito) va sin rótulo.
 */
export default function PlaceholderProducto({
  tipo,
  icono,
  rotulo,
  chico = false,
  className,
}: {
  tipo?: TipoVisual;
  /** Reemplaza el ícono por tipo (el carrito no guarda `tipo`). */
  icono?: React.ReactNode;
  rotulo?: string;
  chico?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("absolute inset-0 flex items-center justify-center", className)}
      style={{
        background:
          "repeating-linear-gradient(135deg, rgba(237,237,237,0.025) 0 10px, rgba(237,237,237,0) 10px 22px), linear-gradient(150deg, #282828, #1A1A1A)",
      }}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full border border-tema-borde-campo text-tema-texto-2",
          chico ? "h-8 w-8" : "h-16 w-16"
        )}
        style={{ backgroundColor: "rgba(22,22,22,0.5)" }}
      >
        {icono ?? <IconoTipo tipo={tipo ?? "merch"} size={chico ? 16 : 28} />}
      </div>
      {rotulo && (
        <span className="absolute bottom-[11px] left-3 text-[10px] font-bold uppercase tracking-[0.14em] text-tema-texto-3">
          {rotulo} · foto pronto
        </span>
      )}
    </div>
  );
}
