"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import ProductCard from "@/components/ui/ProductCard";

interface RedesSociales {
  instagram?: string;
  spotify?: string;
  youtube?: string;
  tiktok?: string;
  facebook?: string;
  soundcloud?: string;
  [key: string]: string | undefined;
}

interface Artista {
  id: string;
  nombre: string;
  slug: string;
  ciudad?: string;
  region?: string;
  color_acento?: string;
  foto_url?: string;
  bio?: string;
  bio_completa?: string;
  redes_sociales?: RedesSociales;
  verificado?: boolean;
}

interface Producto {
  id: string;
  nombre: string;
  precio: number;
  imagenes: string[];
  tipo: string;
  artista_id: string;
  categorias?: { nombre: string; slug: string };
}

function buildSocialUrl(red: string, value: string): string {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  const cleaned = value.replace(/^@/, "");
  const bases: Record<string, string> = {
    instagram: "https://instagram.com/",
    tiktok: "https://tiktok.com/@",
  };
  return bases[red] ? bases[red] + cleaned : value;
}

export default function ArtistaClient({ slug }: { slug: string }) {
  const supabase = createClient();
  const [tabActivo, setTabActivo] = useState<"productos" | "sobre">("productos");

  const { data: artista, isLoading } = useQuery({
    queryKey: ["artista", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artistas")
        .select("*")
        .eq("slug", slug)
        .single();
      if (error) throw error;
      return data as Artista;
    },
    enabled: !!slug,
  });

  const { data: productos = [] } = useQuery({
    queryKey: ["artista-productos", artista?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("*, categorias(nombre)")
        .eq("artista_id", artista!.id)
        .eq("estado", "aprobado");
      if (error) throw error;
      return (data ?? []) as unknown as Producto[];
    },
    enabled: !!artista?.id,
  });

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f7f5" }}>
          <div className="animate-pulse" style={{ fontFamily: "Barlow, sans-serif", color: "#666" }}>
            Cargando artista...
          </div>
        </div>
      </>
    );
  }

  if (!artista) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <p style={{ fontFamily: "Oswald, sans-serif", fontSize: "24px", color: "#111111" }}>
            Artista no encontrado
          </p>
        </div>
      </>
    );
  }

  const acento  = artista.color_acento ?? "#e8003d";
  const inicial = artista.nombre?.[0]?.toUpperCase() ?? "A";

  return (
    <>
      <Header />

      <div style={{ height: "6px", backgroundColor: acento }} />

      <section className="py-12 px-6" style={{ backgroundColor: "#f8f7f5" }}>
        <div className="flex gap-8 items-start max-w-4xl mx-auto">
          <div className="shrink-0">
            {artista.foto_url ? (
              <img
                src={artista.foto_url}
                alt={artista.nombre}
                className="w-24 h-24 rounded-full object-cover"
                style={{ border: `4px solid ${acento}` }}
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold shrink-0"
                style={{ backgroundColor: acento, border: `4px solid ${acento}`, fontFamily: "Oswald, sans-serif" }}
              >
                {inicial}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 style={{ fontFamily: "Oswald, sans-serif", fontSize: "36px", fontWeight: "700", color: "#111111", lineHeight: 1.1 }}>
              {artista.nombre}
              {artista.verificado && (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  backgroundColor: "#e8003d",
                  color: "white",
                  fontSize: "10px",
                  fontFamily: "Barlow, sans-serif",
                  fontWeight: "700",
                  padding: "2px 8px",
                  borderRadius: "20px",
                  letterSpacing: "0.05em",
                  marginLeft: "8px",
                  verticalAlign: "middle",
                }}>
                  ✓ Verificado
                </span>
              )}
            </h1>

            {(artista.ciudad || artista.region) && (
              <span
                className="inline-block mt-2 border rounded px-2 py-0.5"
                style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", backgroundColor: "#ffffff", color: "#666666" }}
              >
                {[artista.ciudad, artista.region].filter(Boolean).join(" · ")}
              </span>
            )}

            {artista.bio && (
              <p
                className="mt-3 max-w-lg"
                style={{ fontFamily: "DM Sans, sans-serif", fontSize: "15px", color: "#666666", lineHeight: 1.6 }}
              >
                {artista.bio}
              </p>
            )}

            {artista.redes_sociales && (
              <div className="flex flex-wrap gap-2 mt-4">
                {Object.entries(artista.redes_sociales).map(([red, value]) =>
                  value ? (
                    <a
                      key={red}
                      href={buildSocialUrl(red, value)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs border rounded px-2 py-1 transition-colors capitalize"
                      style={{ fontFamily: "Barlow, sans-serif", color: "#666666", borderColor: "#e8e8e8" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
                    >
                      {red}
                    </a>
                  ) : null
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="border-b border-[#e8e8e8] px-6">
        <div className="max-w-4xl mx-auto flex gap-6">
          {(["productos", "sobre"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTabActivo(tab)}
              className="py-3 text-sm transition-colors"
              style={{
                fontFamily: "Barlow, sans-serif",
                fontWeight: tabActivo === tab ? 600 : 400,
                color: tabActivo === tab ? "#111111" : "#666666",
                borderBottom: tabActivo === tab ? `2px solid ${acento}` : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              {tab === "productos" ? `Productos (${productos.length})` : "Sobre el artista"}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {tabActivo === "productos" ? (
          productos.length === 0 ? (
            <div className="text-center py-20">
              <p style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", color: "#111111" }}>
                Sin productos disponibles
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6">
              {productos.map((p) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  nombre={p.nombre}
                  precio={p.precio}
                  imagenes={p.imagenes ?? []}
                  categoria={p.categorias?.nombre}
                  artista={artista.nombre}
                  ciudad={artista.ciudad}
                  slug_artista={artista.slug}
                  colorAccento={acento}
                  verificado={artista.verificado}
                />
              ))}
            </div>
          )
        ) : (
          <div className="p-6 max-w-2xl">
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "15px", color: "#444444", lineHeight: 1.7 }}>
              {artista.bio_completa ?? artista.bio ?? "Sin información adicional."}
            </p>
            {artista.ciudad && (
              <div className="mt-6">
                <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#999999" }}>Ciudad</p>
                <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "15px", color: "#111111", marginTop: "4px" }}>{artista.ciudad}</p>
              </div>
            )}
            {artista.region && (
              <div className="mt-4">
                <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#999999" }}>Región</p>
                <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "15px", color: "#111111", marginTop: "4px" }}>{artista.region}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
