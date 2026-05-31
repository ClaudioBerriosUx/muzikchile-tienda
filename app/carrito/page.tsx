"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import Link from "next/link";
import { Minus, Plus, X, ShoppingCart } from "lucide-react";
import Header from "@/components/layout/Header";
import { useCarrito } from "@/lib/stores/carrito";
import { formatCLP } from "@/lib/constants";

export default function CarritoPage() {
  const items            = useCarrito((s) => s.items);
  const remover          = useCarrito((s) => s.remover);
  const actualizarCantidad = useCarrito((s) => s.actualizarCantidad);
  const totalFn          = useCarrito((s) => s.total);

  // Evitar hydration mismatch (localStorage)
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  if (!montado) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-white" />
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6">
          <ShoppingCart size={48} className="text-[#cccccc]" />
          <h1 style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", fontWeight: "700", color: "#111111" }}>
            Tu carrito está vacío
          </h1>
          <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
            Agrega productos desde la tienda para comenzar.
          </p>
          <Link
            href="/"
            className="mt-2 px-8 py-3 rounded-md text-white font-semibold"
            style={{ fontFamily: "Barlow, sans-serif", backgroundColor: "#e8003d" }}
          >
            Ver tienda
          </Link>
        </main>
      </>
    );
  }

  const subtotal = totalFn();

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <h1 className="mb-8" style={{ fontFamily: "Oswald, sans-serif", fontSize: "32px", fontWeight: "700", color: "#111111" }}>
            Carrito
          </h1>

          <div className="grid grid-cols-3 gap-8">
            {/* Lista de items */}
            <div className="col-span-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 py-4 border-b border-[#e8e8e8]">
                  {/* Imagen */}
                  {item.imagen ? (
                    <img
                      src={item.imagen}
                      alt={item.nombre}
                      className="w-20 h-20 rounded-lg object-cover shrink-0 border border-[#e8e8e8]"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg shrink-0 bg-[#f8f7f5]" />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium truncate"
                      style={{ fontFamily: "Oswald, sans-serif", fontSize: "17px", color: "#111111" }}
                    >
                      {item.nombre}
                    </p>
                    {item.artista && (
                      <p className="text-sm mt-0.5" style={{ fontFamily: "Barlow, sans-serif", color: "#999999" }}>
                        {item.artista}
                      </p>
                    )}
                    <p className="font-bold mt-1" style={{ fontFamily: "DM Sans, sans-serif", color: "#e8003d", fontSize: "16px" }}>
                      {formatCLP(item.precio)}
                    </p>
                  </div>

                  {/* Selector cantidad */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => actualizarCantidad(item.id, item.cantidad - 1)}
                      className="w-8 h-8 rounded border border-[#e8e8e8] flex items-center justify-center hover:bg-[#f8f7f5] transition-colors"
                    >
                      <Minus size={13} />
                    </button>
                    <span
                      className="w-8 text-center"
                      style={{ fontFamily: "DM Sans, sans-serif", fontSize: "15px", color: "#111111" }}
                    >
                      {item.cantidad}
                    </span>
                    <button
                      onClick={() => actualizarCantidad(item.id, item.cantidad + 1)}
                      className="w-8 h-8 rounded border border-[#e8e8e8] flex items-center justify-center hover:bg-[#f8f7f5] transition-colors"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  {/* Subtotal item */}
                  <p
                    className="w-24 text-right shrink-0 font-semibold"
                    style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
                  >
                    {formatCLP(item.precio * item.cantidad)}
                  </p>

                  {/* Quitar */}
                  <button
                    onClick={() => remover(item.id)}
                    className="text-[#cccccc] hover:text-[#e8003d] transition-colors shrink-0 ml-1"
                    aria-label="Eliminar"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>

            {/* Resumen lateral */}
            <div>
              <div
                className="sticky top-20 rounded-xl border border-[#e8e8e8] p-6"
                style={{ backgroundColor: "#f8f7f5" }}
              >
                <h2 className="mb-5" style={{ fontFamily: "Oswald, sans-serif", fontSize: "18px", fontWeight: "600", color: "#111111" }}>
                  Resumen
                </h2>

                <div className="flex justify-between items-center mb-6">
                  <span style={{ fontFamily: "Barlow, sans-serif", color: "#444444" }}>
                    Subtotal ({items.reduce((a, i) => a + i.cantidad, 0)} productos)
                  </span>
                  <span style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: "18px", color: "#111111" }}>
                    {formatCLP(subtotal)}
                  </span>
                </div>

                <Link
                  href="/checkout"
                  className="flex items-center justify-center w-full h-11 rounded-md text-white font-semibold transition-colors"
                  style={{ fontFamily: "Barlow, sans-serif", backgroundColor: "#e8003d" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#c5002e")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#e8003d")}
                >
                  Ir al checkout →
                </Link>

                <Link
                  href="/"
                  className="flex items-center justify-center w-full h-11 rounded-md border mt-2 transition-colors"
                  style={{ fontFamily: "Barlow, sans-serif", borderColor: "#111111", color: "#111111" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8f7f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  Seguir comprando
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
