"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, Download, MapPin, Minus, Plus, ShoppingBag, Truck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import TarjetaProducto, { BadgeCategoria, BadgeDigital } from "@/components/tienda/TarjetaProducto";
import PlaceholderProducto, { tipoVisual } from "@/components/tienda/PlaceholderProducto";
import { useCarrito } from "@/lib/stores/carrito";
import { formatCLP } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface Artista {
  id: string;
  nombre: string;
  slug: string;
  ciudad?: string;
  foto_url?: string;
  color_acento?: string;
}

interface Categoria {
  id: string;
  nombre: string;
  slug: string;
}

interface Producto {
  id: string;
  nombre: string;
  precio: number;
  imagenes: string[];
  tipo: "fisico" | "digital";
  descripcion?: string;
  stock: number;
  zonas_envio?: string[];
  artista_id: string;
  artistas: Artista;
  categorias: Categoria;
}

interface ProductoRelacionado {
  id: string;
  nombre: string;
  precio: number;
  imagenes: string[];
  categorias?: { nombre: string } | { nombre: string }[] | null;
}

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tema-azul-texto";
const TITULO = { fontFamily: "var(--font-titulo)" } as const;

/**
 * Etiqueta visible de una zona de despacho. El panel guarda la etiqueta ("Latinoamérica");
 * los productos de seed tienen slugs ("latam"). Lo desconocido se muestra tal cual.
 */
const ETIQUETA_ZONA: Record<string, string> = {
  chile: "Chile", latam: "Latinoamérica", eeuu: "EE.UU.", europa: "Europa", mundial: "Mundial",
};

/**
 * Stock visible. Los digitales usan 999 como sentinel de "ilimitado" (ver
 * PROGRESS, 2026-07-25), así que para ellos no se muestra un número.
 */
function Stock({ stock, digital }: { stock: number; digital: boolean }) {
  const [texto, color] =
    stock === 0
      ? ["Agotado", "bg-tema-rojo"]
      : digital
        ? ["Disponible al instante", "bg-tema-ok"]
        : stock <= 5
          ? [stock === 1 ? "Última unidad" : `Últimas ${stock} unidades`, "bg-tema-aviso"]
          : [`${stock} disponibles`, "bg-tema-ok"];
  return (
    <span className="flex items-center gap-[9px] text-sm font-medium text-tema-texto">
      <span className={cn("h-[9px] w-[9px] rounded-full", color)} aria-hidden="true" />
      {texto}
    </span>
  );
}

export default function ProductoClient({ id }: { id: string }) {
  const supabase = createClient();
  const agregar  = useCarrito((s) => s.agregar);
  const actualizarCantidad = useCarrito((s) => s.actualizarCantidad);

  const [imagenIdx, setImagenIdx] = useState(0);
  const [cantidad,  setCantidad]  = useState(1);

  const { data: producto, isLoading } = useQuery({
    queryKey: ["producto", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("*, artistas(id, nombre, slug, ciudad, foto_url, color_acento), categorias(id, nombre, slug)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Producto;
    },
    enabled: !!id,
  });

  const { data: relacionados = [] } = useQuery({
    queryKey: ["relacionados", producto?.artista_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("id, nombre, precio, imagenes, categorias(nombre)")
        .eq("artista_id", producto!.artista_id)
        .eq("estado", "aprobado")
        .neq("id", id)
        .limit(4);
      if (error) throw error;
      return (data ?? []) as ProductoRelacionado[];
    },
    enabled: !!producto?.artista_id,
  });

  if (isLoading) {
    return (
      <main className="min-h-screen bg-tema-fondo">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 px-5 py-10 md:grid-cols-2 md:gap-14 md:px-10">
          <div className="aspect-square animate-pulse rounded-xl bg-tema-superficie" />
          <div className="flex flex-col gap-4">
            {[80, 48, 72, 120, 52, 80].map((h, i) => (
              <div key={i} className="animate-pulse rounded bg-tema-superficie" style={{ height: h }} />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!producto) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-tema-fondo">
        <p className="text-2xl text-tema-texto">Producto no encontrado</p>
      </main>
    );
  }

  const artista    = producto.artistas;
  const categoria  = producto.categorias;
  const imagenes   = producto.imagenes ?? [];
  const imagenActiva = imagenes[imagenIdx] ?? null;
  const sinStock   = producto.stock === 0;
  const digital    = producto.tipo === "digital";
  const zonas      = producto.zonas_envio ?? [];

  /**
   * `agregar()` del store siempre suma 1. Para respetar la cantidad elegida se
   * agrega y luego se fija el total con `actualizarCantidad()`, sin tocar el
   * store. Si ya estaba en el carrito, se suma a lo que había, con tope en el stock.
   */
  const handleAgregar = () => {
    const previa = useCarrito.getState().items.find((i) => i.id === producto.id)?.cantidad ?? 0;
    agregar({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      imagen: imagenActiva ?? undefined,
      artista: artista?.nombre,
    });
    if (cantidad > 1) {
      actualizarCantidad(producto.id, Math.min(previa + cantidad, producto.stock));
    }
    toast.success(cantidad > 1 ? `${cantidad} agregados al carrito` : "Agregado al carrito");
  };

  return (
    <main className="min-h-screen bg-tema-fondo text-tema-texto">
      <div className="mx-auto max-w-[1280px] px-5 md:px-10">
        {/* Migas */}
        <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-[9px] pb-1 pt-4 text-[13px] text-tema-texto-3 md:pt-5">
          <Link href="/tienda" className="text-tema-texto-3 hover:text-tema-texto-claro">Tienda</Link>
          {categoria && (
            <>
              <span aria-hidden="true">/</span>
              <Link href={`/tienda?categoria=${categoria.slug}`} className="text-tema-texto-3 hover:text-tema-texto-claro">
                {categoria.nombre}
              </Link>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="min-w-0 truncate text-tema-texto-claro">{producto.nombre}</span>
        </nav>

        <div className="grid grid-cols-1 items-start gap-6 pb-12 pt-3 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:gap-14 md:pb-20 md:pt-4">
          {/* Galería */}
          <div className="flex min-w-0 flex-col gap-3">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-tema-borde bg-tema-superficie">
              {imagenActiva ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagenActiva} alt={producto.nombre} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <PlaceholderProducto tipo={tipoVisual(producto.tipo, categoria?.slug)} rotulo={categoria?.nombre ?? "Producto"} />
              )}
              <div className="pointer-events-none absolute left-3.5 top-3.5 flex gap-2">
                {categoria && <BadgeCategoria>{categoria.nombre}</BadgeCategoria>}
                {digital && <BadgeDigital />}
              </div>
            </div>

            {imagenes.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {imagenes.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setImagenIdx(i)}
                    aria-label={`Ver imagen ${i + 1}`}
                    aria-pressed={i === imagenIdx}
                    className={cn(
                      "relative aspect-square cursor-pointer overflow-hidden rounded-[10px] bg-tema-superficie p-0",
                      i === imagenIdx ? "border-2 border-tema-azul-texto" : "border border-tema-borde hover:border-tema-borde-campo",
                      FOCO
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex min-w-0 flex-col gap-5">
            <h1
              className="m-0 text-[38px] uppercase leading-[0.98] text-tema-texto md:text-[56px]"
              style={{ ...TITULO, textWrap: "balance" }}
            >
              {producto.nombre}
            </h1>

            {artista && (
              <Link href={`/artista/${artista.slug}`} className="group flex items-center gap-3 self-start text-inherit no-underline">
                <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-full border border-tema-borde-campo bg-tema-superficie">
                  {artista.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={artista.foto_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span
                      className="flex h-full w-full items-center justify-center text-base font-bold text-tema-texto"
                      style={{ backgroundColor: artista.color_acento ?? "var(--tema-rojo)" }}
                    >
                      {artista.nombre?.[0]?.toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-base font-bold text-tema-texto group-hover:text-tema-azul-texto-hover">{artista.nombre}</span>
                  {artista.ciudad && (
                    <span className="flex items-center gap-[5px] text-[13px] text-tema-texto-3">
                      <MapPin size={12} strokeWidth={2} aria-hidden="true" />
                      {artista.ciudad}
                    </span>
                  )}
                </span>
              </Link>
            )}

            <div className="flex flex-wrap items-end justify-between gap-4 border-y border-tema-borde py-[18px]">
              <span className="text-[44px] leading-none text-tema-precio md:text-[56px]" style={TITULO}>
                {formatCLP(producto.precio)}
              </span>
              <Stock stock={producto.stock} digital={digital} />
            </div>

            {producto.descripcion && (
              <p className="m-0 whitespace-pre-line text-base leading-[1.7] text-tema-texto-2" style={{ textWrap: "pretty" }}>
                {producto.descripcion}
              </p>
            )}

            <div className="flex flex-wrap items-stretch gap-3">
              {!digital && !sinStock && (
                <div role="group" aria-label="Cantidad" className="flex h-[52px] items-center rounded-[10px] border border-tema-borde-campo bg-tema-campo">
                  <button
                    type="button"
                    onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                    disabled={cantidad <= 1}
                    aria-label="Menos"
                    className={cn("flex h-full w-[46px] cursor-pointer items-center justify-center border-0 bg-transparent text-tema-texto disabled:cursor-not-allowed disabled:opacity-40", FOCO)}
                  >
                    <Minus size={16} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                  <span className="min-w-[34px] text-center text-base font-bold tabular-nums" aria-live="polite">{cantidad}</span>
                  <button
                    type="button"
                    onClick={() => setCantidad((c) => Math.min(producto.stock, c + 1))}
                    disabled={cantidad >= producto.stock}
                    aria-label="Más"
                    className={cn("flex h-full w-[46px] cursor-pointer items-center justify-center border-0 bg-transparent text-tema-texto disabled:cursor-not-allowed disabled:opacity-40", FOCO)}
                  >
                    <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={handleAgregar}
                disabled={sinStock}
                className={cn(
                  "flex h-[52px] flex-[1_1_220px] items-center justify-center gap-2.5 rounded-[10px] border-0 text-base font-bold",
                  sinStock
                    ? "cursor-not-allowed bg-tema-borde text-tema-texto-3"
                    : "cursor-pointer bg-tema-rojo text-tema-texto hover:brightness-110",
                  FOCO
                )}
              >
                <ShoppingBag size={18} strokeWidth={2.1} aria-hidden="true" />
                {sinStock ? "Agotado" : "Agregar al carrito"}
              </button>
            </div>

            {(digital || zonas.length > 0) && (
              <div className="flex items-start gap-3.5 rounded-xl border border-tema-borde bg-tema-campo px-[18px] py-4">
                <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border border-tema-azul bg-tema-azul-fondo text-tema-azul-etiqueta">
                  {digital
                    ? <Download size={18} strokeWidth={1.9} aria-hidden="true" />
                    : <Truck size={18} strokeWidth={1.9} aria-hidden="true" />}
                </div>
                <div className="flex min-w-0 flex-col gap-[3px]">
                  <p className="m-0 text-[15px] font-bold text-tema-texto">
                    {digital ? "Entrega digital" : "Zonas de despacho"}
                  </p>
                  <p className="m-0 text-sm leading-[1.6] text-tema-texto-2">
                    {digital ? "Producto digital: no requiere despacho." : zonas.map((z) => ETIQUETA_ZONA[z.toLowerCase()] ?? z).join(" · ")}
                  </p>
                </div>
              </div>
            )}

            {artista && (
              <Link
                href={`/artista/${artista.slug}`}
                className={cn(
                  "flex h-12 items-center justify-center gap-2.5 self-start rounded-[10px] border border-tema-borde-campo px-5 text-sm font-medium text-tema-texto no-underline hover:border-tema-azul-texto",
                  FOCO
                )}
              >
                Ver tienda de {artista.nombre}
                <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>

        {relacionados.length > 0 && artista && (
          <section className="pb-12 md:pb-20">
            <div className="mb-5 flex items-center gap-3.5">
              <span className="h-[30px] w-1 rounded-sm bg-tema-rojo" aria-hidden="true" />
              <h2 className="m-0 text-[28px] uppercase leading-none tracking-[0.01em] text-tema-texto md:text-[34px]" style={TITULO}>
                Más de este artista
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
              {relacionados.map((r) => (
                <TarjetaProducto
                  key={r.id}
                  id={r.id}
                  nombre={r.nombre}
                  precio={r.precio}
                  imagen={r.imagenes?.[0]}
                  categoria={Array.isArray(r.categorias) ? r.categorias[0]?.nombre : r.categorias?.nombre}
                  artista={artista.nombre}
                  ciudad={artista.ciudad}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
