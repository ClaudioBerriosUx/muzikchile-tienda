"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PublicacionForm from "@/components/publicaciones/PublicacionForm";

/**
 * Nueva noticia editorial: firma el perfil MuzikChile (`artistas` con
 * slug 'muzikchile' y es_editorial = true), la misma convención de las noticias
 * migradas del Channel. Se busca por slug y no por UUID fijo.
 *
 * El guard de rol vive en AdminShell; la protección real es el RLS
 * (`publicaciones_insert_admin`).
 */
export default function NuevaNoticiaEditorialPage() {
  const supabase = createClient();

  const { data: editorial, isLoading, error } = useQuery({
    queryKey: ["perfil-editorial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artistas")
        .select("id, nombre")
        .eq("slug", "muzikchile")
        .eq("es_editorial", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="max-w-6xl">
      <Link
        href="/admin/publicaciones"
        className="inline-flex items-center gap-1.5 mb-4 text-sm transition-colors"
        style={{ fontFamily: "var(--font-body)", color: "#666666" }}
      >
        <ArrowLeft size={14} />
        Publicaciones
      </Link>

      <h1
        className="mb-2"
        style={{ fontFamily: "var(--font-titulo)", fontSize: "28px", color: "#111111" }}
      >
        Nueva noticia
      </h1>
      <p
        className="mb-8"
        style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#666666" }}
      >
        Nota editorial firmada por MuzikChile.
      </p>

      {isLoading ? (
        <p style={{ fontFamily: "var(--font-body)", color: "#666666" }}>Cargando...</p>
      ) : error || !editorial ? (
        <div className="rounded-xl border border-[#e8e8e8] p-8 text-center" style={{ backgroundColor: "#f8f7f5" }}>
          <p style={{ fontFamily: "var(--font-body)", color: "#666666" }}>
            {error
              ? `Error buscando el perfil editorial: ${error.message}`
              : "No existe el perfil editorial MuzikChile (slug 'muzikchile', es_editorial = true)."}
          </p>
        </div>
      ) : (
        <PublicacionForm artistaId={editorial.id} modo="editorial" />
      )}
    </div>
  );
}
