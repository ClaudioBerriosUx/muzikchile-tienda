"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Clapperboard, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { aJsonChannel, textoArtista, urlDeYoutube } from "@/lib/videos";

const TEXTO = { fontFamily: "var(--font-body)" } as const;
const TITULO = { fontFamily: "var(--font-titulo)" } as const;
const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });

/**
 * Videos que enviaron los artistas, el más reciente primero. "Copiar JSON" copia
 * la fila con el formato del Import JSON del Channel (lib/videos.ts). Lee con el
 * cliente del navegador: el RLS (videos_select_admin) solo deja leer al admin.
 */
export default function VideosAdminPage() {
  const supabase = createClient();
  const [copiado, setCopiado] = useState<string | null>(null);

  const { data: videos = [], isLoading, isError } = useQuery({
    queryKey: ["admin-videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos_channel")
        .select("id, created_at, youtube_id, tracktitle, colaboracion, artist_link, ubicacion, tags, artistas(nombre)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const copiar = async (v: (typeof videos)[number]) => {
    const json = JSON.stringify(aJsonChannel({ ...v, artista_nombre: v.artistas?.nombre ?? "" }), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopiado(v.id);
      toast.success("JSON copiado");
      setTimeout(() => setCopiado((c) => (c === v.id ? null : c)), 2000);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  return (
    <div style={TEXTO}>
      <h1 style={{ ...TITULO, fontSize: "28px", color: "#111111" }}>Videos enviados</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-[#555555]">
        Lo que los artistas envían para MuzikChile TV. “Copiar JSON” copia el video con el formato del Import JSON del
        admin de tv.muzikchile.cl.
      </p>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl border border-[#e8e8e8] bg-[#f8f7f5]" />
      ) : isError ? (
        <p className="text-sm text-[#991b1b]">No pudimos cargar los videos.</p>
      ) : videos.length === 0 ? (
        <div className="rounded-xl border border-[#e8e8e8] bg-[#f8f7f5] py-14 text-center">
          <Clapperboard size={36} className="mx-auto mb-3 text-[#cccccc]" />
          <p className="text-sm text-[#666666]">Todavía no hay videos enviados.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {videos.map((v) => {
            const url = urlDeYoutube(v.youtube_id);
            return (
              <li key={v.id} className="rounded-xl border border-[#e8e8e8] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[#888888]">{fecha(v.created_at)}</p>
                    <p className="mt-0.5 text-base font-semibold text-[#111111]">{v.tracktitle}</p>
                    <p className="text-sm text-[#444444]">{textoArtista(v.artistas?.nombre ?? "—", v.colaboracion)}</p>
                  </div>
                  <button type="button" onClick={() => copiar(v)} className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#dddddd] px-3 py-2 text-sm font-semibold text-[#111111] hover:border-[#111111] sm:w-auto">
                    {copiado === v.id ? <Check size={14} /> : <Copy size={14} />} {copiado === v.id ? "Copiado" : "Copiar JSON"}
                  </button>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
                  <dt className="text-[#888888]">YouTube</dt>
                  <dd className="min-w-0 truncate"><a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#111111] underline">{url} <ExternalLink size={12} /></a></dd>
                  <dt className="text-[#888888]">Colaboración</dt>
                  <dd className="text-[#111111]">{v.colaboracion ?? "—"}</dd>
                  <dt className="text-[#888888]">Spotify</dt>
                  <dd className="min-w-0 truncate text-[#111111]">{v.artist_link ? <a href={v.artist_link} target="_blank" rel="noopener noreferrer" className="underline">{v.artist_link}</a> : "—"}</dd>
                  <dt className="text-[#888888]">Ciudad</dt>
                  <dd className="text-[#111111]">{v.ubicacion}</dd>
                  <dt className="text-[#888888]">Géneros</dt>
                  <dd className="text-[#111111]">{v.tags.length ? v.tags.join(", ") : "—"}</dd>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
