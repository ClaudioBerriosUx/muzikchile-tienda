"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { DollarSign, Percent, Users, Package, Clock, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCLP } from "@/lib/constants";

interface OrdenChart {
  artista_id: string;
  monto_artista: number;
  comision_monto: number;
  precio_unitario: number;
  artistas: { nombre: string } | { nombre: string }[] | null;
}

function MetricCard({
  label, valor, icon, color,
}: {
  label: string;
  valor: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[#e8e8e8] p-6 bg-white">
      <div className="flex items-start justify-between">
        <div>
          <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#666666", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {label}
          </p>
          <p className="mt-2" style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", fontWeight: "700", color: "#111111" }}>
            {valor}
          </p>
        </div>
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}18` }}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const supabase = createClient();

  const startOfMonth = useMemo(() => {
    const d = new Date();
    d.setDate(1); d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const { data: ordenesVentas = [] } = useQuery<OrdenChart[]>({
    queryKey: ["admin-ordenes-ventas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ordenes")
        .select("artista_id, monto_artista, comision_monto, precio_unitario, artistas(nombre)")
        .eq("estado", "pagado");
      return (data ?? []) as unknown as OrdenChart[];
    },
  });

  const { data: countArtistas = 0 } = useQuery({
    queryKey: ["admin-count-artistas"],
    queryFn: async () => {
      const { count } = await supabase
        .from("artistas")
        .select("id", { count: "exact", head: true })
        .eq("tienda_activa", true);
      return count ?? 0;
    },
  });

  const { data: countAprobados = 0 } = useQuery({
    queryKey: ["admin-count-aprobados"],
    queryFn: async () => {
      const { count } = await supabase
        .from("productos")
        .select("id", { count: "exact", head: true })
        .eq("estado", "aprobado");
      return count ?? 0;
    },
  });

  const { data: countRevision = 0 } = useQuery({
    queryKey: ["admin-count-revision"],
    queryFn: async () => {
      const { count } = await supabase
        .from("productos")
        .select("id", { count: "exact", head: true })
        .eq("estado", "en_revision");
      return count ?? 0;
    },
  });

  const { data: countMes = 0 } = useQuery({
    queryKey: ["admin-count-mes"],
    queryFn: async () => {
      const { count } = await supabase
        .from("ordenes")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfMonth);
      return count ?? 0;
    },
  });

  const totalVentas = useMemo(
    () => ordenesVentas.reduce((acc, o) => acc + (o.precio_unitario ?? 0), 0),
    [ordenesVentas]
  );
  const totalComisiones = useMemo(
    () => ordenesVentas.reduce((acc, o) => acc + (o.comision_monto ?? 0), 0),
    [ordenesVentas]
  );

  const topArtistas = useMemo(() => {
    const map = new Map<string, { nombre: string; ventas: number }>();
    for (const o of ordenesVentas) {
      const raw = o.artistas;
      const nombre = Array.isArray(raw) ? raw[0]?.nombre : (raw as { nombre: string } | null)?.nombre ?? o.artista_id;
      const prev = map.get(o.artista_id);
      if (prev) {
        prev.ventas += o.monto_artista ?? 0;
      } else {
        map.set(o.artista_id, { nombre: nombre ?? o.artista_id, ventas: o.monto_artista ?? 0 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.ventas - a.ventas).slice(0, 5);
  }, [ordenesVentas]);

  const metrics = [
    { label: "Total ventas", valor: formatCLP(totalVentas),  icon: <DollarSign size={20} />, color: "#22c55e" },
    { label: "Comisiones",   valor: formatCLP(totalComisiones), icon: <Percent size={20} />,   color: "#3b82f6" },
    { label: "Artistas activos",      valor: countArtistas,  icon: <Users size={20} />,      color: "#8b5cf6" },
    { label: "Productos aprobados",   valor: countAprobados, icon: <Package size={20} />,    color: "#06b6d4" },
    { label: "En revisión",           valor: countRevision,  icon: <Clock size={20} />,      color: "#f59e0b" },
    { label: "Órdenes del mes",       valor: countMes,       icon: <ShoppingBag size={20} />, color: "#f97316" },
  ];

  return (
    <div>
      <h1 className="mb-2" style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", fontWeight: "700", color: "#111111" }}>
        Dashboard Admin
      </h1>
      <p className="mb-8" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
        Vista general de MuzikChile Tienda
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      <div className="rounded-xl border border-[#e8e8e8] p-6">
        <h2 className="mb-6" style={{ fontFamily: "Oswald, sans-serif", fontSize: "18px", fontWeight: "600", color: "#111111" }}>
          Top 5 artistas por ventas
        </h2>
        {topArtistas.length === 0 ? (
          <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Sin ventas registradas aún.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topArtistas} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="nombre"
                tick={{ fontFamily: "Barlow, sans-serif", fontSize: 12, fill: "#666" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontFamily: "Barlow, sans-serif", fontSize: 11, fill: "#999" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [formatCLP(Number(v ?? 0)), "Ventas"]}
                contentStyle={{ fontFamily: "Barlow, sans-serif", border: "1px solid #e8e8e8", borderRadius: "8px" }}
              />
              <Bar dataKey="ventas" fill="#e8003d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
