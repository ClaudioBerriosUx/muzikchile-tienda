"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Music } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCLP } from "@/lib/constants";

interface Producto {
  id: string;
  nombre: string;
  precio: number;
  imagenes: string[];
  estado: string;
  motivo_rechazo?: string;
  created_at: string;
  categorias?: { nombre: string } | null;
}

export default function MisProductosPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [idAEliminar, setIdAEliminar] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const { data: artista } = useQuery({
    queryKey: ["panel-artista"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("artistas")
        .select("id, nombre")
        .eq("user_id", user.id)
        .single();
      return data ?? null;
    },
  });

  const { data: productos = [], isLoading } = useQuery<Producto[]>({
    queryKey: ["panel-productos", artista?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("id, nombre, precio, imagenes, estado, motivo_rechazo, created_at, categorias(nombre)")
        .eq("artista_id", artista!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Producto[];
    },
    enabled: !!artista?.id,
  });

  const handleEliminar = async () => {
    if (!idAEliminar) return;
    setEliminando(true);
    try {
      const { error } = await supabase
        .from("productos")
        .delete()
        .eq("id", idAEliminar);
      if (error) throw error;
      toast.success("Producto eliminado");
      queryClient.invalidateQueries({ queryKey: ["panel-productos"] });
      setIdAEliminar(null);
    } catch {
      toast.error("Error al eliminar el producto");
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", fontWeight: "700", color: "#111111" }}>
          Mis productos
        </h1>
        <Link
          href="/panel/productos/nuevo"
          className="flex items-center gap-2 px-4 py-2 rounded-md text-white text-sm font-semibold"
          style={{ backgroundColor: "#e8003d", fontFamily: "Barlow, sans-serif" }}
        >
          <Plus size={16} />
          Nuevo producto
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#e8e8e8] overflow-hidden animate-pulse">
              <div className="flex gap-4 p-4">
                <div className="w-24 h-24 rounded-lg shrink-0" style={{ backgroundColor: "#f0f0f0" }} />
                <div className="flex-1 flex flex-col gap-2 py-1">
                  <div className="h-4 rounded" style={{ backgroundColor: "#f0f0f0" }} />
                  <div className="h-3 rounded w-1/2" style={{ backgroundColor: "#f0f0f0" }} />
                  <div className="h-5 rounded w-1/3 mt-auto" style={{ backgroundColor: "#f0f0f0" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : productos.length === 0 ? (
        <div className="text-center py-20 rounded-xl border border-[#e8e8e8]" style={{ backgroundColor: "#f8f7f5" }}>
          <Music size={40} className="mx-auto mb-3 text-[#cccccc]" />
          <p style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", color: "#111111" }}>
            Aún no tienes productos
          </p>
          <Link
            href="/panel/productos/nuevo"
            className="inline-block mt-4 px-5 py-2 rounded-md text-white text-sm"
            style={{ backgroundColor: "#e8003d", fontFamily: "Barlow, sans-serif" }}
          >
            Sube tu primer producto
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {productos.map((p) => {
            const imagen = p.imagenes?.[0];
            return (
              <div
                key={p.id}
                className="rounded-xl border border-[#e8e8e8] overflow-hidden"
                style={{ backgroundColor: "#ffffff" }}
              >
                <div className="flex gap-4 p-4">
                  {/* Imagen */}
                  <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 border border-[#e8e8e8]">
                    {imagen ? (
                      <img src={imagen} alt={p.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#f8f7f5" }}>
                        <Music size={20} className="text-[#cccccc]" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="font-medium line-clamp-1"
                        style={{ fontFamily: "Oswald, sans-serif", fontSize: "16px", color: "#111111" }}
                      >
                        {p.nombre}
                      </p>
                      <StatusBadge estado={p.estado} />
                    </div>

                    <p className="mt-1" style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 700, color: "#e8003d", fontSize: "15px" }}>
                      {formatCLP(p.precio)}
                    </p>

                    {p.estado === "rechazado" && p.motivo_rechazo && (
                      <p className="mt-1 text-xs" style={{ fontFamily: "Barlow, sans-serif", color: "#e8003d" }}>
                        {p.motivo_rechazo}
                      </p>
                    )}

                    <div className="flex gap-2 mt-3">
                      <Link
                        href={`/panel/productos/${p.id}/editar`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs transition-colors"
                        style={{ fontFamily: "Barlow, sans-serif", borderColor: "#e8e8e8", color: "#444444" }}
                      >
                        <Pencil size={12} />
                        Editar
                      </Link>
                      <button
                        onClick={() => setIdAEliminar(p.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs transition-colors"
                        style={{ fontFamily: "Barlow, sans-serif", borderColor: "#fecaca", color: "#e8003d" }}
                      >
                        <Trash2 size={12} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog confirmación eliminar */}
      <Dialog open={!!idAEliminar} onOpenChange={() => setIdAEliminar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Oswald, sans-serif" }}>¿Eliminar producto?</DialogTitle>
            <DialogDescription style={{ fontFamily: "Barlow, sans-serif" }}>
              Esta acción no se puede deshacer. El producto será eliminado permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setIdAEliminar(null)}
              className="px-4 py-2 rounded border text-sm"
              style={{ fontFamily: "Barlow, sans-serif", borderColor: "#e8e8e8", color: "#444444" }}
            >
              Cancelar
            </button>
            <button
              onClick={handleEliminar}
              disabled={eliminando}
              className="px-4 py-2 rounded text-white text-sm"
              style={{
                fontFamily: "Barlow, sans-serif",
                backgroundColor: eliminando ? "#f0a0b0" : "#e8003d",
                cursor: eliminando ? "not-allowed" : "pointer",
              }}
            >
              {eliminando ? "Eliminando..." : "Sí, eliminar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
