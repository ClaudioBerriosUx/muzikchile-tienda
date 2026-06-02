"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, ExternalLink } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { REGIONES_CHILE, BANCOS_CHILE } from "@/lib/constants";
import ColorPicker from "@/components/ui/ColorPicker";

const TIPOS_CUENTA = ["Cuenta Corriente", "Cuenta Vista", "Cuenta de Ahorro", "Cuenta RUT"];

const REDES_CONFIG = [
  {
    key: "instagram" as const,
    label: "Instagram",
    placeholder: "@nombre_de_usuario",
    hint: "Solo el nombre de usuario, sin @. Ej: camilamoreno_oficial",
  },
  {
    key: "spotify" as const,
    label: "Spotify",
    placeholder: "https://open.spotify.com/artist/...",
    hint: "Pega el link de tu perfil de Spotify. Se mostrará un botón para escucharte.",
    badge: "🔗 Próximamente: Conectar con Spotify",
  },
  {
    key: "youtube" as const,
    label: "YouTube",
    placeholder: "https://youtube.com/@canal",
    hint: "Link a tu canal de YouTube",
  },
  {
    key: "tiktok" as const,
    label: "TikTok",
    placeholder: "@nombre_de_usuario",
    hint: "Solo el nombre de usuario, sin @",
  },
  {
    key: "soundcloud" as const,
    label: "SoundCloud",
    placeholder: "https://soundcloud.com/tu-perfil",
    hint: "Link a tu perfil de SoundCloud",
  },
];

function slugify(texto: string) {
  return texto.toLowerCase()
    .replace(/[áàäâã]/g, "a").replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i").replace(/[óòöôõ]/g, "o")
    .replace(/[úùüû]/g, "u").replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const schema = z.object({
  nombre:          z.string().min(2, "Mínimo 2 caracteres"),
  slug:            z.string().min(2, "Mínimo 2 caracteres").regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  bio:             z.string().max(160, "Máximo 160 caracteres").optional().or(z.literal("")),
  bio_completa:    z.string().max(2000).optional().or(z.literal("")),
  ciudad:          z.string().optional().or(z.literal("")),
  region:          z.string().optional().or(z.literal("")),
  color_acento:    z.string().optional(),
  generos:         z.string().optional().or(z.literal("")),
  instagram:       z.string().optional().or(z.literal("")),
  spotify:         z.string().optional().or(z.literal("")),
  youtube:         z.string().optional().or(z.literal("")),
  tiktok:          z.string().optional().or(z.literal("")),
  soundcloud:      z.string().optional().or(z.literal("")),
  facebook:        z.string().optional().or(z.literal("")),
  seo_titulo:      z.string().max(60, "Máximo 60 caracteres").optional().or(z.literal("")),
  seo_descripcion: z.string().max(160, "Máximo 160 caracteres").optional().or(z.literal("")),
  banco:           z.string().optional().or(z.literal("")),
  rut:             z.string().optional().or(z.literal("")),
  tipo_cuenta:     z.string().optional().or(z.literal("")),
  cuenta_bancaria: z.string().optional().or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

interface Artista {
  id: string;
  user_id: string;
  nombre: string;
  slug: string;
  foto_url?: string;
  bio?: string;
  bio_completa?: string;
  ciudad?: string;
  region?: string;
  color_acento?: string;
  redes_sociales?: Record<string, string>;
  generos?: string[];
  seo_titulo?: string;
  seo_descripcion?: string;
  banco?: string;
  rut?: string;
  tipo_cuenta?: string;
  cuenta_bancaria?: string;
}

const hintStyle: React.CSSProperties = {
  fontFamily: "Barlow, sans-serif",
  fontSize: "12px",
  color: "#999999",
  marginTop: "6px",
  lineHeight: 1.5,
};

export default function PerfilPage() {
  const supabase    = createClient();
  const queryClient = useQueryClient();
  const fotoRef     = useRef<HTMLInputElement>(null);

  const [fotoPreview,  setFotoPreview]  = useState<string | null>(null);
  const [fotoArchivo,  setFotoArchivo]  = useState<File | null>(null);
  const [colorAccento, setColorAccento] = useState("#e8003d");
  const [guardando,    setGuardando]    = useState(false);

  const { data: artista, isLoading } = useQuery<Artista | null>({
    queryKey: ["panel-artista"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("artistas").select("*").eq("user_id", user.id).single();
      return data as Artista | null;
    },
  });

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const nombreWatch    = watch("nombre", "");
  const bioWatch       = watch("bio", "");
  const seoTituloWatch = watch("seo_titulo", "");
  const seoDescWatch   = watch("seo_descripcion", "");

  useEffect(() => {
    if (!artista) return;
    const redes = artista.redes_sociales ?? {};
    reset({
      nombre:          artista.nombre ?? "",
      slug:            artista.slug ?? "",
      bio:             artista.bio ?? "",
      bio_completa:    artista.bio_completa ?? "",
      ciudad:          artista.ciudad ?? "",
      region:          artista.region ?? "",
      color_acento:    artista.color_acento ?? "#e8003d",
      generos:         (artista.generos ?? []).join(", "),
      instagram:       redes.instagram ?? "",
      spotify:         redes.spotify ?? "",
      youtube:         redes.youtube ?? "",
      tiktok:          redes.tiktok ?? "",
      soundcloud:      redes.soundcloud ?? "",
      facebook:        redes.facebook ?? "",
      seo_titulo:      artista.seo_titulo ?? "",
      seo_descripcion: artista.seo_descripcion ?? "",
      banco:           artista.banco ?? "",
      rut:             artista.rut ?? "",
      tipo_cuenta:     artista.tipo_cuenta ?? "",
      cuenta_bancaria: artista.cuenta_bancaria ?? "",
    });
    setColorAccento(artista.color_acento ?? "#e8003d");
    if (artista.foto_url) setFotoPreview(artista.foto_url);
  }, [artista, reset]);

  const autoSlug = () => {
    if (!artista?.slug) setValue("slug", slugify(nombreWatch));
  };

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoArchivo(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const onSubmit = async (data: FormData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sin sesión"); return; }

    setGuardando(true);
    try {
      let fotoUrl = artista?.foto_url ?? null;

      if (fotoArchivo) {
        const ext  = fotoArchivo.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/foto.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("artistas").upload(path, fotoArchivo, { upsert: true });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from("artistas").getPublicUrl(path);
        fotoUrl = publicUrl;
      }

      const esUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(artista?.slug ?? "");
      let slugFinal = data.slug;

      if (esUUID) {
        const base = slugify(data.nombre);
        let candidato = base;
        let n = 2;
        while (true) {
          const { data: ocupado } = await supabase
            .from("artistas")
            .select("id")
            .eq("slug", candidato)
            .neq("id", artista?.id ?? "")
            .single();
          if (!ocupado) { slugFinal = candidato; break; }
          candidato = `${base}-${n++}`;
        }
        setValue("slug", slugFinal);
      }

      const redes_sociales = Object.fromEntries(
        ["instagram", "spotify", "youtube", "tiktok", "soundcloud", "facebook"]
          .map((key) => [key, (data as Record<string, string>)[key] ?? ""])
          .filter(([, v]) => v)
      );

      const payload = {
        user_id:         user.id,
        nombre:          data.nombre,
        slug:            slugFinal,
        bio:             data.bio || null,
        bio_completa:    data.bio_completa || null,
        ciudad:          data.ciudad || null,
        region:          data.region || null,
        color_acento:    colorAccento,
        redes_sociales,
        foto_url:        fotoUrl,
        generos:         data.generos ? data.generos.split(",").map((s) => s.trim()).filter(Boolean) : null,
        seo_titulo:      data.seo_titulo || null,
        seo_descripcion: data.seo_descripcion || null,
        banco:           data.banco || null,
        rut:             data.rut || null,
        tipo_cuenta:     data.tipo_cuenta || null,
        cuenta_bancaria: data.cuenta_bancaria || null,
      };

      if (artista?.id) {
        const { error } = await supabase.from("artistas").update(payload).eq("id", artista.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("artistas").insert(payload);
        if (error) throw error;
      }

      toast.success("Perfil guardado");
      queryClient.invalidateQueries({ queryKey: ["panel-artista"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const inputClass = "w-full rounded-md px-3 py-2.5 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none transition-colors";
  const labelEl = (txt: string) => (
    <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#666666", display: "block", marginBottom: "5px" }}>
      {txt}
    </label>
  );
  const errEl = (msg?: string) => msg ? (
    <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#e8003d", marginTop: "3px" }}>{msg}</p>
  ) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Cargando perfil...</p>
      </div>
    );
  }

  const fotoActual = fotoPreview ?? artista?.foto_url;
  const inicial    = (artista?.nombre ?? "A")[0].toUpperCase();

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <h1 style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", fontWeight: "700", color: "#111111" }}>
          Mi perfil
        </h1>
        {artista?.slug && (
          <Link
            href={`/artista/${artista.slug}`}
            target="_blank"
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#e8003d")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
          >
            <ExternalLink size={14} /> Ver mi tienda
          </Link>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">

        {/* ── Foto + datos básicos ── */}
        <section className="flex gap-6 items-start p-6 rounded-xl border border-[#e8e8e8] bg-white">
          <div className="shrink-0 flex flex-col items-center gap-2">
            <div
              className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center text-white text-3xl font-bold cursor-pointer relative group"
              style={{ backgroundColor: colorAccento, fontFamily: "Oswald, sans-serif" }}
              onClick={() => fotoRef.current?.click()}
            >
              {fotoActual ? (
                <img src={fotoActual} alt="Foto" className="w-full h-full object-cover" />
              ) : inicial}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                <Camera size={20} className="text-white" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => fotoRef.current?.click()}
              className="text-xs transition-colors"
              style={{ fontFamily: "Barlow, sans-serif", color: "#e8003d" }}
            >
              Cambiar foto
            </button>
            <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
            <p style={{ ...hintStyle, marginTop: "4px", textAlign: "center" }}>
              📐 400 × 400 px<br />
              📁 JPG, PNG, WEBP<br />
              ⚖️ Máx. 2 MB
            </p>
          </div>

          <div className="flex-1 flex flex-col gap-4">
            <div>
              {labelEl("Nombre artístico *")}
              <input
                {...register("nombre")}
                onBlur={autoSlug}
                className={inputClass}
                style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
                placeholder="Tu nombre de artista"
              />
              {errEl(errors.nombre?.message)}
            </div>
            <div>
              {labelEl("URL de tu tienda (slug)")}
              <div className="flex items-center rounded-md border border-[#e8e8e8] overflow-hidden focus-within:border-[#e8003d] transition-colors">
                <span className="px-3 py-2.5 text-sm bg-[#f8f7f5] border-r border-[#e8e8e8] shrink-0"
                  style={{ fontFamily: "Barlow, sans-serif", color: "#999999" }}>
                  tienda.muzikchile.cl/artista/
                </span>
                <input
                  {...register("slug")}
                  className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                  style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
                />
              </div>
              {errEl(errors.slug?.message)}
            </div>
          </div>
        </section>

        {/* ── Información pública ── */}
        <section className="p-6 rounded-xl border border-[#e8e8e8] bg-white flex flex-col gap-5">
          <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: "16px", fontWeight: "600", color: "#111111", marginBottom: "-4px" }}>
            Información pública
          </h2>

          <div>
            {labelEl(`Bio corta (${(bioWatch ?? "").length}/160 — aparece en el catálogo)`)}
            <textarea
              {...register("bio")}
              rows={2}
              maxLength={160}
              className={`${inputClass} resize-none`}
              style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
              placeholder="Una frase que te describe..."
            />
            {errEl(errors.bio?.message)}
          </div>

          <div>
            {labelEl("Biografía completa")}
            <textarea
              {...register("bio_completa")}
              rows={5}
              className={`${inputClass} resize-none`}
              style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
              placeholder="Cuéntale a tus fans quién eres..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              {labelEl("Ciudad")}
              <input {...register("ciudad")} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }} placeholder="Santiago" />
            </div>
            <div>
              {labelEl("Región")}
              <select {...register("region")} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}>
                <option value="">Selecciona tu región</option>
                {REGIONES_CHILE.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div>
            {labelEl("Géneros musicales")}
            <input
              {...register("generos")}
              className={inputClass}
              style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
              placeholder="Ej: Indie folk, Nueva Canción, Acústico"
            />
            <p style={hintStyle}>Separa los géneros con comas. Ayuda a que te descubran más fácil.</p>
          </div>

          <div>
            {labelEl("Color de acento (aparece en tu perfil)")}
            <ColorPicker
              valor={colorAccento}
              onChange={(c) => { setColorAccento(c); setValue("color_acento", c); }}
            />
          </div>
        </section>

        {/* ── Redes sociales ── */}
        <section className="p-6 rounded-xl border border-[#e8e8e8] bg-white flex flex-col gap-5">
          <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: "16px", fontWeight: "600", color: "#111111", marginBottom: "-4px" }}>
            Redes sociales
          </h2>
          {REDES_CONFIG.map(({ key, label: lbl, placeholder, hint, badge }) => (
            <div key={key}>
              {labelEl(lbl)}
              <input
                {...register(key as keyof FormData)}
                className={inputClass}
                style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
                placeholder={placeholder}
              />
              <p style={hintStyle}>{hint}</p>
              {badge && (
                <span style={{
                  fontFamily: "Barlow, sans-serif",
                  fontSize: "11px",
                  color: "#aaaaaa",
                  backgroundColor: "#f0f0f0",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  marginTop: "6px",
                  display: "inline-block",
                  cursor: "default",
                }}>
                  {badge}
                </span>
              )}
            </div>
          ))}
        </section>

        {/* ── SEO ── */}
        <section className="p-6 rounded-xl border border-[#e8e8e8] bg-white flex flex-col gap-5">
          <div>
            <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: "16px", fontWeight: "600", color: "#111111" }}>
              SEO de tu perfil
            </h2>
            <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#999999", marginTop: "2px" }}>
              Ayuda a que tus fans te encuentren en Google
            </p>
          </div>

          <div>
            {labelEl("Título para Google")}
            <input
              {...register("seo_titulo")}
              maxLength={60}
              className={inputClass}
              style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
              placeholder={`Ej: ${artista?.nombre ?? "Tu nombre"} | Merch oficial`}
            />
            <div className="flex items-start justify-between mt-1.5">
              <p style={{ ...hintStyle, marginTop: 0 }}>
                Aparece en Google como título de tu página. Si está vacío, se genera como &quot;[Nombre] | Merch en MuzikChile&quot;.
              </p>
              <span style={{
                fontFamily: "Barlow, sans-serif",
                fontSize: "12px",
                color: (seoTituloWatch?.length ?? 0) >= 60 ? "#e8003d" : "#999999",
                whiteSpace: "nowrap",
                marginLeft: "8px",
                flexShrink: 0,
              }}>
                {seoTituloWatch?.length ?? 0}/60
              </span>
            </div>
            {errEl(errors.seo_titulo?.message)}
          </div>

          <div>
            {labelEl("Descripción para Google")}
            <textarea
              {...register("seo_descripcion")}
              maxLength={160}
              rows={3}
              className={`${inputClass} resize-none`}
              style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
              placeholder="Ej: Compra merch oficial de Camila Moreno. Poleras, vinilos y más desde Santiago."
            />
            <div className="flex items-start justify-between mt-1.5">
              <p style={{ ...hintStyle, marginTop: 0 }}>
                Aparece debajo del título en Google. Si está vacío, se usa la bio. Máximo 160 caracteres.
              </p>
              <span style={{
                fontFamily: "Barlow, sans-serif",
                fontSize: "12px",
                color: (seoDescWatch?.length ?? 0) >= 160 ? "#e8003d" : "#999999",
                whiteSpace: "nowrap",
                marginLeft: "8px",
                flexShrink: 0,
              }}>
                {seoDescWatch?.length ?? 0}/160
              </span>
            </div>
            {errEl(errors.seo_descripcion?.message)}
          </div>
        </section>

        {/* ── Datos bancarios ── */}
        <section className="p-6 rounded-xl border border-[#e8e8e8] bg-white flex flex-col gap-4">
          <div>
            <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: "16px", fontWeight: "600", color: "#111111" }}>
              Datos bancarios
            </h2>
            <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#999999", marginTop: "2px" }}>
              Necesarios para recibir tus pagos. No son públicos.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              {labelEl("Banco")}
              <select {...register("banco")} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}>
                <option value="">Selecciona tu banco</option>
                {BANCOS_CHILE.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              {labelEl("RUT")}
              <input {...register("rut")} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }} placeholder="12.345.678-9" />
            </div>
            <div>
              {labelEl("Tipo de cuenta")}
              <select {...register("tipo_cuenta")} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}>
                <option value="">Selecciona tipo</option>
                {TIPOS_CUENTA.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              {labelEl("N° de cuenta")}
              <input {...register("cuenta_bancaria")} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }} placeholder="00000000000" />
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="pb-4">
          <button
            type="submit"
            disabled={guardando}
            className="h-11 px-10 rounded-md text-white font-semibold transition-colors"
            style={{
              fontFamily: "Barlow, sans-serif",
              fontSize: "15px",
              backgroundColor: guardando ? "#f0a0b0" : "#e8003d",
              cursor: guardando ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => { if (!guardando) e.currentTarget.style.backgroundColor = "#c5002e"; }}
            onMouseLeave={(e) => { if (!guardando) e.currentTarget.style.backgroundColor = "#e8003d"; }}
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
