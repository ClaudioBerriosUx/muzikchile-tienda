"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Clock, CheckCircle, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCLP } from "@/lib/constants";
import StatusBadge from "@/components/ui/StatusBadge";

interface Orden {
  id: string;
  monto_artista: number;
  comision_monto: number;
  estado: string;
  liquidado?: boolean;
  created_at: string;
  productos?: { nombre: string } | null;
}

interface Liquidacion {
  id: string;
  monto: number;
  fecha: string;
  comprobante?: string;
  comprobante_url?: string;
  nota?: string;
  created_at: string;
}

export default function LiquidacionesPage() {
  const supabase = createClient();

  const { data: artista } = useQuery({
    queryKey: ["panel-artista"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("artistas")
        .select("id, nombre, banco, cuenta_bancaria, tipo_cuenta, rut")
        .eq("user_id", user.id)
        .single();
      return data ?? null;
    },
  });

  const { data: ordenes = [] } = useQuery<Orden[]>({
    queryKey: ["panel-ordenes", artista?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordenes")
        .select("id, monto_artista, comision_monto, estado, liquidado, created_at, productos(nombre)")
        .eq("artista_id", artista!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Orden[];
    },
    enabled: !!artista?.id,
  });

  const { data: liquidaciones = [] } = useQuery<Liquidacion[]>({
    queryKey: ["panel-liquidaciones", artista?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liquidaciones")
        .select("id, monto, fecha, comprobante, comprobante_url, nota, created_at")
        .eq("artista_id", artista!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Liquidacion[];
    },
    enabled: !!artista?.id,
  });

  const startOfMonth = useMemo(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const pendientePago = useMemo(() =>
    ordenes
      .filter((o) => o.estado === "pagado" && !o.liquidado)
      .reduce((acc, o) => acc + (o.monto_artista ?? 0), 0),
  [ordenes]);

  const totalVendido = useMemo(() =>
    ordenes
      .filter((o) => o.estado === "pagado")
      .reduce((acc, o) => acc + (o.monto_artista ?? 0), 0),
  [ordenes]);

  const ventasMes = useMemo(() =>
    ordenes
      .filter((o) => o.estado === "pagado" && new Date(o.created_at) >= startOfMonth)
      .reduce((acc, o) => acc + (o.monto_artista ?? 0), 0),
  [ordenes, startOfMonth]);

  const totalRecibido = useMemo(() =>
    liquidaciones.reduce((acc, l) => acc + (l.monto ?? 0), 0),
  [liquidaciones]);

  const tieneDatosBancarios = artista?.banco && artista?.cuenta_bancaria;

  const metricas = [
    { label: "Pendiente de pago",  valor: formatCLP(pendientePago), icon: <Clock size={20} />,       color: "#f59e0b", desc: "Órdenes pagadas sin liquidar" },
    { label: "Total recibido",     valor: formatCLP(totalRecibido), icon: <CheckCircle size={20} />,  color: "#22c55e", desc: "Pagos acreditados" },
    { label: "Este mes",           valor: formatCLP(ventasMes),     icon: <TrendingUp size={20} />,   color: "#3b82f6", desc: "Ventas del mes actual" },
    { label: "Total acumulado",    valor: formatCLP(totalVendido),  icon: <DollarSign size={20} />,   color: "#8b5cf6", desc: "Histórico de ventas" },
  ];

  return (
    <div>
      <h1 className="mb-2" style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", fontWeight: "700", color: "#111111" }}>
        Mis liquidaciones
      </h1>
      <p className="mb-8" style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#666666" }}>
        Historial de ventas y pagos recibidos
      </p>

      {/* Aviso datos bancarios */}
      {!tieneDatosBancarios && (
        <div className="mb-6 p-4 rounded-xl border" style={{ backgroundColor: "#fef9c3", borderColor: "#fde68a" }}>
          <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#854d0e" }}>
            ⚠️ No tienes datos bancarios configurados. Agrégalos en{" "}
            <a href="/panel/perfil" className="underline font-semibold">Mi perfil</a>{" "}
            para que podamos enviarte tus pagos.
          </p>
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {metricas.map((m) => (
          <div key={m.label} className="rounded-xl border border-[#e8e8e8] p-5 bg-white">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${m.color}15` }}>
                <span style={{ color: m.color }}>{m.icon}</span>
              </div>
            </div>
            <p style={{ fontFamily: "Oswald, sans-serif", fontSize: "22px", fontWeight: "700", color: "#111111" }}>
              {m.valor}
            </p>
            <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#666666", marginTop: "2px" }}>
              {m.label}
            </p>
            <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "11px", color: "#999999", marginTop: "1px" }}>
              {m.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Historial de pagos recibidos */}
      <section className="mb-10">
        <h2 className="mb-4" style={{ fontFamily: "Oswald, sans-serif", fontSize: "18px", fontWeight: "600", color: "#111111" }}>
          Pagos recibidos
        </h2>
        {liquidaciones.length === 0 ? (
          <div className="rounded-xl border border-[#e8e8e8] p-10 text-center" style={{ backgroundColor: "#f8f7f5" }}>
            <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
              Aún no has recibido pagos. Aparecerán aquí cuando el admin registre una liquidación.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#e8e8e8] overflow-hidden">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: "#f8f7f5" }}>
                <tr>
                  {["Fecha", "Monto", "Comprobante", "Nota"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wide"
                      style={{ fontFamily: "Barlow, sans-serif", color: "#666666", fontWeight: 600 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liquidaciones.map((l, i) => (
                  <tr key={l.id} style={{ borderTop: i > 0 ? "1px solid #f0f0f0" : undefined }}>
                    <td className="px-4 py-3" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
                      {new Date(l.fecha).toLocaleDateString("es-CL")}
                    </td>
                    <td className="px-4 py-3 font-bold" style={{ fontFamily: "DM Sans, sans-serif", color: "#22c55e" }}>
                      {formatCLP(l.monto)}
                    </td>
                    <td className="px-4 py-3">
                      {l.comprobante_url ? (
                        <a href={l.comprobante_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs underline" style={{ color: "#3b82f6" }}>
                          Ver comprobante
                        </a>
                      ) : l.comprobante ? (
                        <span className="text-xs font-mono" style={{ color: "#666666" }}>{l.comprobante}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
                      {l.nota ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Detalle de órdenes */}
      <section>
        <h2 className="mb-4" style={{ fontFamily: "Oswald, sans-serif", fontSize: "18px", fontWeight: "600", color: "#111111" }}>
          Mis ventas
        </h2>
        {ordenes.length === 0 ? (
          <div className="rounded-xl border border-[#e8e8e8] p-10 text-center" style={{ backgroundColor: "#f8f7f5" }}>
            <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Aún no tienes ventas registradas.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#e8e8e8] overflow-hidden">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: "#f8f7f5" }}>
                <tr>
                  {["Fecha", "Producto", "Tu ganancia", "Comisión", "Estado", "Liquidado"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wide"
                      style={{ fontFamily: "Barlow, sans-serif", color: "#666666", fontWeight: 600 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordenes.map((o, i) => {
                  const producto = Array.isArray(o.productos)
                    ? o.productos[0]
                    : (o.productos as { nombre: string } | null);
                  return (
                    <tr key={o.id} style={{ borderTop: i > 0 ? "1px solid #f0f0f0" : undefined }}>
                      <td className="px-4 py-3" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
                        {new Date(o.created_at).toLocaleDateString("es-CL")}
                      </td>
                      <td className="px-4 py-3 max-w-[180px] truncate" style={{ fontFamily: "Barlow, sans-serif", color: "#111111" }}>
                        {producto?.nombre ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-bold" style={{ fontFamily: "DM Sans, sans-serif", color: "#e8003d" }}>
                        {formatCLP(o.monto_artista)}
                      </td>
                      <td className="px-4 py-3" style={{ fontFamily: "DM Sans, sans-serif", color: "#999999" }}>
                        {formatCLP(o.comision_monto)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge estado={o.estado} />
                      </td>
                      <td className="px-4 py-3">
                        {o.liquidado ? (
                          <span className="text-xs px-2 py-0.5 rounded font-medium"
                            style={{ fontFamily: "Barlow, sans-serif", backgroundColor: "#dcfce7", color: "#166534" }}>
                            Pagado
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded"
                            style={{ fontFamily: "Barlow, sans-serif", backgroundColor: "#f3f4f6", color: "#666666" }}>
                            Pendiente
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
