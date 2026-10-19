"use client";

import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import PlaceholderProducto from "./PlaceholderProducto";

/**
 * Piezas visuales compartidas por el drawer del carrito, /carrito y /checkout.
 * Solo UI: reciben callbacks; la lógica sigue en `useCarrito`.
 */

export const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tema-azul-texto";

/** Miniatura cuadrada de un item. El carrito no guarda `tipo`: sin foto va un ícono neutro. */
export function MiniaturaItem({ imagen, size = 72 }: { imagen?: string; size?: number }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[10px] border border-tema-borde bg-tema-superficie"
      style={{ width: size, height: size }}
    >
      {imagen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imagen} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <PlaceholderProducto chico icono={<ShoppingBag size={15} strokeWidth={1.6} aria-hidden="true" />} />
      )}
    </div>
  );
}

/** − cantidad +. Bajar de 1 quita el item, igual que `actualizarCantidad(id, 0)`. */
export function Stepper({
  cantidad, onMenos, onMas, nombre,
}: { cantidad: number; onMenos: () => void; onMas: () => void; nombre: string }) {
  const btn = cn("flex h-full w-[34px] cursor-pointer items-center justify-center border-0 bg-transparent text-tema-texto hover:bg-tema-hover", FOCO);
  return (
    <div role="group" aria-label={`Cantidad de ${nombre}`} className="flex h-9 items-center overflow-hidden rounded-[9px] border border-tema-borde-campo">
      <button type="button" onClick={onMenos} aria-label={`Quitar una unidad de ${nombre}`} className={btn}>
        <Minus size={14} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <span className="min-w-6 text-center text-sm font-bold tabular-nums">{cantidad}</span>
      <button type="button" onClick={onMas} aria-label={`Agregar una unidad de ${nombre}`} className={btn}>
        <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  );
}

export function BotonQuitar({ onClick, nombre, className }: { onClick: () => void; nombre: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Quitar ${nombre} del carrito`}
      className={cn("flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-tema-texto-3 hover:text-tema-precio", FOCO, className)}
    >
      <Trash2 size={16} strokeWidth={1.9} aria-hidden="true" />
    </button>
  );
}

/** Precio de línea / total en Anton. */
export function Monto({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("leading-none", className)} style={{ fontFamily: "var(--font-titulo)" }}>
      {children}
    </span>
  );
}
