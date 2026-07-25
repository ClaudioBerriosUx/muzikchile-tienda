"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, X, MapPin } from "lucide-react";
import { C, F, idYoutube, thumbYoutube, thumbYoutubeFallback } from "@/lib/portada";

/**
 * Los videos viven en el Supabase del CHANNEL, que es otro proyecto. Se leen
 * por REST con su anon key pública; no se instancia un segundo cliente de
 * supabase-js para no arrastrar dos sesiones de auth en el mismo navegador.
 */
const CHANNEL_URL = process.env.NEXT_PUBLIC_CHANNEL_SUPABASE_URL;
const CHANNEL_KEY = process.env.NEXT_PUBLIC_CHANNEL_SUPABASE_ANON_KEY;

interface VideoChannel {
  id: string;
  artist: string | null;
  tracktitle: string | null;
  videourl: string | null;
  ubicacion: string | null;
}

async function traerVideos(): Promise<VideoChannel[]> {
  if (!CHANNEL_URL || !CHANNEL_KEY) return [];

  const params = new URLSearchParams({
    select: "id,artist,tracktitle,videourl,ubicacion",
    destacado: "eq.true",
    estado: "eq.active",
    order: "created_at.desc",
    limit: "15",
  });

  const res = await fetch(`${CHANNEL_URL}/rest/v1/videos?${params}`, {
    headers: { apikey: CHANNEL_KEY, Authorization: `Bearer ${CHANNEL_KEY}` },
  });
  if (!res.ok) throw new Error(`Channel respondió ${res.status}`);
  return res.json();
}

// ── Modal ────────────────────────────────────────────────────────────────────

function VideoModal({
  video,
  onClose,
}: {
  video: VideoChannel;
  onClose: () => void;
}) {
  const id = idYoutube(video.videourl);

  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", alPresionar);
    // Evita que la página de atrás siga scrolleando con el modal abierto.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alPresionar);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onClose]);

  if (!id) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${video.artist ?? ""} — ${video.tracktitle ?? "video"}`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-4 right-4 w-10 h-10 rounded-md flex items-center justify-center transition-colors"
        style={{ backgroundColor: "rgba(255,255,255,0.08)", color: C.blanco }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = C.rojo)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)")}
      >
        <X size={20} />
      </button>

      <div
        className="w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative w-full rounded-lg overflow-hidden border"
          style={{ aspectRatio: "16 / 9", borderColor: C.borde }}
        >
          <iframe
            src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`}
            title={video.tracktitle ?? "Video"}
            className="absolute inset-0 w-full h-full"
            style={{ border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div className="mt-4">
          <p
            style={{
              fontFamily: F.barlowC,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: C.blanco,
              fontSize: "18px",
            }}
          >
            {video.artist}
          </p>
          <p style={{ fontFamily: F.dmSans, color: C.gris, fontSize: "14px" }}>
            {video.tracktitle}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

function VideoCard({
  video,
  onSelect,
}: {
  video: VideoChannel;
  onSelect: () => void;
}) {
  const id = idYoutube(video.videourl);
  const [src, setSrc] = useState(id ? thumbYoutube(id) : null);

  if (!id) return null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group text-left rounded-lg overflow-hidden border transition-all duration-200 hover:-translate-y-1"
      style={{ borderColor: C.borde, backgroundColor: C.negroSuave }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = C.rojo;
        e.currentTarget.style.boxShadow = "0 10px 30px -10px rgba(204,0,0,0.55)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.borde;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Thumbnail + overlay */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
        {src && (
          <img
            src={src}
            alt={`${video.artist ?? ""} — ${video.tracktitle ?? ""}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            // maxresdefault no existe para todos los videos: cae a hqdefault.
            onError={() => setSrc(thumbYoutubeFallback(id))}
          />
        )}

        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <span
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: C.rojo }}
          >
            <Play size={22} fill="white" color="white" />
          </span>
        </div>
      </div>

      {/* Datos */}
      <div className="p-4">
        <p
          className="truncate"
          style={{
            fontFamily: F.barlowC,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontSize: "17px",
            color: C.blanco,
          }}
        >
          {video.artist ?? "—"}
        </p>
        <p
          className="truncate mt-0.5"
          style={{ fontFamily: F.dmSans, fontSize: "13px", color: C.gris }}
        >
          {video.tracktitle ?? ""}
        </p>

        {video.ubicacion && (
          <span
            className="inline-flex items-center gap-1 mt-3 px-2 py-0.5 rounded-full border"
            style={{
              borderColor: C.rojo,
              color: C.rojoClaro,
              fontFamily: F.barlowC,
              fontSize: "12px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <MapPin size={10} />
            {video.ubicacion}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Sección ──────────────────────────────────────────────────────────────────

export default function VideosDestacados() {
  const [seleccionado, setSeleccionado] = useState<VideoChannel | null>(null);

  const { data: videos = [], isLoading, isError } = useQuery({
    queryKey: ["portada-videos-destacados"],
    queryFn: traerVideos,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const configurado = !!CHANNEL_URL && !!CHANNEL_KEY;

  return (
    <section style={{ backgroundColor: C.negro }} className="py-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2
          className="pl-4 mb-8"
          style={{
            fontFamily: F.bebas,
            fontSize: "38px",
            letterSpacing: "0.04em",
            color: C.blanco,
            borderLeft: `4px solid ${C.rojo}`,
            lineHeight: 1.1,
          }}
        >
          VIDEOS DESTACADOS
        </h2>

        {!configurado ? (
          <p
            className="rounded-lg border p-6"
            style={{ borderColor: C.borde, fontFamily: F.dmSans, color: C.grisTenue, fontSize: "14px" }}
          >
            Falta configurar <code>NEXT_PUBLIC_CHANNEL_SUPABASE_URL</code> y{" "}
            <code>NEXT_PUBLIC_CHANNEL_SUPABASE_ANON_KEY</code> para mostrar los videos del Channel.
          </p>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg overflow-hidden border animate-pulse"
                style={{ borderColor: C.borde, backgroundColor: C.negroSuave }}
              >
                <div style={{ aspectRatio: "16 / 9", backgroundColor: "#141414" }} />
                <div className="p-4 flex flex-col gap-2">
                  <div className="h-4 rounded" style={{ backgroundColor: "#141414" }} />
                  <div className="h-3 rounded w-2/3" style={{ backgroundColor: "#141414" }} />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <p style={{ fontFamily: F.dmSans, color: C.grisTenue, fontSize: "14px" }}>
            No se pudieron cargar los videos en este momento.
          </p>
        ) : videos.length === 0 ? (
          <p style={{ fontFamily: F.dmSans, color: C.grisTenue, fontSize: "14px" }}>
            Todavía no hay videos destacados.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} onSelect={() => setSeleccionado(v)} />
            ))}
          </div>
        )}
      </div>

      {seleccionado && (
        <VideoModal video={seleccionado} onClose={() => setSeleccionado(null)} />
      )}
    </section>
  );
}
