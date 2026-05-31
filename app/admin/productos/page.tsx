"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Music, CheckCircle, XCircle, Package } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatCLP } from "@/lib/constants";
import StatusBadge from "@/components/ui/StatusBadge";

interface Artista { nombre: string; slug: string }
interface Categoria { nombre: string }

interface Producto {
  id: string;
  nombre: string;
  precio: number;
  imagenes: string[];
  tipo: string;
  estado: string;
  descripcion?: string;
  zonas_envio?: string[];
  artista_id: string;
  artistas: Artista | Artista[] | null;
  categorias: Categoria | Categoria[] | null;
}

function nombreArtista(a: Artista | Artista[] | null): string {
  if (!a) return "—";
  return Array.isArray(a) ? (a[0]?.nombre ?? "—") : a.nombre;
}
function nombreCategoria(c: Categoria | Categoria[] | null): string {
  if (!c) return "—";
  return Array.isArray(c) ? (c[0]?.nombre ?? "—") : c.nombre;
}

export default function ModerarProductosPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"pendientes" | "todos">("pendientes");
  const [seleccionado, setSeleccionado] = useState<Producto | null>(null);
  const [imagenIdx, setImagenIdx] = useState(0);
  const [mostrarRechazo, setMostrarRechazo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);

  const { data: productos = [] } = useQuery<Producto[]>({
    queryKey: ["admin-productos", tab],
    queryFn: async () => {
      let q = supabase
        .from("productos")
        .select("id, nombre, precio, imagenes, tipo, estado, descripcion, zonas_envio, artista_id, artistas(nombre, slug), categorias(nombre)")
        .order("created_at", { ascending: true });
      if (tab === "pendientes") q = q.eq("estado", "en_revision");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Producto[];
    },
  });

  useEffect(() => {
    setSeleccionado(null);
    setImagenIdx(0);
    setMostrarRechazo(false);
    setMotivo("");
  }, [tab]);

  useEffect(() => {
    setImagenIdx(0);
    setMostrarRechazo(false);
    setMotivo("");
  }, [seleccionado?.id]);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-productos"] });
    queryClient.invalidateQueries({ queryKey: ["admin-count-revision"] });
  };

  const aprobar = async () => {
    if (!seleccionado) return;
    setProcesando(true);
    const { error } = await supabase
      .from("productos")
      .update({ estado: "aprobado" })
      .eq("id", seleccionado.id);
    if (error) { toast.error("Error al aprobar"); }
    else { toast.success("Producto aprobado"); invalidar(); setSeleccionado(null); }
    setProcesando(false);
  };

  const rechazar = async () => {
    if (!seleccionado || !motivo.trim()) {
      toast.error("Escribe el motivo del rechazo");
      return;
    }
    setProcesando(true);
    const { error } = await supabase
      .from("productos")
      .update({ estado: "rechazado", motivo_rechazo: motivo.trim() })
      .eq("id", seleccionado.id);
    if (error) { toast.error("Error al rechazar"); }
    else { toast.success("Producto rechazado"); invalidar(); setSeleccionado(null); }
    setProcesando(false);
  };

  const pendientesCount = productos.filter((p) => p.estado === "en_revision").length;

  return (
    <div className="-m-8 flex" style={{ height: "calc(100vh - 64px)" }}>
      {/* Panel izquierdo */}
      <div className="flex flex-col border-r border-[#e8e8e8] overflow-hidden" style={{ width: "40%" }}>
        {/* Tabs */}
        <div className="flex border-b border-[#e8e8e8] shrink-0">
          {([["pendientes", `Pendientes (${pendientesCount})`], ["todos", "Todos"]] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-3 text-sm transition-colors"
              style={{
                fontFamily: "Barlow, sans-serif",
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? "#111111" : "#666666",
                borderBottom: tab === t ? "2px solid #e8003d" : "2px solid transparent",
                backgroundColor: "#ffffff",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "#f8f7f5" }}>
          {productos.length === 0 ? (
            <div className="p-8 text-center">
              <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Sin productos en esta vista</p>
            </div>
          ) : (
            productos.map((p) => {
              const activo = seleccionado?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSeleccionado(p)}
                  className="w-full flex items-center gap-3 p-3 text-left transition-colors border-b border-[#e8e8e8]"
                  style={{
                    borderLeft: activo ? "3px solid #e8003d" : "3px solid transparent",
                    backgroundColor: activo ? "#ffffff" : "transparent",
                    paddingLeft: activo ? "9px" : "12px",
                  }}
                >
                  <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-[#e8e8e8]">
                    {p.imagenes?.[0] ? (
                      <img src={p.imagenes[0]} alt={p.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#f0f0f0" }}>
                        <Music size={16} className="text-[#ccc]" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ fontFamily: "Oswald, sans-serif", color: "#111111" }}>
                      {p.nombre}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
                      {nombreArtista(p.artistas)}
                    </p>
                    <div className="mt-1"><StatusBadge estado={p.estado} /></div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Panel derecho */}
      <div className="flex-1 overflow-y-auto p-6">
        {!seleccionado ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Package size={40} className="mx-auto mb-3 text-[#cccccc]" />
              <p style={{ fontFamily: "Oswald, sans-serif", fontSize: "18px", color: "#999999" }}>
                Selecciona un producto
              </p>
            </div>
          </div>
        ) : (
          <div>
            {/* Carrusel imágenes */}
            {seleccionado.imagenes?.length > 0 && (
              <div className="mb-6">
                <div className="aspect-video rounded-lg overflow-hidden border border-[#e8e8e8] mb-3">
                  <img
                    src={seleccionado.imagenes[imagenIdx]}
                    alt={seleccionado.nombre}
                    className="w-full h-full object-contain bg-[#f8f7f5]"
                  />
                </div>
                {seleccionado.imagenes.length > 1 && (
                  <div className="flex gap-2">
                    {seleccionado.imagenes.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setImagenIdx(i)}
                        className="w-14 h-14 rounded overflow-hidden border-2 shrink-0"
                        style={{ borderColor: i === imagenIdx ? "#e8003d" : "#e8e8e8" }}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Info producto */}
            <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: "24px", fontWeight: "700", color: "#111111" }}>
              {seleccionado.nombre}
            </h2>

            <div className="grid grid-cols-2 gap-3 mt-4">
              {[
                ["Artista", nombreArtista(seleccionado.artistas)],
                ["Categoría", nombreCategoria(seleccionado.categorias)],
                ["Precio", formatCLP(seleccionado.precio)],
                ["Tipo", seleccionado.tipo === "digital" ? "Digital" : "Físico"],
              ].map(([label, valor]) => (
                <div key={label}>
                  <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#999999", textTransform: "uppercase" }}>{label}</p>
                  <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "15px", color: "#111111", marginTop: "2px" }}>{valor}</p>
                </div>
              ))}
            </div>

            {seleccionado.zonas_envio && seleccionado.zonas_envio.length > 0 && (
              <div className="mt-4">
                <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#999999", textTransform: "uppercase" }}>Zonas de envío</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {seleccionado.zonas_envio.map((z) => (
                    <span key={z} className="text-xs px-2 py-0.5 rounded border" style={{ fontFamily: "Barlow, sans-serif", backgroundColor: "#f8f7f5", color: "#666666" }}>
                      {z}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {seleccionado.descripcion && (
              <div className="mt-4">
                <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#999999", textTransform: "uppercase" }}>Descripción</p>
                <p className="mt-1" style={{ fontFamily: "DM Sans, sans-serif", fontSize: "14px", color: "#444444", lineHeight: 1.6 }}>
                  {seleccionado.descripcion}
                </p>
              </div>
            )}

            {/* Acciones */}
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={aprobar}
                disabled={procesando}
                className="w-full h-11 rounded-md text-white font-semibold flex items-center justify-center gap-2 transition-colors"
                style={{ fontFamily: "Barlow, sans-serif", backgroundColor: procesando ? "#86efac" : "#22c55e" }}
              >
                <CheckCircle size={16} /> Aprobar producto
              </button>

              {!mostrarRechazo ? (
                <button
                  onClick={() => setMostrarRechazo(true)}
                  className="w-full h-11 rounded-md font-semibold flex items-center justify-center gap-2 border transition-colors"
                  style={{ fontFamily: "Barlow, sans-serif", backgroundColor: "#ffffff", borderColor: "#e8003d", color: "#e8003d" }}
                >
                  <XCircle size={16} /> Rechazar producto
                </button>
              ) : (
                <div className="border border-[#e8e8e8] rounded-lg p-4">
                  <p className="mb-2 text-sm" style={{ fontFamily: "Barlow, sans-serif", color: "#444444" }}>
                    Motivo del rechazo:
                  </p>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={3}
                    placeholder="Explica al artista por qué su producto no fue aprobado..."
                    className="w-full rounded-md px-3 py-2 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none resize-none"
                    style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => { setMostrarRechazo(false); setMotivo(""); }}
                      className="flex-1 h-9 rounded border text-sm"
                      style={{ fontFamily: "Barlow, sans-serif", borderColor: "#e8e8e8", color: "#666666" }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={rechazar}
                      disabled={procesando || !motivo.trim()}
                      className="flex-1 h-9 rounded text-white text-sm"
                      style={{ fontFamily: "Barlow, sans-serif", backgroundColor: !motivo.trim() || procesando ? "#f0a0b0" : "#e8003d" }}
                    >
                      Enviar rechazo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
