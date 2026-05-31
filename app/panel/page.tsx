"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Package, Clock, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCLP } from "@/lib/constants";
import StatusBadge from "@/components/ui/StatusBadge";

interface Artista {
  id: string;
  nombre: string;
  slug: string;
}

interface Orden {
  id: string;
  monto_artista: number;
  estado: string;
  created_at: string;
  nombre_comprador?: string;
  productos?: { nombre: string } | null;
}

function MetricCard({
  label,
  valor,
  icon,
  color,
}: {
  label: string;
  valor: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div
      className="rounded-xl border border-[#e8e8e8] p-6"
      style={{ backgroundColor: "#ffffff" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#666666" }}>
            {label}
          </p>
          <p
            className="mt-2"
            style={{ fontFamily: "Oswald, sans-serif", fontSize: "32px", fontWeight: "700", color: "#111111" }}
          >
            {valor}
          </p>
        </div>
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15` }}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const supabase = createClient();

  const { data: artista, isLoading } = useQuery<Artista | null>({
    queryKey: ["panel-artista"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("artistas")
        .select("id, nombre, slug")
        .eq("user_id", user.id)
        .single();
      return data ?? null;
    },
  });

  const { data: ventas = [] } = useQuery({
    queryKey: ["panel-ventas", artista?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ordenes")
        .select("monto_artista")
        .eq("artista_id", artista!.id)
        .eq("estado", "pagado");
      return data ?? [];
    },
    enabled: !!artista?.id,
  });

  const { data: countAprobados = 0 } = useQuery({
    queryKey: ["panel-count-aprobados", artista?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("productos")
        .select("id", { count: "exact", head: true })
        .eq("artista_id", artista!.id)
        .eq("estado", "aprobado");
      return count ?? 0;
    },
    enabled: !!artista?.id,
  });

  const { data: countRevision = 0 } = useQuery({
    queryKey: ["panel-count-revision", artista?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("productos")
        .select("id", { count: "exact", head: true })
        .eq("artista_id", artista!.id)
        .eq("estado", "en_revision");
      return count ?? 0;
    },
    enabled: !!artista?.id,
  });

  const { data: countPendientes = 0 } = useQuery({
    queryKey: ["panel-count-pendientes", artista?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("ordenes")
        .select("id", { count: "exact", head: true })
        .eq("artista_id", artista!.id)
        .eq("estado", "pagado");
      return count ?? 0;
    },
    enabled: !!artista?.id,
  });

  const { data: ultimasOrdenes = [] } = useQuery<Orden[]>({
    queryKey: ["panel-ultimas-ordenes", artista?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ordenes")
        .select("id, monto_artista, estado, created_at, nombre_comprador, productos(nombre)")
        .eq("artista_id", artista!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data ?? []) as unknown as Orden[];
    },
    enabled: !!artista?.id,
  });

  const totalVendido = ventas.reduce(
    (acc: number, v: { monto_artista: number }) => acc + (v.monto_artista ?? 0),
    0
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Cargando...</p>
      </div>
    );
  }

  if (!artista) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p style={{ fontFamily: "Oswald, sans-serif", fontSize: "22px", color: "#111111" }}>
          Completa tu perfil de artista
        </p>
        <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
          Necesitas un perfil para publicar productos.
        </p>
        <Link
          href="/panel/perfil"
          className="px-6 py-2.5 rounded-md text-white text-sm font-semibold"
          style={{ backgroundColor: "#e8003d", fontFamily: "Barlow, sans-serif" }}
        >
          Completar perfil
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1
        className="mb-2"
        style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", fontWeight: "700", color: "#111111" }}
      >
        Dashboard
      </h1>
      <p className="mb-8" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
        Bienvenido, {artista.nombre}
      </p>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <MetricCard
          label="Total vendido"
          valor={formatCLP(totalVendido)}
          icon={<DollarSign size={20} />}
          color="#22c55e"
        />
        <MetricCard
          label="Productos activos"
          valor={countAprobados}
          icon={<Package size={20} />}
          color="#3b82f6"
        />
        <MetricCard
          label="En revisión"
          valor={countRevision}
          icon={<Clock size={20} />}
          color="#f59e0b"
        />
        <MetricCard
          label="Órdenes pendientes"
          valor={countPendientes}
          icon={<ShoppingBag size={20} />}
          color="#f97316"
        />
      </div>

      {/* Últimas ventas */}
      <div>
        <h2
          className="mb-4"
          style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", fontWeight: "600", color: "#111111" }}
        >
          Últimas ventas
        </h2>

        {ultimasOrdenes.length === 0 ? (
          <div
            className="rounded-xl border border-[#e8e8e8] p-12 text-center"
            style={{ backgroundColor: "#f8f7f5" }}
          >
            <ShoppingBag size={40} className="mx-auto mb-3 text-[#cccccc]" />
            <p style={{ fontFamily: "Oswald, sans-serif", fontSize: "18px", color: "#111111" }}>
              Aún no tienes ventas
            </p>
            <p className="mt-1 mb-4" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
              Sube tu primer producto para empezar a vender
            </p>
            <Link
              href="/panel/productos/nuevo"
              className="inline-block px-5 py-2 rounded-md text-white text-sm"
              style={{ backgroundColor: "#e8003d", fontFamily: "Barlow, sans-serif" }}
            >
              Sube tu primer producto
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-[#e8e8e8] overflow-hidden">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: "#f8f7f5" }}>
                <tr>
                  {["Producto", "Comprador", "Monto", "Fecha", "Estado"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3"
                      style={{ fontFamily: "Barlow, sans-serif", fontWeight: 600, color: "#666666", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ultimasOrdenes.map((orden, i) => (
                  <tr
                    key={orden.id}
                    style={{ borderTop: i > 0 ? "1px solid #e8e8e8" : undefined }}
                  >
                    <td className="px-4 py-3" style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}>
                      {Array.isArray(orden.productos)
                        ? orden.productos[0]?.nombre
                        : (orden.productos as { nombre: string } | null)?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
                      {orden.nombre_comprador ?? "—"}
                    </td>
                    <td className="px-4 py-3" style={{ fontFamily: "DM Sans, sans-serif", color: "#111111", fontWeight: 600 }}>
                      {formatCLP(orden.monto_artista)}
                    </td>
                    <td className="px-4 py-3" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
                      {new Date(orden.created_at).toLocaleDateString("es-CL")}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge estado={orden.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
