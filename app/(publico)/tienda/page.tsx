"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import TarjetaProducto from "@/components/tienda/TarjetaProducto";

interface Artista {
  id: string;
  nombre: string;
  slug: string;
  ciudad?: string;
  region?: string;
  color_acento?: string;
  verificado?: boolean;
}

interface Categoria {
  id: string;
  nombre: string;
  slug: string;
  /** Solo viene en la categoría embebida del producto (una subcategoría). */
  padre_id?: string | null;
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

// ── Piezas de UI ─────────────────────────────────────────────────────────────

const ETIQUETA = "text-[10px] font-bold uppercase tracking-[0.16em] text-tema-texto-3";
const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tema-azul-texto";
const CAMPO =
  "h-11 w-full rounded-[10px] border border-tema-borde-campo bg-tema-fondo text-tema-texto outline-none transition-[border-color,box-shadow] focus:border-tema-azul-texto focus:shadow-[0_0_0_3px_rgba(44,86,127,0.6)]";

function Selector({
  etiqueta, valor, opciones, onChange,
}: {
  etiqueta: string;
  valor: string;
  opciones: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-[5px] md:w-44">
      <span className={ETIQUETA}>{etiqueta}</span>
      <span className="relative block">
        <select
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className={cn(CAMPO, "cursor-pointer appearance-none pl-3.5 pr-9 text-sm")}
        >
          {opciones.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown size={14} strokeWidth={3} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-tema-texto-2" />
      </span>
    </label>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-tema-borde bg-tema-campo">
          <div className="aspect-square animate-pulse bg-tema-hover" />
          <div className="flex flex-col gap-2 p-3">
            <div className="h-4 animate-pulse rounded bg-tema-hover" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-tema-hover" />
            <div className="mt-1 h-6 w-1/2 animate-pulse rounded bg-tema-hover" />
          </div>
        </div>
      ))}
    </div>
  );
}

function HomePageContent() {
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
  // Solo UI: en móvil los selectores se pliegan detrás del botón "Filtros".
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const { data: productos = [], isLoading } = useQuery({
    queryKey: ["productos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select(`
          id, nombre, precio, imagenes, tipo, stock,
          artista_id, categoria_id,
          artistas (id, nombre, slug, ciudad, region, color_acento, verificado),
          categorias (id, nombre, slug, padre_id)
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
      router.replace("/tienda", { scroll: false });
    } else {
      router.replace(`/tienda?categoria=${valor}`, { scroll: false });
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
      // Los chips son categorías padre (Merch, Música física…), pero cada
      // producto cuelga de una subcategoría (Poleras, Cassettes…). Un chip
      // padre incluye todas sus hijas; un slug de subcategoría en
      // ?categoria= sigue filtrando solo esa.
      const padreId = categorias.find((c) => c.slug === categoriaActiva)?.id;
      lista = lista.filter(
        (p) =>
          p.categorias?.slug === categoriaActiva ||
          (padreId !== undefined && p.categorias?.padre_id === padreId)
      );
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
  }, [productos, categorias, categoriaActiva, tipoActivo, regionActiva, busqueda, ordenActivo]);

  // Contador del botón "Filtros" (móvil) y visibilidad de "Limpiar filtros".
  const nFiltros =
    Number(categoriaActiva !== "todas") +
    Number(regionActiva !== "todas") +
    Number(tipoActivo !== "todos") +
    Number(ordenActivo !== "recientes") +
    Number(busqueda.trim() !== "");

  const limpiarFiltros = () => {
    setRegionActiva("todas");
    setTipoActivo("todos");
    setOrdenActivo("recientes");
    setBusqueda("");
    if (categoriaActiva !== "todas") handleCategoriaChange("todas");
  };

  const n = productosFiltrados.length;

  return (
    <main className="min-h-screen bg-tema-fondo text-tema-texto">
      <div className="mx-auto max-w-[1280px] px-5 md:px-10">
        {/* Migas */}
        <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-[9px] pb-1 pt-(--aire-bajo-header) text-[13px] text-tema-texto-3 md:pt-[calc(var(--aire-bajo-header)+4px)]">
          <Link href="/" className="text-tema-texto-3 hover:text-tema-texto-claro">Inicio</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-tema-texto-claro">Tienda</span>
        </nav>

        {/* Cabecera */}
        <header className="flex flex-col gap-3 pb-6 pt-3.5 md:pb-8 md:pt-6">
          <div className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.22em] text-tema-texto-3">
            <span className="h-0.5 w-6 bg-tema-rojo" aria-hidden="true" />
            Tienda oficial de la escena
          </div>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <h1
              className="m-0 max-w-[820px] text-[40px] uppercase leading-[0.98] text-tema-texto md:text-[64px]"
              style={{ fontFamily: "var(--font-titulo)", textWrap: "balance" }}
            >
              Llévate la escena a casa
            </h1>
            <p className="m-0 pb-1.5 text-sm text-tema-texto-3">
              {isLoading ? (
                "Cargando productos…"
              ) : (
                <>
                  <strong className="font-bold text-tema-texto">
                    {productos.length} {productos.length === 1 ? "producto" : "productos"}
                  </strong>{" "}
                  de artistas independientes chilenos
                </>
              )}
            </p>
          </div>
          <p className="m-0 max-w-[620px] text-base leading-[1.65] text-tema-texto-2" style={{ textWrap: "pretty" }}>
            Casetes, vinilos, poleras y música digital, directo de quienes los hacen. Cada compra va para el artista.
          </p>
        </header>

        <div className="flex flex-col gap-[18px] pb-12 md:pb-20">
          {/* Barra de filtros */}
          <div className="flex flex-col gap-3.5 rounded-xl border border-tema-borde bg-tema-campo p-3.5 md:px-[18px] md:py-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-0 flex-[1_1_150px] flex-col gap-[5px] md:flex-[1_1_260px]">
                <span className={ETIQUETA}>Buscar</span>
                <span className="relative block">
                  <Search size={17} strokeWidth={1.9} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tema-texto-3" />
                  <input
                    type="search"
                    placeholder="Artista o producto"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className={cn(CAMPO, "pl-[42px] pr-3.5 text-[15px] placeholder:text-tema-texto-3")}
                  />
                </span>
              </label>

              <button
                type="button"
                onClick={() => setFiltrosAbiertos((v) => !v)}
                aria-expanded={filtrosAbiertos}
                aria-controls="filtros-tienda"
                className={cn(
                  "flex h-11 cursor-pointer items-center gap-2 rounded-[10px] border px-3.5 text-sm font-medium text-tema-texto md:hidden",
                  filtrosAbiertos ? "border-tema-azul-texto bg-tema-hover" : "border-tema-borde-campo bg-transparent",
                  FOCO
                )}
              >
                <SlidersHorizontal size={16} strokeWidth={1.9} aria-hidden="true" />
                Filtros
                {nFiltros > 0 && (
                  <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-tema-rojo px-[5px] text-[10px] font-bold">
                    {nFiltros}
                  </span>
                )}
              </button>

              <div
                id="filtros-tienda"
                className={cn(
                  "w-full grid-cols-1 items-end gap-3 md:contents",
                  filtrosAbiertos ? "grid" : "hidden"
                )}
              >
                <Selector etiqueta="Región" valor={regionActiva} opciones={opcionesRegiones} onChange={setRegionActiva} />

                <div role="group" aria-label="Formato" className="flex flex-col gap-[5px]">
                  <span className={ETIQUETA} aria-hidden="true">Formato</span>
                  <div className="flex h-11 gap-0.5 rounded-[10px] border border-tema-borde-campo bg-tema-fondo p-[3px]">
                    {OPCIONES_TIPO.map((op) => {
                      const activo = op.value === tipoActivo;
                      return (
                        <button
                          key={op.value}
                          type="button"
                          onClick={() => setTipoActivo(op.value)}
                          aria-pressed={activo}
                          className={cn(
                            "flex-1 cursor-pointer rounded-[7px] border-0 px-3.5 text-sm font-medium",
                            activo ? "bg-tema-azul text-tema-texto" : "bg-transparent text-tema-texto-claro hover:text-tema-texto",
                            FOCO
                          )}
                        >
                          {op.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Selector etiqueta="Ordenar" valor={ordenActivo} opciones={OPCIONES_ORDEN} onChange={setOrdenActivo} />
              </div>
            </div>

            {/* Chips de categoría: en móvil una fila con scroll horizontal */}
            <div
              role="group"
              aria-label="Categoría"
              className="-mx-3.5 flex items-center gap-2 overflow-x-auto px-3.5 pb-0.5 md:mx-0 md:flex-wrap md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {opcionesCategorias.map((op) => {
                const activo = op.value === categoriaActiva;
                return (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => handleCategoriaChange(op.value)}
                    aria-pressed={activo}
                    className={cn(
                      "h-[38px] shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors",
                      activo
                        ? "border-tema-azul bg-tema-azul text-tema-texto"
                        : "border-tema-borde-campo bg-transparent text-tema-texto-claro hover:border-tema-azul-texto",
                      FOCO
                    )}
                  >
                    {op.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conteo + limpiar */}
          <div className="flex items-center justify-between gap-3">
            <p className="m-0 text-sm text-tema-texto-2" aria-live="polite">
              {isLoading ? "" : `${n} ${n === 1 ? "producto" : "productos"}`}
            </p>
            {nFiltros > 0 && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className={cn("cursor-pointer border-0 bg-transparent p-0 text-sm font-medium text-tema-azul-texto hover:text-tema-azul-texto-hover", FOCO)}
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Grid */}
          {isLoading ? (
            <Skeleton />
          ) : n === 0 ? (
            <div className="flex flex-col items-center gap-3.5 rounded-xl border border-dashed border-tema-borde-campo bg-[#1B1B1B] px-5 py-10 text-center md:px-6 md:py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-tema-borde-campo text-tema-texto-2">
                <Search size={28} strokeWidth={1.6} aria-hidden="true" />
              </div>
              <h2
                className="m-0 text-[28px] uppercase leading-[1.05] text-tema-texto md:text-[34px]"
                style={{ fontFamily: "var(--font-titulo)" }}
              >
                No encontramos nada con eso
              </h2>
              <p className="m-0 max-w-[440px] text-base leading-[1.65] text-tema-texto-2" style={{ textWrap: "pretty" }}>
                Prueba con otra palabra o quita algunos filtros.
              </p>
              {nFiltros > 0 && (
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className={cn("flex h-12 cursor-pointer items-center rounded-[10px] border-0 bg-tema-rojo px-[22px] text-[15px] font-bold text-tema-texto hover:brightness-110", FOCO)}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
              {productosFiltrados.map((p) => (
                <TarjetaProducto
                  key={p.id}
                  id={p.id}
                  nombre={p.nombre}
                  precio={p.precio}
                  imagen={p.imagenes?.[0]}
                  tipo={p.tipo}
                  categoria={p.categorias?.nombre}
                  categoriaSlug={p.categorias?.slug}
                  artista={p.artistas?.nombre ?? ""}
                  ciudad={p.artistas?.ciudad}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-tema-fondo" />}>
      <HomePageContent />
    </Suspense>
  );
}
