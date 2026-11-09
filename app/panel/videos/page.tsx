"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  errorTags, idDeYoutube, MAX_LARGO_TAG, MAX_TAGS, MAX_TITULO, MAX_UBICACION, limpiarSpotify, normalizarTags, textoArtista,
} from "@/lib/videos";

const F = { titulo: "var(--font-titulo)", body: "var(--font-body)" };
const etiqueta = "block mb-1.5 text-sm font-semibold text-[#111111]";
const campo = "w-full rounded-md border border-[#dddddd] bg-white px-3 py-2 text-sm text-[#111111] outline-none focus:border-[#e8003d]";
const ayuda = "mt-1 text-xs text-[#666666]";

/**
 * "Enviar video" para MuzikChile TV. Cualquier artista con cuenta, tenga o no
 * tienda. Inserta directo con su sesión: el RLS solo deja envíos propios y los
 * CHECK de la base exigen el formato (migración 20261108050000).
 */
export default function EnviarVideoPage() {
  const supabase = createClient();
  const { data: artista, isLoading } = useQuery({
    queryKey: ["panel-artista-videos"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("artistas").select("id, nombre, ciudad, redes").eq("user_id", user.id).maybeSingle();
      return data ?? null;
    },
  });

  return (
    <div style={{ fontFamily: F.body }}>
      <h1 className="mb-2" style={{ fontFamily: F.titulo, fontSize: "28px", color: "#111111" }}>Enviar video</h1>
      <p className="mb-8 max-w-2xl text-sm text-[#555555]">
        Envía tu videoclip oficial para MuzikChile TV, el canal de la comunidad en tv.muzikchile.cl.
      </p>
      {isLoading ? (
        <div className="h-64 animate-pulse rounded-xl border border-[#e8e8e8] bg-[#f8f7f5]" />
      ) : !artista ? (
        <p className="text-sm text-[#991b1b]">No encontramos tu perfil de artista.</p>
      ) : (
        <FormVideo key={artista.id} artista={artista} />
      )}
    </div>
  );
}

interface Artista {
  id: string;
  nombre: string;
  ciudad: string | null;
  redes: unknown;
}

function spotifyDelPerfil(redes: unknown): string {
  const s = redes && typeof redes === "object" && "spotify" in redes && typeof redes.spotify === "string" ? redes.spotify : null;
  return limpiarSpotify(s) ?? "";
}

function FormVideo({ artista }: { artista: Artista }) {
  const supabase = createClient();
  const [f, setF] = useState({ url: "", titulo: "", colaboracion: "", spotify: spotifyDelPerfil(artista.redes), ciudad: artista.ciudad?.trim() ?? "" });
  const [tags, setTags] = useState<string[]>([]);
  const [tagTexto, setTagTexto] = useState("");
  const [derechos, setDerechos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const agregarTags = (entrada: string) => {
    const nuevos = normalizarTags([...tags, entrada]);
    setTags(nuevos);
    setTagTexto("");
    setErrores((e) => ({ ...e, tags: errorTags(nuevos) ?? "" }));
  };
  const quitarTag = (t: string) => {
    const nuevos = tags.filter((x) => x !== t);
    setTags(nuevos);
    setErrores((e) => ({ ...e, tags: errorTags(nuevos) ?? "" }));
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const youtube = idDeYoutube(f.url);
    const titulo = f.titulo.replace(/\s+/g, " ").trim();
    const colaboracion = f.colaboracion.replace(/\s+/g, " ").trim();
    const ciudad = f.ciudad.replace(/\s+/g, " ").trim();
    const spotify = limpiarSpotify(f.spotify);
    const todos = tagTexto.trim() ? normalizarTags([...tags, tagTexto]) : tags;

    const errs: Record<string, string> = {};
    if (!youtube) errs.url = "Pega el link de tu video en YouTube, por ejemplo https://www.youtube.com/watch?v=…";
    if (!titulo) errs.titulo = "Escribe el título de la canción.";
    if (!ciudad) errs.ciudad = "Escribe tu ciudad.";
    const et = errorTags(todos);
    if (et) errs.tags = et;
    if (!derechos) errs.derechos = "Tienes que confirmarlo para enviar.";
    setErrores(errs);
    if (!youtube || Object.keys(errs).length) return;

    setEnviando(true);
    const { error } = await supabase.from("videos_channel").insert({
      artista_id: artista.id,
      youtube_id: youtube,
      tracktitle: titulo,
      colaboracion: colaboracion || null,
      artist_link: spotify,
      ubicacion: ciudad,
      tags: todos,
      derechos_declarados: true,
    });
    setEnviando(false);
    if (error) {
      console.error("[enviar video]", error.code, error.message);
      toast.error("No pudimos enviar tu video. Revisa los datos e intenta de nuevo.");
      return;
    }
    // Ciudad y Spotify se quedan: el próximo video probablemente es del mismo proyecto.
    setF({ ...f, url: "", titulo: "", colaboracion: "" });
    setTags([]); setTagTexto(""); setDerechos(false);
    setEnviado(true);
  };

  const error = (k: string) => (errores[k] ? <p role="alert" className="mt-1 text-xs text-[#b91c1c]">{errores[k]}</p> : null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: e.target.value }); setEnviado(false); };

  return (
    <form onSubmit={enviar} noValidate className="max-w-3xl rounded-xl border border-[#e8e8e8] bg-white p-5 md:p-6">
      {enviado && (
        <p role="status" className="mb-5 flex items-center gap-2 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-sm font-semibold text-[#166534]">
          <CheckCircle2 size={16} /> ¡Tu video fue enviado!
        </p>
      )}

      {/* min-w-0: un link largo no ensancha la grilla en móvil. */}
      <fieldset disabled={enviando} className="grid min-w-0 gap-5 md:grid-cols-2 [&>*]:min-w-0">
        <div className="md:col-span-2">
          <label htmlFor="v-url" className={etiqueta}>Link de YouTube *</label>
          <input id="v-url" type="url" inputMode="url" className={campo} placeholder="https://www.youtube.com/watch?v=…" value={f.url} onChange={set("url")} aria-invalid={!!errores.url} />
          {error("url")}
        </div>

        <div>
          <label htmlFor="v-titulo" className={etiqueta}>Título de la canción *</label>
          <input id="v-titulo" className={campo} maxLength={MAX_TITULO} value={f.titulo} onChange={set("titulo")} aria-invalid={!!errores.titulo} />
          {error("titulo")}
        </div>

        <div>
          <span className={etiqueta}>Artista</span>
          <p className="truncate rounded-md border border-[#eeeeee] bg-[#f8f7f5] px-3 py-2 text-sm text-[#111111]">{textoArtista(artista.nombre, f.colaboracion)}</p>
          <p className={ayuda}>Sale de tu cuenta.</p>
        </div>

        <div>
          <label htmlFor="v-ft" className={etiqueta}>Colaboración (Ft.)</label>
          <input id="v-ft" className={campo} maxLength={200} placeholder="Opcional" value={f.colaboracion} onChange={set("colaboracion")} />
        </div>

        <div>
          <label htmlFor="v-ciudad" className={etiqueta}>Ciudad *</label>
          <input id="v-ciudad" className={campo} maxLength={MAX_UBICACION} value={f.ciudad} onChange={set("ciudad")} aria-invalid={!!errores.ciudad} />
          {error("ciudad")}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="v-spotify" className={etiqueta}>Tu página de artista en Spotify</label>
          <input id="v-spotify" type="text" inputMode="url" className={campo} maxLength={500} placeholder="Opcional: el link a tu perfil de artista" value={f.spotify} onChange={set("spotify")} />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="v-tags" className={etiqueta}>Géneros</label>
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-[#dddddd] bg-white px-2 py-1.5 focus-within:border-[#e8003d]">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded bg-[#f1f1f1] px-2 py-0.5 text-xs text-[#111111]">
                {t}
                <button type="button" onClick={() => quitarTag(t)} aria-label={`Quitar ${t}`} className="text-[#666666] hover:text-[#111111]"><X size={12} /></button>
              </span>
            ))}
            <input id="v-tags" className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm outline-none" placeholder={tags.length ? "" : "Escribe y presiona Enter o coma"}
              value={tagTexto} maxLength={MAX_LARGO_TAG * 2}
              onChange={(e) => (e.target.value.includes(",") ? agregarTags(e.target.value) : setTagTexto(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); if (tagTexto.trim()) agregarTags(tagTexto); }
                else if (e.key === "Backspace" && !tagTexto && tags.length) quitarTag(tags[tags.length - 1]);
              }} />
          </div>
          <p className={ayuda}>Hasta {MAX_TAGS}, de hasta {MAX_LARGO_TAG} caracteres.</p>
          {error("tags")}
        </div>

        <div className="md:col-span-2">
          <label className="flex items-start gap-2.5 text-sm text-[#111111]">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#e8003d]" checked={derechos} onChange={(e) => setDerechos(e.target.checked)} aria-invalid={!!errores.derechos} />
            <span>Es un videoclip oficial de mi proyecto y tengo los derechos para compartirlo. *</span>
          </label>
          {error("derechos")}
        </div>

        <div className="md:col-span-2">
          <button type="submit" className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#e8003d" }}>
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Enviar video
          </button>
        </div>
      </fieldset>
    </form>
  );
}
