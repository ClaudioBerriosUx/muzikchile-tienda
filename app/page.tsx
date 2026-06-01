"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import FilterChips from "@/components/ui/FilterChips";
import ProductCard from "@/components/ui/ProductCard";

interface Artista {
  id: string;
  nombre: string;
  slug: string;
  ciudad?: string;
  region?: string;
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
  tipo: string;
  stock: number;
  artista_id: string;
  categoria_id: string;
  artistas: Artista;
  categorias: Categoria;
}

const OPCIONES_TIPO = [
  { label: "Todos", value: "todos" },
  { label: "Físico", value: "fisico" },
  { label: "Digital", value: "digital" },
];

const OPCIONES_ORDEN = [
  { label: "Recientes", value: "recientes" },
  { label: "Menor precio", value: "precio_asc" },
  { label: "Mayor precio", value: "precio_desc" },
];

export default function HomePage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [categoriaActiva, setCategoriaActiva] = useState(
    searchParams.get("categoria") ?? "todas"
  );
  const [regionActiva, setRegionActiva] = useState("todas");
  const [tipoActivo, setTipoActivo] = useState("todos");
  const [ordenActivo, setOrdenActivo] = useState("recientes");
  const [busqueda, setBusqueda] = useState("");

  const { data: productos = [], isLoading } = useQuery({
    queryKey: ["productos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select(`
          id, nombre, precio, imagenes, tipo, stock,
          artista_id, categoria_id,
          artistas (id, nombre, slug, ciudad, region, color_acento),
          categorias (id, nombre, slug)
        `)
        .eq("estado", "aprobado")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Producto[];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias")
        .select("id, nombre, slug")
        .is("padre_id", null)
        .order("orden");
      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
  });

  const opcionesCategorias = useMemo(() => [
    { label: "Todas", value: "todas" },
    ...categorias.map((c) => ({ label: c.nombre, value: c.slug })),
  ], [categorias]);

  const handleCategoriaChange = (valor: string) => {
    setCategoriaActiva(valor);
    if (valor === "todas") {
      router.replace("/", { scroll: false });
    } else {
      router.replace(`/?categoria=${valor}`, { scroll: false });
    }
  };

  const opcionesRegiones = useMemo(() => {
    const regiones = Array.from(
      new Set(productos.map((p) => p.artistas?.region).filter(Boolean))
    ) as string[];
    return [
      { label: "Todo Chile", value: "todas" },
      ...regiones.map((r) => ({ label: r, value: r })),
    ];
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    let lista = [...productos];
    if (categoriaActiva !== "todas") {
      lista = lista.filter((p) => p.categorias?.slug === categoriaActiva);
    }
    if (tipoActivo !== "todos") {
      lista = lista.filter((p) => p.tipo === tipoActivo);
    }
    if (regionActiva !== "todas") {
      lista = lista.filter((p) => p.artistas?.region === regionActiva);
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.artistas?.nombre?.toLowerCase().includes(q)
      );
    }
    if (ordenActivo === "precio_asc") lista.sort((a, b) => a.precio - b.precio);
    if (ordenActivo === "precio_desc") lista.sort((a, b) => b.precio - a.precio);
    return lista;
  }, [productos, categoriaActiva, tipoActivo, regionActiva, busqueda, ordenActivo]);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        {/* Hero */}
        <section className="py-16 text-center" style={{ backgroundColor: "#f8f7f5" }}>
          <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#e8003d", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "12px" }}>
            Marketplace de Música Chilena
          </p>
          <h1 style={{ fontFamily: "Oswald, sans-serif", fontSize: "48px", fontWeight: "700", color: "#111111", lineHeight: 1.1, marginBottom: "12px" }}>
            El merch de tus artistas favoritos
          </h1>
          <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "16px", color: "#666666" }}>
            {isLoading ? "Cargando productos..." : `${productos.length} productos de artistas chilenos`}
          </p>
        </section>

        {/* Filtros sticky */}
        <div className="sticky top-16 z-40 bg-white border-b border-[#e8e8e8] px-6 py-3 flex flex-col gap-2">
          <FilterChips
            opciones={opcionesCategorias}
            valor={categoriaActiva}
            onChange={handleCategoriaChange}
          />
          <div className="flex gap-3 flex-wrap items-center">
            <FilterChips opciones={opcionesRegiones} valor={regionActiva} onChange={setRegionActiva} />
            <FilterChips opciones={OPCIONES_TIPO} valor={tipoActivo} onChange={setTipoActivo} />
            <FilterChips opciones={OPCIONES_ORDEN} valor={ordenActivo} onChange={setOrdenActivo} />
            <input
              type="search"
              placeholder="Buscar artista o producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="px-3 py-1.5 text-sm rounded border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none transition-colors ml-auto"
              style={{ fontFamily: "Barlow, sans-serif", minWidth: "200px" }}
            />
          </div>
        </div>

        {/* Grid de productos */}
        <div className="px-6 py-8">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-lg overflow-hidden border border-[#e8e8e8]">
                  <div className="aspect-square animate-pulse" style={{ backgroundColor: "#f0f0f0" }} />
                  <div className="p-3 flex flex-col gap-2">
                    <div className="h-4 rounded animate-pulse" style={{ backgroundColor: "#f0f0f0" }} />
                    <div className="h-3 rounded w-2/3 animate-pulse" style={{ backgroundColor: "#f0f0f0" }} />
                    <div className="h-5 rounded w-1/2 mt-1 animate-pulse" style={{ backgroundColor: "#f0f0f0" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="text-center py-20">
              <p style={{ fontFamily: "Oswald, sans-serif", fontSize: "24px", color: "#111111" }}>
                Sin resultados
              </p>
              <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666", marginTop: "8px" }}>
                Prueba con otros filtros o términos de búsqueda
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {productosFiltrados.map((p) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  nombre={p.nombre}
                  precio={p.precio}
                  imagenes={p.imagenes ?? []}
                  categoria={p.categorias?.nombre}
                  artista={p.artistas?.nombre ?? ""}
                  ciudad={p.artistas?.ciudad}
                  slug_artista={p.artistas?.slug ?? ""}
                  colorAccento={p.artistas?.color_acento}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
