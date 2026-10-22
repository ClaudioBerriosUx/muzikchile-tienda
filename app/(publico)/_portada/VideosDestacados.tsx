"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { C, F, idYoutube, thumbYoutube, thumbYoutubeFallback, TEMA } from "@/lib/portada";
import { useSenal } from "./SenalProvider";

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
      <div
        className="w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative w-full rounded-lg overflow-hidden border"
          style={{ aspectRatio: "16 / 9", borderColor: TEMA.borde }}
        >
          <iframe
            src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`}
            title={video.tracktitle ?? "Video"}
            className="absolute inset-0 w-full h-full"
            style={{ border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />

          {/*
            Cerrar. Va DENTRO del contenedor del video (esquina del modal, no
            del viewport) y con z-20 para quedar sobre el iframe.

            44x44 es el mínimo táctil recomendado; antes medía 40 y tenía fondo
            blanco translúcido al 8%, que sobre el overlay negro al 92% no se
            distinguía — de ahí que pareciera que el botón no existía. Ahora es
            fondo oscuro con borde claro, que contrasta tanto sobre el video
            como sobre un thumbnail claro.
          */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar video"
            className="absolute top-3 right-3 z-20 w-11 h-11 rounded-full flex items-center justify-center transition-colors"
            style={{
              backgroundColor: "rgba(0,0,0,0.65)",
              border: "1px solid rgba(255,255,255,0.35)",
              color: C.blanco,
              backdropFilter: "blur(4px)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = C.rojo;
              e.currentTarget.style.borderColor = C.rojo;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.65)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)";
            }}
          >
            <X size={22} />
          </button>
        </div>

        <div className="mt-4">
          <p
            style={{
              fontFamily: F.body,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: C.blanco,
              fontSize: "18px",
            }}
          >
            {video.artist}
          </p>
          <p style={{ fontFamily: F.body, color: TEMA.texto2, fontSize: "14px" }}>
            {video.tracktitle}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

/**
 * Tarjeta del diseño de la portada (variante A): miniatura 16:9 con badge de
 * ciudad y botón play, artista en Anton y canción debajo.
 *
 * El play aparece en hover y también con foco de teclado; en pantallas
 * táctiles (sin hover) se ve siempre. El texto va en <span>, no en <h3>: un
 * heading no puede ir dentro de un <button>.
 */
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
      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-tema-borde bg-tema-superficie p-0 text-left transition-[transform,border-color,background-color] duration-200 hover:-translate-y-1 hover:border-tema-borde-campo hover:bg-tema-hover focus-visible:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tema-foco"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-tema-fondo">
        {src && (
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            // maxresdefault no existe para todos los videos: cae a hqdefault.
            onError={() => setSrc(thumbYoutubeFallback(id))}
          />
        )}

        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(22,22,22,0.6),rgba(22,22,22,0)_55%)]"
        />

        {video.ubicacion && (
          <span className="pointer-events-none absolute bottom-3.5 left-3.5 flex max-w-[calc(100%-84px)] items-center gap-[5px] rounded-md bg-tema-azul/90 px-[9px] py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-tema-texto">
            <svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="shrink-0">
              <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.4" />
            </svg>
            <span className="truncate">{video.ubicacion}</span>
          </span>
        )}

        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3.5 right-3.5 flex h-[42px] w-[42px] scale-[0.85] items-center justify-center rounded-full bg-tema-rojo opacity-0 shadow-[0_8px_24px_rgba(22,22,22,0.6)] transition-[opacity,transform,background-color] duration-200 group-hover:scale-100 group-hover:bg-tema-rojo-hover group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100 [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-tema-texto">
            <polygon points="7 4 20 12 7 20" />
          </svg>
        </span>
      </div>

      <span className="flex flex-col gap-1.5 px-[18px] pb-[18px] pt-4">
        <span className="font-heading text-[19px] leading-[1.14] tracking-[0.01em] text-tema-texto" style={{ fontWeight: 400 }}>
          {video.artist ?? "—"}
        </span>
        <span className="text-sm text-tema-texto-2" style={{ fontFamily: F.body }}>
          {video.tracktitle ?? ""}
        </span>
      </span>
    </button>
  );
}

// ── Sección ──────────────────────────────────────────────────────────────────

export default function VideosDestacados() {
  const [seleccionado, setSeleccionado] = useState<VideoChannel | null>(null);
  const { silenciar, restaurar } = useSenal();

  /**
   * Abrir/cerrar se manejan acá y no con un efecto sobre `seleccionado`:
   * llamar setState dentro de un efecto dispara renders en cascada
   * (react-hooks/set-state-in-effect).
   *
   * Todos los caminos de cierre del modal —botón, clic fuera y ESC— pasan por
   * su prop `onClose`, así que basta con envolverla una vez.
   */
  const abrir = (video: VideoChannel) => {
    setSeleccionado(video);
    silenciar();
  };

  const cerrar = () => {
    setSeleccionado(null);
    restaurar();
  };

  const { data: videos = [], isLoading, isError } = useQuery({
    queryKey: ["portada-videos-destacados"],
    queryFn: traerVideos,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const configurado = !!CHANNEL_URL && !!CHANNEL_KEY;

  return (
    <section
      style={{ backgroundColor: TEMA.fondo }}
      className="relative overflow-hidden px-5 pb-16 pt-4 md:px-10 md:pb-[88px]"
    >
      {/* Fondo: "VIDEOS" fantasma arriba a la derecha y halo azul a la izquierda. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none">
        <span
          className="absolute -right-5 -top-[30px] whitespace-nowrap font-heading leading-none"
          style={{
            fontSize: "clamp(120px, 20vw, 260px)",
            fontWeight: 400,
            letterSpacing: "0.02em",
            color: "transparent",
            WebkitTextStroke: "1px rgba(237,237,237,0.07)",
          }}
        >
          VIDEOS
        </span>
        <span
          className="absolute -left-[200px] top-[120px] h-[520px] w-[520px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(44,86,127,0.18) 0%, rgba(44,86,127,0) 68%)" }}
        />
      </div>

      <div className="relative mx-auto max-w-[1360px]">
        <div className="mb-7 flex items-center gap-3.5">
          <span aria-hidden="true" className="h-[34px] w-1 shrink-0 rounded-sm bg-tema-rojo" />
          <h2
            className="m-0 font-heading text-[38px] leading-none tracking-[0.01em] text-tema-texto"
            style={{ fontWeight: 400 }}
          >
            VIDEOS DESTACADOS
          </h2>
        </div>

        {!configurado ? (
          <p
            className="rounded-lg border p-6"
            style={{ borderColor: TEMA.borde, fontFamily: F.body, color: TEMA.texto3, fontSize: "14px" }}
          >
            Falta configurar <code>NEXT_PUBLIC_CHANNEL_SUPABASE_URL</code> y{" "}
            <code>NEXT_PUBLIC_CHANNEL_SUPABASE_ANON_KEY</code> para mostrar los videos del Channel.
          </p>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse overflow-hidden rounded-xl border border-tema-borde bg-tema-superficie"
              >
                <div className="aspect-video bg-tema-campo" />
                <div className="flex flex-col gap-2 px-[18px] pb-[18px] pt-4">
                  <div className="h-4 rounded bg-tema-campo" />
                  <div className="h-3 w-2/3 rounded bg-tema-campo" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <p style={{ fontFamily: F.body, color: TEMA.texto3, fontSize: "14px" }}>
            No se pudieron cargar los videos en este momento.
          </p>
        ) : videos.length === 0 ? (
          <p style={{ fontFamily: F.body, color: TEMA.texto3, fontSize: "14px" }}>
            Todavía no hay videos destacados.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} onSelect={() => abrir(v)} />
            ))}
          </div>
        )}
      </div>

      {seleccionado && (
        <VideoModal video={seleccionado} onClose={cerrar} />
      )}
    </section>
  );
}
