"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart, Minus, Plus, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCarrito } from "@/lib/stores/carrito";
import { formatCLP } from "@/lib/constants";

export default function CarritoDrawer() {
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
      {/* Trigger: ícono carrito + badge */}
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

      {/* Drawer */}
      <SheetContent
        side="right"
        className="w-[400px] sm:w-[450px] flex flex-col p-0"
      >
        {/* Header del drawer */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#e8e8e8] shrink-0">
          <SheetTitle
            style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", fontWeight: "700", color: "#111111" }}
          >
            Tu carrito
          </SheetTitle>
          {cantidad > 0 && (
            <span
              className="text-white text-xs font-bold rounded-full px-2 py-0.5"
              style={{ backgroundColor: "#e8003d", fontFamily: "Barlow, sans-serif" }}
            >
              {cantidad}
            </span>
          )}
        </div>

        {/* Contenido */}
        {!montado || items.length === 0 ? (
          /* Estado vacío */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <ShoppingCart size={48} className="text-[#cccccc]" />
            <p style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", fontWeight: "700", color: "#111111" }}>
              Tu carrito está vacío
            </p>
            <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#666666" }}>
              Agrega productos de tus artistas favoritos
            </p>
            <Link
              href="/"
              onClick={cerrar}
              className="mt-2 px-6 py-2.5 rounded-md text-white text-sm font-semibold"
              style={{ fontFamily: "Barlow, sans-serif", backgroundColor: "#e8003d" }}
            >
              Ver tienda
            </Link>
          </div>
        ) : (
          <>
            {/* Lista de items */}
            <div className="flex-1 overflow-y-auto px-6">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 py-3 border-b border-[#e8e8e8]">
                  {/* Imagen */}
                  {item.imagen ? (
                    <img
                      src={item.imagen}
                      alt={item.nombre}
                      className="w-16 h-16 rounded-lg object-cover shrink-0 border border-[#e8e8e8]"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg shrink-0 bg-[#f8f7f5]" />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium line-clamp-1"
                      style={{ fontFamily: "DM Sans, sans-serif", fontSize: "14px", color: "#111111" }}
                    >
                      {item.nombre}
                    </p>
                    {item.artista && (
                      <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#666666" }}>
                        {item.artista}
                      </p>
                    )}
                    <p className="font-bold mt-1" style={{ fontFamily: "DM Sans, sans-serif", color: "#e8003d", fontSize: "14px" }}>
                      {formatCLP(item.precio)}
                    </p>
                  </div>

                  {/* Cantidad + quitar */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => actualizarCantidad(item.id, item.cantidad - 1)}
                        className="w-6 h-6 rounded border border-[#e8e8e8] flex items-center justify-center hover:bg-[#f8f7f5] transition-colors"
                      >
                        <Minus size={10} />
                      </button>
                      <span
                        className="w-5 text-center"
                        style={{ fontFamily: "DM Sans, sans-serif", fontSize: "14px", color: "#111111" }}
                      >
                        {item.cantidad}
                      </span>
                      <button
                        onClick={() => actualizarCantidad(item.id, item.cantidad + 1)}
                        className="w-6 h-6 rounded border border-[#e8e8e8] flex items-center justify-center hover:bg-[#f8f7f5] transition-colors"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                    <button
                      onClick={() => remover(item.id)}
                      className="transition-colors"
                      style={{ color: "#cccccc" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#e8003d")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#cccccc")}
                      aria-label="Eliminar"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer sticky */}
            <div className="shrink-0 px-6 py-5 border-t border-[#e8e8e8]" style={{ backgroundColor: "#ffffff" }}>
              <div className="flex items-center justify-between mb-4">
                <span style={{ fontFamily: "Barlow, sans-serif", color: "#444444" }}>Subtotal</span>
                <span style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: "18px", color: "#e8003d" }}>
                  {formatCLP(total)}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <Link
                  href="/checkout"
                  onClick={cerrar}
                  className="flex items-center justify-center w-full h-11 rounded-md text-white font-semibold transition-colors"
                  style={{ fontFamily: "Barlow, sans-serif", backgroundColor: "#e8003d" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#c5002e")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#e8003d")}
                >
                  Ir al checkout →
                </Link>
                <Link
                  href="/carrito"
                  onClick={cerrar}
                  className="flex items-center justify-center w-full h-11 rounded-md border transition-colors"
                  style={{ fontFamily: "Barlow, sans-serif", borderColor: "#111111", color: "#111111" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8f7f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  Ver carrito completo
                </Link>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
