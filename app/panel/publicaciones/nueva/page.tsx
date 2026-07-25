"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PublicacionForm from "../PublicacionForm";

export default function NuevaPublicacionPage() {
  const supabase = createClient();

  const { data: artista, isLoading } = useQuery({
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

  return (
    <div>
      <Link
        href="/panel/publicaciones"
        className="inline-flex items-center gap-1.5 mb-4 text-sm transition-colors"
        style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}
      >
        <ArrowLeft size={14} />
        Mis publicaciones
      </Link>

      <h1
        className="mb-2"
        style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", fontWeight: "700", color: "#111111" }}
      >
        Nueva publicación
      </h1>
      <p
        className="mb-8"
        style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#666666" }}
      >
        Una noticia tuya: un lanzamiento, un show, una nota de prensa.
      </p>

      {isLoading ? (
        <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Cargando...</p>
      ) : !artista ? (
        <div className="rounded-xl border border-[#e8e8e8] p-8 text-center" style={{ backgroundColor: "#f8f7f5" }}>
          <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
            No se encontró tu perfil de artista.{" "}
            <Link href="/panel/perfil" style={{ color: "#e8003d" }}>Complétalo primero</Link>.
          </p>
        </div>
      ) : (
        <PublicacionForm artistaId={artista.id} />
      )}
    </div>
  );
}
