"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import ProductCard from "@/components/ui/ProductCard";
import { useCarrito } from "@/lib/stores/carrito";
import { formatCLP } from "@/lib/constants";

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

function StockIndicator({ stock }: { stock: number }) {
  if (stock === 0) {
    return <span style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#e8003d" }}>● Sin stock</span>;
  }
  if (stock <= 5) {
    return <span style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#f59e0b" }}>● Últimas {stock} unidades</span>;
  }
  return <span style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#22c55e" }}>● {stock} disponibles</span>;
}

export default function ProductoClient({ id }: { id: string }) {
  const supabase = createClient();
  const agregar  = useCarrito((s) => s.agregar);

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
      <>
        <Header />
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="aspect-square rounded-lg animate-pulse" style={{ backgroundColor: "#f0f0f0" }} />
          <div className="flex flex-col gap-4">
            {[80, 48, 120, 32, 200, 48].map((h, i) => (
              <div key={i} className="rounded animate-pulse" style={{ height: h, backgroundColor: "#f0f0f0" }} />
            ))}
          </div>
        </div>
      </>
    );
  }

  if (!producto) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <p style={{ fontFamily: "Oswald, sans-serif", fontSize: "24px", color: "#111111" }}>
            Producto no encontrado
          </p>
        </div>
      </>
    );
  }

  const artista    = producto.artistas;
  const categoria  = producto.categorias;
  const acento     = artista?.color_acento ?? "#e8003d";
  const imagenes   = producto.imagenes ?? [];
  const imagenActiva = imagenes[imagenIdx] ?? null;
  const sinStock   = producto.stock === 0;

  const handleAgregar = () => {
    agregar({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      imagen: imagenActiva ?? undefined,
      artista: artista?.nombre,
    });
  };

  return (
    <>
      <Header />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Imágenes */}
          <div>
            <div className="aspect-square overflow-hidden rounded-lg border border-[#e8e8e8]">
              {imagenActiva ? (
                <img src={imagenActiva} alt={producto.nombre} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#f8f7f5" }}>
                  <span style={{ fontFamily: "Barlow, sans-serif", color: "#cccccc" }}>Sin imagen</span>
                </div>
              )}
            </div>

            {imagenes.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto">
                {imagenes.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setImagenIdx(i)}
                    className="shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-colors"
                    style={{ borderColor: i === imagenIdx ? acento : "#e8e8e8" }}
                  >
                    <img src={img} alt={`${producto.nombre} ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <div className="flex items-center gap-1 text-sm" style={{ fontFamily: "Barlow, sans-serif", color: "#999999" }}>
              <Link href="/" className="hover:text-[#e8003d] transition-colors">Tienda</Link>
              {categoria && (
                <>
                  <span>/</span>
                  <Link href={`/?categoria=${categoria.slug}`} className="hover:text-[#e8003d] transition-colors">
                    {categoria.nombre}
                  </Link>
                </>
              )}
              <span>/</span>
              <span className="text-[#111111]">{producto.nombre}</span>
            </div>

            {categoria && (
              <span
                className="inline-block mt-3 text-white text-xs px-2 py-0.5 rounded"
                style={{ backgroundColor: "#111111", fontFamily: "Barlow, sans-serif" }}
              >
                {categoria.nombre}
              </span>
            )}

            <h1 className="mt-2" style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", fontWeight: "700", color: "#111111", lineHeight: 1.2 }}>
              {producto.nombre}
            </h1>

            {artista && (
              <Link href={`/artista/${artista.slug}`} className="flex items-center gap-2 mt-3 group w-fit">
                {artista.foto_url ? (
                  <img src={artista.foto_url} alt={artista.nombre} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: acento, fontFamily: "Oswald, sans-serif" }}
                  >
                    {artista.nombre?.[0]?.toUpperCase()}
                  </div>
                )}
                <span
                  className="text-sm transition-colors group-hover:text-[#e8003d]"
                  style={{ fontFamily: "DM Sans, sans-serif", color: "#666666" }}
                >
                  por {artista.nombre}{artista.ciudad ? ` · ${artista.ciudad}` : ""}
                </span>
              </Link>
            )}

            <p className="mt-4" style={{ fontFamily: "DM Sans, sans-serif", fontWeight: "700", fontSize: "30px", color: "#e8003d" }}>
              {formatCLP(producto.precio)}
            </p>

            <div className="border-t border-[#e8e8e8] my-4" />

            {producto.descripcion && (
              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "15px", color: "#666666", lineHeight: 1.7 }}>
                {producto.descripcion}
              </p>
            )}

            <div className="mt-4">
              <StockIndicator stock={producto.stock} />
            </div>

            {producto.tipo === "digital" && (
              <span
                className="inline-block mt-3 text-sm px-3 py-1 rounded"
                style={{ backgroundColor: "#dcfce7", color: "#166534", fontFamily: "Barlow, sans-serif" }}
              >
                Descarga digital
              </span>
            )}

            {producto.tipo === "fisico" && producto.zonas_envio && producto.zonas_envio.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {producto.zonas_envio.map((zona) => (
                  <span
                    key={zona}
                    className="text-xs border rounded px-2 py-0.5"
                    style={{ fontFamily: "Barlow, sans-serif", backgroundColor: "#f8f7f5", borderColor: "#e8e8e8", color: "#666666" }}
                  >
                    {zona}
                  </span>
                ))}
              </div>
            )}

            {producto.tipo === "fisico" && !sinStock && (
              <div className="flex items-center gap-3 mt-5">
                <span style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#666666" }}>Cantidad:</span>
                <div className="flex items-center border border-[#e8e8e8] rounded overflow-hidden">
                  <button
                    onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                    className="px-3 py-1.5 text-[#111111] hover:bg-[#f8f7f5] transition-colors"
                    style={{ fontFamily: "Barlow, sans-serif" }}
                  >
                    −
                  </button>
                  <span className="px-4 py-1.5 border-x border-[#e8e8e8] min-w-[40px] text-center" style={{ fontFamily: "Barlow, sans-serif", color: "#111111" }}>
                    {cantidad}
                  </span>
                  <button
                    onClick={() => setCantidad((c) => Math.min(producto.stock, c + 1))}
                    className="px-3 py-1.5 text-[#111111] hover:bg-[#f8f7f5] transition-colors"
                    style={{ fontFamily: "Barlow, sans-serif" }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleAgregar}
              disabled={sinStock}
              className="w-full h-12 rounded-md mt-6 font-semibold transition-colors"
              style={{
                fontFamily: "Barlow, sans-serif",
                backgroundColor: sinStock ? "#d1d5db" : "#e8003d",
                color: sinStock ? "#9ca3af" : "#ffffff",
                cursor: sinStock ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => { if (!sinStock) e.currentTarget.style.backgroundColor = "#c5002e"; }}
              onMouseLeave={(e) => { if (!sinStock) e.currentTarget.style.backgroundColor = "#e8003d"; }}
            >
              {sinStock ? "Sin stock" : "Agregar al carrito"}
            </button>

            {artista && (
              <Link
                href={`/artista/${artista.slug}`}
                className="flex items-center justify-center w-full h-12 rounded-md mt-3 border border-[#111111] transition-colors"
                style={{ fontFamily: "Barlow, sans-serif", color: "#111111", backgroundColor: "#ffffff" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8f7f5")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
              >
                Ver tienda de {artista.nombre}
              </Link>
            )}
          </div>
        </div>

        {relacionados.length > 0 && artista && (
          <section className="mt-12">
            <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: "22px", fontWeight: "700", color: "#111111", marginBottom: "24px" }}>
              Más de {artista.nombre}
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {relacionados.map((r) => (
                <div key={r.id} className="shrink-0 w-52">
                  <ProductCard
                    id={r.id}
                    nombre={r.nombre}
                    precio={r.precio}
                    imagenes={r.imagenes ?? []}
                    categoria={Array.isArray(r.categorias) ? r.categorias[0]?.nombre : r.categorias?.nombre}
                    artista={artista.nombre}
                    ciudad={artista.ciudad}
                    slug_artista={artista.slug}
                    colorAccento={acento}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
