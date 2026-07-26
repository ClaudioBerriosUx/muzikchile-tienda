"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Newspaper, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/ui/StatusBadge";
import { etiquetaCategoria, esEditable } from "@/lib/publicaciones";
import { borrarImagenDePublicacion } from "@/lib/storage";

interface Publicacion {
  id: string;
  titular: string;
  slug: string;
  categoria: string | null;
  estado: string;
  comentario_moderacion: string | null;
  imagen_url: string | null;
  created_at: string;
}

/**
 * Estados que el artista puede borrar. Coincide con el RLS
 * `publicaciones_delete_propias`, que permite 'borrador' y 'devuelta'.
 *
 * Si se cambia acá sin cambiar la política, el botón aparecería y el borrado
 * fallaría; si se cambia la política sin tocar esto, el artista no podría usar
 * un permiso que sí tiene.
 */
function esBorrable(estado: string): boolean {
  return estado === "borrador" || estado === "devuelta";
}

export default function MisPublicacionesPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [aBorrar, setABorrar] = useState<Publicacion | null>(null);
  const [borrando, setBorrando] = useState(false);

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

  // El RLS `publicaciones_select_propias` ya limita a las filas del artista;
  // el filtro por artista_id es explícito igual, para no depender solo de eso.
  const { data: publicaciones = [], isLoading } = useQuery<Publicacion[]>({
    queryKey: ["panel-publicaciones", artista?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("publicaciones")
        .select("id, titular, slug, categoria, estado, comentario_moderacion, imagen_url, created_at")
        .eq("artista_id", artista!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!artista?.id,
  });

  const borrar = async () => {
    if (!aBorrar) return;
    setBorrando(true);
    try {
      const { error } = await supabase
        .from("publicaciones")
        .delete()
        .eq("id", aBorrar.id);
      if (error) throw error;

      // La imagen se borra DESPUÉS y sin bloquear: si falla, queda un archivo
      // huérfano, que es mucho mejor que una publicación sin imagen.
      await borrarImagenDePublicacion(supabase, aBorrar.imagen_url);

      toast.success("Publicación eliminada");
      queryClient.invalidateQueries({ queryKey: ["panel-publicaciones"] });
      setABorrar(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo eliminar la publicación"
      );
    } finally {
      setBorrando(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", fontWeight: "700", color: "#111111" }}>
          Mis publicaciones
        </h1>
        <Link
          href="/panel/publicaciones/nueva"
          className="flex items-center gap-2 px-4 py-2 rounded-md text-white text-sm font-semibold"
          style={{ backgroundColor: "#e8003d", fontFamily: "Barlow, sans-serif" }}
        >
          <Plus size={16} />
          Nueva publicación
        </Link>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#e8e8e8] p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-28 h-20 rounded-lg shrink-0" style={{ backgroundColor: "#f0f0f0" }} />
                <div className="flex-1 flex flex-col gap-2 py-1">
                  <div className="h-4 rounded" style={{ backgroundColor: "#f0f0f0" }} />
                  <div className="h-3 rounded w-1/3" style={{ backgroundColor: "#f0f0f0" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : publicaciones.length === 0 ? (
        <div className="text-center py-20 rounded-xl border border-[#e8e8e8]" style={{ backgroundColor: "#f8f7f5" }}>
          <Newspaper size={40} className="mx-auto mb-3 text-[#cccccc]" />
          <p style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", color: "#111111" }}>
            Aún no tienes publicaciones
          </p>
          <p className="mt-2" style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#666666" }}>
            Cuenta un lanzamiento, un show o lo que estés preparando.
          </p>
          <Link
            href="/panel/publicaciones/nueva"
            className="inline-block mt-4 px-5 py-2 rounded-md text-white text-sm"
            style={{ backgroundColor: "#e8003d", fontFamily: "Barlow, sans-serif" }}
          >
            Crear la primera
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {publicaciones.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-[#e8e8e8] overflow-hidden"
              style={{ backgroundColor: "#ffffff" }}
            >
              <div className="flex gap-4 p-4">
                {/* Portada */}
                <div className="w-28 h-20 rounded-lg overflow-hidden shrink-0 border border-[#e8e8e8]">
                  {p.imagen_url ? (
                    <img src={p.imagen_url} alt={p.titular} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#f8f7f5" }}>
                      <Newspaper size={18} className="text-[#cccccc]" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className="line-clamp-2"
                      style={{ fontFamily: "Oswald, sans-serif", fontSize: "16px", color: "#111111" }}
                    >
                      {p.titular}
                    </p>
                    <div className="shrink-0">
                      <StatusBadge estado={p.estado} />
                    </div>
                  </div>

                  <p
                    className="mt-1"
                    style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#666666" }}
                  >
                    {etiquetaCategoria(p.categoria)}
                    {" · "}
                    {new Date(p.created_at).toLocaleDateString("es-CL", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </p>

                  {/* Feedback del admin: solo cuando fue devuelta */}
                  {p.estado === "devuelta" && p.comentario_moderacion && (
                    <div
                      className="mt-2 rounded-md border px-3 py-2"
                      style={{ backgroundColor: "#fff7ed", borderColor: "#fed7aa" }}
                    >
                      <p
                        style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", fontWeight: 600, color: "#9a3412" }}
                      >
                        Qué hay que corregir
                      </p>
                      <p
                        className="mt-0.5"
                        style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#7c2d12", lineHeight: 1.5 }}
                      >
                        {p.comentario_moderacion}
                      </p>
                    </div>
                  )}

                  {/*
                    Acciones. Cada botón aparece solo si el RLS lo permitiría:
                    ofrecer uno que la política va a rechazar es prometer algo
                    que no se puede cumplir.
                  */}
                  <div className="flex gap-2 mt-3 flex-wrap items-center">
                    {esEditable(p.estado) && (
                      <Link
                        href={`/panel/publicaciones/${p.id}/editar`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs transition-colors"
                        style={{ fontFamily: "Barlow, sans-serif", borderColor: "#e8e8e8", color: "#444444" }}
                      >
                        <Pencil size={12} />
                        Editar
                      </Link>
                    )}

                    {/* Ya publicada: no se edita, pero sí se puede ver. */}
                    {p.estado === "publicada" && (
                      <Link
                        href={`/noticias/${p.slug}`}
                        target="_blank"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs transition-colors"
                        style={{ fontFamily: "Barlow, sans-serif", borderColor: "#e8e8e8", color: "#444444" }}
                      >
                        <ExternalLink size={12} />
                        Ver publicada
                      </Link>
                    )}

                    {esBorrable(p.estado) && (
                      <button
                        onClick={() => setABorrar(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs transition-colors"
                        style={{ fontFamily: "Barlow, sans-serif", borderColor: "#fecaca", color: "#e8003d" }}
                      >
                        <Trash2 size={12} />
                        Eliminar
                      </button>
                    )}

                    {/* Explicación de por qué no hay acciones de edición. */}
                    {!esEditable(p.estado) && (
                      <span
                        className="text-xs"
                        style={{ fontFamily: "Barlow, sans-serif", color: "#999999" }}
                      >
                        {p.estado === "pendiente"
                          ? "En revisión — no se puede editar ni eliminar mientras la revisamos"
                          : "Publicada — escríbenos si necesitas cambiarla o retirarla"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmación de borrado */}
      <Dialog open={!!aBorrar} onOpenChange={() => !borrando && setABorrar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Oswald, sans-serif" }}>
              ¿Eliminar esta publicación?
            </DialogTitle>
            <DialogDescription style={{ fontFamily: "Barlow, sans-serif" }}>
              {aBorrar?.titular
                ? `“${aBorrar.titular}” se eliminará junto con su imagen. No se puede deshacer.`
                : "No se puede deshacer."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setABorrar(null)}
              disabled={borrando}
              className="px-4 py-2 rounded border text-sm"
              style={{ fontFamily: "Barlow, sans-serif", borderColor: "#e8e8e8", color: "#444444" }}
            >
              Cancelar
            </button>
            <button
              onClick={borrar}
              disabled={borrando}
              className="px-4 py-2 rounded text-white text-sm"
              style={{
                fontFamily: "Barlow, sans-serif",
                backgroundColor: borrando ? "#f0a0b0" : "#e8003d",
                cursor: borrando ? "not-allowed" : "pointer",
              }}
            >
              {borrando ? "Eliminando..." : "Sí, eliminar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
