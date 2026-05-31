"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatCLP } from "@/lib/constants";

interface Orden {
  id: string;
  nombre_comprador?: string;
  email_comprador?: string;
  precio_unitario: number;
  cantidad: number;
  monto_artista: number;
  comision_monto: number;
  estado: string;
  mp_preference_id?: string;
  external_reference?: string;
  created_at: string;
  direccion_envio?: string;
  ciudad_envio?: string;
  region_envio?: string;
  artista_id?: string;
  producto_id?: string;
  artistas: { nombre: string } | { nombre: string }[] | null;
  productos: { nombre: string } | { nombre: string }[] | null;
}

const ESTADOS = ["todos", "pendiente", "pagado", "enviado", "entregado"];

const BADGE_ESTADO: Record<string, { bg: string; text: string }> = {
  pendiente:  { bg: "#fef9c3", text: "#854d0e" },
  pagado:     { bg: "#dbeafe", text: "#1e40af" },
  enviado:    { bg: "#fed7aa", text: "#9a3412" },
  entregado:  { bg: "#dcfce7", text: "#166534" },
};

function nombre(v: { nombre: string } | { nombre: string }[] | null) {
  if (!v) return "—";
  return Array.isArray(v) ? (v[0]?.nombre ?? "—") : v.nombre;
}

export default function OrdenesPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [estadoFiltro,  setEstadoFiltro]  = useState("todos");
  const [busqueda,      setBusqueda]      = useState("");
  const [seleccionada,  setSeleccionada]  = useState<Orden | null>(null);
  const [nuevoEstado,   setNuevoEstado]   = useState("");
  const [actualizando,  setActualizando]  = useState(false);

  const { data: ordenes = [] } = useQuery<Orden[]>({
    queryKey: ["admin-ordenes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordenes")
        .select("*, artistas(nombre), productos(nombre)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Orden[];
    },
  });

  const filtradas = useMemo(() => {
    let lista = ordenes;
    if (estadoFiltro !== "todos") lista = lista.filter((o) => o.estado === estadoFiltro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(
        (o) =>
          o.nombre_comprador?.toLowerCase().includes(q) ||
          nombre(o.artistas).toLowerCase().includes(q)
      );
    }
    return lista;
  }, [ordenes, estadoFiltro, busqueda]);

  const cambiarEstado = async () => {
    if (!seleccionada || !nuevoEstado) return;
    setActualizando(true);
    const { error } = await supabase
      .from("ordenes")
      .update({ estado: nuevoEstado })
      .eq("id", seleccionada.id);
    if (error) { toast.error("Error al actualizar"); }
    else {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["admin-ordenes"] });
      setSeleccionada((prev) => prev ? { ...prev, estado: nuevoEstado } : null);
    }
    setActualizando(false);
  };

  const inputClass = "rounded-md px-3 py-2 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none transition-colors";

  return (
    <div className="-m-8 flex" style={{ height: "calc(100vh - 64px)" }}>
      {/* Tabla */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filtros */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e8e8e8] shrink-0 bg-white flex-wrap">
          <h1 style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", fontWeight: "700", color: "#111111" }}>
            Órdenes
          </h1>
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className={inputClass}
            style={{ fontFamily: "Barlow, sans-serif" }}
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e} style={{ textTransform: "capitalize" }}>
                {e.charAt(0).toUpperCase() + e.slice(1)}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="Buscar comprador o artista..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className={`${inputClass} w-56`}
            style={{ fontFamily: "Barlow, sans-serif" }}
          />
          <span className="ml-auto text-sm" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
            {filtradas.length} órdenes
          </span>
        </div>

        {/* Tabla scroll */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: "#f8f7f5", position: "sticky", top: 0 }}>
              <tr>
                {["ID", "Comprador", "Artista", "Producto", "Monto", "Comisión", "Estado", "Fecha"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs uppercase tracking-wide"
                    style={{ fontFamily: "Barlow, sans-serif", color: "#666666", fontWeight: 600 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((o, i) => {
                const badge = BADGE_ESTADO[o.estado] ?? { bg: "#f3f4f6", text: "#374151" };
                const activa = seleccionada?.id === o.id;
                return (
                  <tr
                    key={o.id}
                    onClick={() => { setSeleccionada(o); setNuevoEstado(o.estado); }}
                    className="cursor-pointer transition-colors"
                    style={{
                      borderTop: i > 0 ? "1px solid #f0f0f0" : undefined,
                      backgroundColor: activa ? "#f8f7f5" : undefined,
                    }}
                    onMouseEnter={(e) => { if (!activa) e.currentTarget.style.backgroundColor = "#fafafa"; }}
                    onMouseLeave={(e) => { if (!activa) e.currentTarget.style.backgroundColor = ""; }}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[#999]">
                      {o.external_reference?.slice(0, 8).toUpperCase() ?? o.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3" style={{ fontFamily: "Barlow, sans-serif", color: "#111111" }}>
                      {o.nombre_comprador ?? "—"}
                    </td>
                    <td className="px-4 py-3" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
                      {nombre(o.artistas)}
                    </td>
                    <td className="px-4 py-3 max-w-[160px] truncate" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
                      {nombre(o.productos)}
                    </td>
                    <td className="px-4 py-3" style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 600, color: "#111111" }}>
                      {formatCLP(o.precio_unitario * o.cantidad)}
                    </td>
                    <td className="px-4 py-3" style={{ fontFamily: "DM Sans, sans-serif", color: "#666666" }}>
                      {formatCLP(o.comision_monto)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: badge.bg, color: badge.text, fontFamily: "Barlow, sans-serif" }}>
                        {o.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ fontFamily: "Barlow, sans-serif", color: "#999999" }}>
                      {new Date(o.created_at).toLocaleDateString("es-CL")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtradas.length === 0 && (
            <div className="text-center py-16">
              <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Sin órdenes</p>
            </div>
          )}
        </div>
      </div>

      {/* Panel detalle */}
      {seleccionada && (
        <div className="w-80 border-l border-[#e8e8e8] overflow-y-auto shrink-0 bg-white" style={{ borderLeft: "1px solid #e8e8e8" }}>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: "16px", fontWeight: "600", color: "#111111" }}>
                Detalle orden
              </h2>
              <button onClick={() => setSeleccionada(null)} className="text-[#999] hover:text-[#111] text-lg leading-none">×</button>
            </div>

            {[
              ["ID", seleccionada.external_reference?.slice(0, 8).toUpperCase() ?? seleccionada.id.slice(0, 8).toUpperCase()],
              ["Comprador", seleccionada.nombre_comprador ?? "—"],
              ["Email", seleccionada.email_comprador ?? "—"],
              ["Artista", nombre(seleccionada.artistas)],
              ["Producto", nombre(seleccionada.productos)],
              ["Precio unit.", formatCLP(seleccionada.precio_unitario)],
              ["Cantidad", String(seleccionada.cantidad)],
              ["Monto artista", formatCLP(seleccionada.monto_artista)],
              ["Comisión", formatCLP(seleccionada.comision_monto)],
            ].map(([label, val]) => (
              <div key={label} className="mb-3">
                <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "11px", color: "#999999", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "14px", color: "#111111", marginTop: "2px" }}>{val}</p>
              </div>
            ))}

            {(seleccionada.direccion_envio || seleccionada.ciudad_envio) && (
              <div className="mb-3">
                <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "11px", color: "#999999", textTransform: "uppercase" }}>Dirección envío</p>
                <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "14px", color: "#111111", marginTop: "2px" }}>
                  {[seleccionada.direccion_envio, seleccionada.ciudad_envio, seleccionada.region_envio].filter(Boolean).join(", ")}
                </p>
              </div>
            )}

            <div className="border-t border-[#e8e8e8] mt-4 pt-4">
              <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#444444", marginBottom: "6px" }}>
                Cambiar estado
              </p>
              <select
                value={nuevoEstado}
                onChange={(e) => setNuevoEstado(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none mb-3"
                style={{ fontFamily: "Barlow, sans-serif" }}
              >
                {ESTADOS.filter((e) => e !== "todos").map((e) => (
                  <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
                ))}
              </select>
              <button
                onClick={cambiarEstado}
                disabled={actualizando || nuevoEstado === seleccionada.estado}
                className="w-full h-9 rounded-md text-white text-sm"
                style={{
                  fontFamily: "Barlow, sans-serif",
                  backgroundColor: actualizando || nuevoEstado === seleccionada.estado ? "#d1d5db" : "#e8003d",
                }}
              >
                {actualizando ? "Guardando..." : "Confirmar cambio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
