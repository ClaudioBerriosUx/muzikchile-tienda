"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useCarrito } from "@/lib/stores/carrito";
import { formatCLP } from "@/lib/constants";
import PlaceholderProducto, { tipoVisual } from "./PlaceholderProducto";

interface Props {
  id: string;
  nombre: string;
  precio: number;
  imagen?: string;
  tipo?: string;
  categoria?: string;
  categoriaSlug?: string;
  artista: string;
  ciudad?: string;
}

/** Badge de categoría sobre la foto (azul tenue). */
export function BadgeCategoria({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-md border border-tema-azul bg-tema-azul-fondo/95 px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.12em] text-tema-azul-etiqueta">
      {children}
    </span>
  );
}

/** Badge "Digital" con flecha de descarga. */
export function BadgeDigital() {
  return (
    <span className="flex items-center gap-[5px] rounded-md bg-tema-azul px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-tema-texto">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 4v11" />
        <polyline points="7 11 12 16 17 11" />
        <line x1="5" y1="20" x2="19" y2="20" />
      </svg>
      Digital
    </span>
  );
}

/**
 * Tarjeta de producto del rediseño (variación A de "Tienda Pantalla"): foto 1:1,
 * nombre en Anton, artista · ciudad, precio y botón "+" para agregar.
 *
 * El enlace cubre la tarjeta con un pseudo-elemento y el botón "+" queda por
 * encima (z-10): así no hay un <button> anidado dentro de un <a>.
 */
export default function TarjetaProducto({
  id, nombre, precio, imagen, tipo, categoria, categoriaSlug, artista, ciudad,
}: Props) {
  const agregar = useCarrito((s) => s.agregar);
  const visual = tipoVisual(tipo, categoriaSlug);

  const handleAgregar = () => {
    agregar({ id, nombre, precio, imagen: imagen || "", artista });
    toast.success("Agregado al carrito");
  };

  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-tema-borde bg-tema-campo transition-[transform,border-color] duration-200 hover:border-tema-borde-campo motion-safe:hover:-translate-y-1 focus-within:border-tema-borde-campo">
      <div className="relative aspect-square bg-tema-fondo">
        {imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagen} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <PlaceholderProducto tipo={visual} rotulo={categoria ?? (visual === "digital" ? "Digital" : "Producto")} />
        )}
        {categoria && (
          <div className="pointer-events-none absolute left-2.5 top-2.5">
            <BadgeCategoria>{categoria}</BadgeCategoria>
          </div>
        )}
        {tipo === "digital" && (
          <div className="pointer-events-none absolute right-2.5 top-2.5">
            <BadgeDigital />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-[5px] px-3 pb-3.5 pt-3 md:px-4 md:pb-4 md:pt-3.5">
        <h3
          className="m-0 text-[17px] uppercase leading-[1.06] text-tema-texto md:text-[21px]"
          style={{ fontFamily: "var(--font-titulo)", textWrap: "balance" }}
        >
          <Link
            href={`/producto/${id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-tema-azul-texto"
          >
            {nombre}
          </Link>
        </h3>
        <p className="m-0 text-[13px] leading-[1.45] text-tema-texto-3">
          {artista}{ciudad ? ` · ${ciudad}` : ""}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2.5 pt-2.5">
          <span
            className="text-[22px] leading-none text-tema-precio md:text-[26px]"
            style={{ fontFamily: "var(--font-titulo)" }}
          >
            {formatCLP(precio)}
          </span>
          <button
            type="button"
            onClick={handleAgregar}
            aria-label={`Agregar ${nombre} al carrito`}
            className="relative z-10 flex h-[38px] w-[38px] shrink-0 cursor-pointer items-center justify-center rounded-[10px] bg-tema-rojo text-tema-texto transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tema-azul-texto"
          >
            <Plus size={17} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
