"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { useCarrito } from "@/lib/stores/carrito";
import { formatCLP } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { BotonQuitar, FOCO, MiniaturaItem, Monto, Stepper } from "@/components/tienda/carrito-ui";

const TITULO = { fontFamily: "var(--font-titulo)" } as const;

export default function CarritoPage() {
  const items            = useCarrito((s) => s.items);
  const remover          = useCarrito((s) => s.remover);
  const actualizarCantidad = useCarrito((s) => s.actualizarCantidad);
  const totalFn          = useCarrito((s) => s.total);

  // Evitar hydration mismatch (localStorage)
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  if (!montado) {
    return <main className="min-h-screen bg-tema-fondo" />;
  }

  if (items.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3.5 bg-tema-fondo px-6 text-center text-tema-texto">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-tema-borde-campo text-tema-texto-2">
          <ShoppingBag size={28} strokeWidth={1.6} aria-hidden="true" />
        </div>
        <h1 className="m-0 text-[34px] uppercase leading-[1.05] md:text-[44px]" style={TITULO}>
          Tu carrito está vacío
        </h1>
        <p className="m-0 text-base text-tema-texto-2">Agrega productos desde la tienda para comenzar.</p>
        <Link
          href="/tienda"
          className={cn("mt-1 flex h-12 items-center rounded-[10px] bg-tema-rojo px-[22px] text-[15px] font-bold text-tema-texto no-underline hover:brightness-110", FOCO)}
        >
          Ver tienda
        </Link>
      </main>
    );
  }

  const subtotal = totalFn();
  const nProductos = items.reduce((a, i) => a + i.cantidad, 0);

  return (
    <main className="min-h-screen bg-tema-fondo text-tema-texto">
      <div className="mx-auto max-w-[1280px] px-5 md:px-10">
        <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-[9px] pb-1 pt-4 text-[13px] text-tema-texto-3 md:pt-5">
          <Link href="/tienda" className="text-tema-texto-3 hover:text-tema-texto-claro">Tienda</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-tema-texto-claro">Carrito</span>
        </nav>

        <h1 className="m-0 pb-[22px] pt-3 text-[40px] uppercase leading-none md:text-[64px]" style={TITULO}>
          Tu carrito
        </h1>

        <div className="grid grid-cols-1 items-start gap-3 pb-12 md:gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:pb-20">
          {/* Lista de items */}
          <section aria-label="Productos en el carrito" className="rounded-xl border border-tema-borde bg-tema-campo px-[18px] md:px-6">
            <ul className="m-0 list-none p-0">
              {items.map((item, i) => (
                <li
                  key={item.id}
                  className={cn(
                    "grid grid-cols-[72px_minmax(0,1fr)] gap-3.5 py-4 sm:grid-cols-[80px_minmax(0,1fr)_auto] sm:items-center",
                    i < items.length - 1 && "border-b border-tema-borde"
                  )}
                >
                  <MiniaturaItem imagen={item.imagen} size={72} />
                  <div className="min-w-0">
                    <p className="m-0 text-base font-bold leading-[1.35] text-tema-texto">{item.nombre}</p>
                    <p className="m-0 mt-0.5 text-[13px] text-tema-texto-3">
                      {item.artista ? `${item.artista} · ` : ""}{formatCLP(item.precio)} c/u
                    </p>
                  </div>
                  <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:justify-end">
                    <Stepper
                      nombre={item.nombre}
                      cantidad={item.cantidad}
                      onMenos={() => actualizarCantidad(item.id, item.cantidad - 1)}
                      onMas={() => actualizarCantidad(item.id, item.cantidad + 1)}
                    />
                    <Monto className="min-w-[96px] text-right text-[22px] text-tema-precio">{formatCLP(item.precio * item.cantidad)}</Monto>
                    <BotonQuitar nombre={item.nombre} onClick={() => remover(item.id)} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Resumen lateral */}
          <aside aria-label="Resumen" className="lg:sticky lg:top-6">
            <div className="flex flex-col gap-4 rounded-xl border border-tema-borde bg-tema-campo p-[18px] md:p-6">
              <h2 className="m-0 text-[26px] uppercase leading-none" style={TITULO}>Resumen</h2>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] text-tema-texto-claro">Subtotal ({nProductos} {nProductos === 1 ? "producto" : "productos"})</span>
                <Monto className="text-[32px] text-tema-texto">{formatCLP(subtotal)}</Monto>
              </div>
              <p className="m-0 text-[13px] leading-normal text-tema-texto-3">Los cupones se aplican en el checkout.</p>
              <Link
                href="/checkout"
                className={cn("flex h-[52px] items-center justify-center gap-2.5 rounded-[10px] bg-tema-rojo px-6 text-base font-bold text-tema-texto no-underline hover:brightness-110", FOCO)}
              >
                Ir al checkout
                <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
              </Link>
              <Link
                href="/tienda"
                className={cn("flex h-12 items-center justify-center rounded-[10px] border border-tema-borde-campo text-sm font-medium text-tema-texto no-underline hover:border-tema-azul-texto", FOCO)}
              >
                Seguir comprando
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
