"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/ui/StatusBadge";
import PublicacionForm from "@/components/publicaciones/PublicacionForm";

/**
 * Editar una noticia editorial (firma MuzikChile), incluidas las 8 migradas del
 * Channel. Las publicaciones de artistas NO se editan acá: se moderan desde
 * /admin/publicaciones (aprobar, devolver, retirar). Editarlas reescribiría el
 * contenido de un artista con su firma.
 */
export default function EditarNoticiaEditorialPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const { data: publicacion, isLoading, error } = useQuery({
    queryKey: ["admin-publicacion", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("publicaciones")
        .select(
          "id, categoria, titular, bajada, cuerpo, imagen_url, slug, estado, comentario_moderacion, fecha_publicacion, artista_id, artistas(nombre, es_editorial)"
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const volver = (
    <Link
      href="/admin/publicaciones"
      className="inline-flex items-center gap-1.5 mb-4 text-sm transition-colors"
      style={{ fontFamily: "var(--font-body)", color: "#666666" }}
    >
      <ArrowLeft size={14} />
      Publicaciones
    </Link>
  );

  const aviso = (titulo: string, detalle: string) => (
    <div className="max-w-6xl">
      {volver}
      <div className="rounded-xl border border-[#e8e8e8] p-8 text-center" style={{ backgroundColor: "#f8f7f5" }}>
        <Lock size={28} className="mx-auto mb-3 text-[#cccccc]" />
        <p className="mb-2" style={{ fontFamily: "var(--font-body)", fontSize: "20px", color: "#111111" }}>
          {titulo}
        </p>
        <p className="max-w-md mx-auto" style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#666666", lineHeight: 1.6 }}>
          {detalle}
        </p>
      </div>
    </div>
  );

  if (isLoading) {
    return <p style={{ fontFamily: "var(--font-body)", color: "#666666" }}>Cargando...</p>;
  }
  if (error) {
    return aviso("No se pudo cargar la publicación", error.message);
  }
  if (!publicacion) {
    return aviso("No existe", "Esta publicación no existe o fue eliminada.");
  }
  if (!publicacion.artistas?.es_editorial) {
    return aviso(
      "No es una noticia editorial",
      `Es de ${publicacion.artistas?.nombre ?? "un artista"}. Las publicaciones de artistas se moderan desde la lista (aprobar, devolver o retirar), no se editan.`
    );
  }

  return (
    <div className="max-w-6xl">
      {volver}
      <div className="flex items-center gap-3 mb-2">
        <h1 style={{ fontFamily: "var(--font-titulo)", fontSize: "28px", color: "#111111" }}>
          Editar noticia
        </h1>
        <StatusBadge estado={publicacion.estado} />
      </div>
      <p className="mb-8" style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#666666" }}>
        Nota editorial firmada por {publicacion.artistas.nombre}. La URL pública no cambia
        aunque edites el titular.
      </p>

      <PublicacionForm artistaId={publicacion.artista_id} publicacion={publicacion} modo="editorial" />
    </div>
  );
}
