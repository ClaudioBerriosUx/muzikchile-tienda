"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/ui/StatusBadge";
import { esEditable } from "@/lib/publicaciones";
import PublicacionForm, { type PublicacionExistente } from "../../PublicacionForm";

export default function EditarPublicacionPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

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

  /**
   * `maybeSingle` y no `single`: si la publicación no es del artista, el RLS
   * `select_propias` simplemente no devuelve la fila, y eso no es un error que
   * haya que mostrar como fallo — es un "no existe para ti".
   */
  const {
    data: publicacion,
    isLoading,
    error,
  } = useQuery<PublicacionExistente | null>({
    queryKey: ["panel-publicacion", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("publicaciones")
        .select("id, categoria, titular, bajada, cuerpo, imagen_url, slug, estado, comentario_moderacion")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const volver = (
    <Link
      href="/panel/publicaciones"
      className="inline-flex items-center gap-1.5 mb-4 text-sm transition-colors"
      style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}
    >
      <ArrowLeft size={14} />
      Mis publicaciones
    </Link>
  );

  const aviso = (titulo: string, detalle: string, estado?: string) => (
    <div>
      {volver}
      <div
        className="rounded-xl border border-[#e8e8e8] p-8 text-center"
        style={{ backgroundColor: "#f8f7f5" }}
      >
        <Lock size={28} className="mx-auto mb-3 text-[#cccccc]" />
        <div className="flex items-center justify-center gap-2 mb-2">
          <p style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", color: "#111111" }}>
            {titulo}
          </p>
          {estado && <StatusBadge estado={estado} />}
        </div>
        <p
          className="max-w-md mx-auto"
          style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#666666", lineHeight: 1.6 }}
        >
          {detalle}
        </p>
        <Link
          href="/panel/publicaciones"
          className="inline-block mt-5 px-5 py-2 rounded-md text-white text-sm"
          style={{ backgroundColor: "#e8003d", fontFamily: "Barlow, sans-serif" }}
        >
          Volver al listado
        </Link>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div>
        {volver}
        <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Cargando publicación...</p>
      </div>
    );
  }

  if (error) {
    return aviso(
      "No se pudo cargar",
      error instanceof Error ? error.message : "Error inesperado al cargar la publicación."
    );
  }

  if (!publicacion) {
    return aviso(
      "Publicación no encontrada",
      "No existe o no es tuya. Si crees que es un error, revisa el listado de tus publicaciones."
    );
  }

  /**
   * Guard en UI. El RLS `update_propias` rechazaría el update igual (solo
   * permite 'borrador' y 'devuelta'), pero fallar recién al guardar, después de
   * que el artista reescribió todo, es una mala forma de enterarse.
   */
  if (!esEditable(publicacion.estado)) {
    return aviso(
      "Esta publicación no se puede editar",
      publicacion.estado === "pendiente"
        ? "Está en revisión. Cuando el equipo la revise, se publica o vuelve con comentarios para que la corrijas."
        : "Ya está publicada. Si necesitas cambiar algo, escríbenos y la devolvemos a edición.",
      publicacion.estado
    );
  }

  return (
    <div>
      {volver}

      <h1
        className="mb-2"
        style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", fontWeight: "700", color: "#111111" }}
      >
        Editar publicación
      </h1>
      <p
        className="mb-8"
        style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#666666" }}
      >
        {publicacion.estado === "devuelta"
          ? "Corrige lo que te indicaron y vuelve a enviarla a revisión."
          : "Sigue siendo un borrador: solo lo ves tú hasta que lo envíes a revisión."}
      </p>

      {artista && (
        <PublicacionForm artistaId={artista.id} publicacion={publicacion} />
      )}
    </div>
  );
}
