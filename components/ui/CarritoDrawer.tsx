"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShoppingCart, ShoppingBag, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCarrito } from "@/lib/stores/carrito";
import { formatCLP } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { BotonQuitar, FOCO, MiniaturaItem, Monto, Stepper } from "@/components/tienda/carrito-ui";

/**
 * `variante` cambia solo el botón que abre el drawer:
 *   - "clasica": ícono suelto en blanco (HeaderPanel de /panel y /admin).
 *   - "capsula": botón 42×42 (44 en móvil) del header público, con bolsa y
 *     badge rojo.
 */
export default function CarritoDrawer({
  variante = "clasica",
}: {
  variante?: "clasica" | "capsula";
}) {
  const [open, setOpen] = useState(false);
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const items            = useCarrito((s) => s.items);
  const cantidadTotal    = useCarrito((s) => s.cantidadTotal);
  const actualizarCantidad = useCarrito((s) => s.actualizarCantidad);
  const remover          = useCarrito((s) => s.remover);
  const totalFn          = useCarrito((s) => s.total);

  const cantidad = montado ? cantidadTotal() : 0;
  const total    = montado ? totalFn()       : 0;

  const cerrar = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {variante === "capsula" ? (
        <SheetTrigger
          className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent text-tema-texto transition-colors duration-150 hover:bg-tema-activo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tema-foco lg:h-[42px] lg:w-[42px]"
          aria-label={cantidad > 0 ? `Abrir carrito (${cantidad} ${cantidad === 1 ? "producto" : "productos"})` : "Abrir carrito"}
        >
          <ShoppingBag size={17} strokeWidth={2} aria-hidden="true" />
          {cantidad > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-px top-[3px] flex h-[15px] min-w-[15px] items-center justify-center rounded-lg border-2 border-tema-campo bg-tema-rojo px-1 text-[9px] font-bold leading-none text-tema-texto"
            >
              {cantidad > 99 ? "99+" : cantidad}
            </span>
          )}
        </SheetTrigger>
      ) : (
      <SheetTrigger
        className="relative text-white bg-transparent border-0 p-0 cursor-pointer"
        aria-label="Abrir carrito"
      >
        <ShoppingCart className="w-5 h-5" />
        {montado && cantidad > 0 && (
          <span
            className="absolute -top-2 -right-2 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
            style={{ backgroundColor: "#e8003d" }}
          >
            {cantidad > 99 ? "99+" : cantidad}
          </span>
        )}
      </SheetTrigger>
      )}

      {/* Drawer */}
      <SheetContent
        side="right"
        showCloseButton={false}
        overlayClassName="bg-[rgba(14,14,14,0.74)]"
        className="gap-0 border-tema-borde bg-tema-superficie p-0 text-tema-texto data-[side=right]:w-full data-[side=right]:sm:max-w-[440px]"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {/* Cabecera */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-tema-borde px-[22px] py-5">
          <div className="flex items-baseline gap-2.5">
            <SheetTitle className="m-0 text-[30px] font-normal uppercase leading-none text-tema-texto" style={{ fontFamily: "var(--font-titulo)" }}>
              Tu carrito
            </SheetTitle>
            {cantidad > 0 && (
              <span className="text-sm text-tema-texto-3">
                {cantidad} {cantidad === 1 ? "producto" : "productos"}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar carrito"
            className={cn("flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-tema-borde-campo bg-transparent text-tema-texto hover:border-tema-azul-texto", FOCO)}
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {!montado || items.length === 0 ? (
          /* Estado vacío */
          <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-tema-borde-campo text-tema-texto-2">
              <ShoppingBag size={28} strokeWidth={1.6} aria-hidden="true" />
            </div>
            <p className="m-0 text-[28px] uppercase leading-[1.05] text-tema-texto" style={{ fontFamily: "var(--font-titulo)" }}>
              Tu carrito está vacío
            </p>
            <p className="m-0 text-[15px] text-tema-texto-2">Agrega productos de tus artistas favoritos.</p>
            <Link
              href="/tienda"
              onClick={cerrar}
              className={cn("mt-1 flex h-12 items-center rounded-[10px] bg-tema-rojo px-[22px] text-[15px] font-bold text-tema-texto no-underline hover:brightness-110", FOCO)}
            >
              Ver tienda
            </Link>
          </div>
        ) : (
          <>
            {/* Lista de items */}
            <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto px-[22px] py-1.5">
              {items.map((item) => (
                <li key={item.id} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3.5 border-b border-tema-borde py-4">
                  <MiniaturaItem imagen={item.imagen} />
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex justify-between gap-2.5">
                      <p className="m-0 text-[15px] font-bold leading-[1.35] text-tema-texto">{item.nombre}</p>
                      <BotonQuitar nombre={item.nombre} onClick={() => remover(item.id)} className="-mr-1.5 -mt-1" />
                    </div>
                    {item.artista && <p className="m-0 text-[13px] text-tema-texto-3">{item.artista}</p>}
                    <div className="flex items-center justify-between gap-2.5 pt-2">
                      <Stepper
                        nombre={item.nombre}
                        cantidad={item.cantidad}
                        onMenos={() => actualizarCantidad(item.id, item.cantidad - 1)}
                        onMas={() => actualizarCantidad(item.id, item.cantidad + 1)}
                      />
                      <Monto className="text-[22px] text-tema-precio">{formatCLP(item.precio * item.cantidad)}</Monto>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Pie fijo */}
            <div className="flex shrink-0 flex-col gap-3.5 border-t border-tema-borde bg-tema-campo px-[22px] pb-[22px] pt-[18px]">
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] text-tema-texto-claro">Subtotal</span>
                <Monto className="text-[32px] text-tema-texto">{formatCLP(total)}</Monto>
              </div>
              <p className="m-0 text-[13px] leading-normal text-tema-texto-3">Los cupones se aplican en el checkout.</p>
              <Link
                href="/checkout"
                onClick={cerrar}
                className={cn("flex h-[52px] items-center justify-center gap-2.5 rounded-[10px] bg-tema-rojo px-6 text-base font-bold text-tema-texto no-underline hover:brightness-110", FOCO)}
              >
                Ir al checkout
                <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
              </Link>
              <div className="flex items-center justify-center gap-5 text-sm font-medium">
                <Link href="/carrito" onClick={cerrar} className={cn("text-tema-azul-texto hover:text-tema-azul-texto-hover", FOCO)}>
                  Ver carrito completo
                </Link>
                <button type="button" onClick={cerrar} className={cn("cursor-pointer border-0 bg-transparent p-0 text-tema-azul-texto hover:text-tema-azul-texto-hover", FOCO)}>
                  Seguir mirando
                </button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
