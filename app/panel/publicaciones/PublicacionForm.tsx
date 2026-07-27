"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/imagen";
import { sanitizarHtml } from "@/lib/sanitizar";
import EditorContenido from "@/components/contenido/EditorContenido";
import {
  CATEGORIAS_NOTICIA,
  CATEGORIA_VALUES,
  TITULAR_MAX,
  generarSlug,
} from "@/lib/publicaciones";

const schema = z.object({
  categoria: z.enum(CATEGORIA_VALUES, { message: "Selecciona una categoría" }),
  titular:   z.string()
               .min(1, "El titular es obligatorio")
               .max(TITULAR_MAX, `Máximo ${TITULAR_MAX} caracteres`),
  bajada:    z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
  cuerpo:    z.string().min(30, "Escribe al menos 30 caracteres"),
});

type FormData = z.infer<typeof schema>;

/** Estado al que se envía. El artista nunca puede escribir 'publicada' (lo bloquea el RLS). */
type EstadoDestino = "borrador" | "pendiente";

export interface PublicacionExistente {
  id: string;
  categoria: string | null;
  titular: string;
  bajada: string | null;
  cuerpo: string | null;
  imagen_url: string | null;
  slug: string;
  estado: string;
  comentario_moderacion: string | null;
}

interface Props {
  artistaId: string;
  /** Si viene, el formulario edita esa fila en vez de crear una nueva. */
  publicacion?: PublicacionExistente;
}

export default function PublicacionForm({ artistaId, publicacion }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const editando = !!publicacion;

  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState<EstadoDestino | null>(null);

  /**
   * El cuerpo que se le pasa al editor al montar. Se fija una sola vez: si
   * cambiara en cada tecleo, TipTap recrearía el documento y el cursor saltaría
   * al inicio.
   */
  const [cuerpoInicial] = useState(publicacion?.cuerpo ?? "");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      categoria: (publicacion?.categoria as FormData["categoria"]) ?? undefined,
      titular:   publicacion?.titular ?? "",
      bajada:    publicacion?.bajada ?? "",
      cuerpo:    publicacion?.cuerpo ?? "",
    },
  });

  const titular = watch("titular") ?? "";
  const restantes = TITULAR_MAX - titular.length;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxFiles: 1,
    multiple: false,
    onDrop: useCallback((accepted: File[]) => {
      if (accepted[0]) setArchivo(accepted[0]);
    }, []),
  });

  const previewNuevo = useMemo(
    () => (archivo ? URL.createObjectURL(archivo) : null),
    [archivo]
  );
  useEffect(() => {
    return () => { if (previewNuevo) URL.revokeObjectURL(previewNuevo); };
  }, [previewNuevo]);

  // Al editar se muestra la imagen ya guardada mientras no se suba otra.
  const preview = previewNuevo ?? publicacion?.imagen_url ?? null;

  const subirImagen = async (): Promise<string> => {
    if (!archivo) throw new Error("No hay imagen que subir");
    // 1200px: las noticias se muestran a ancho completo, no en grilla como los productos.
    const archivoFinal = await comprimirImagen(archivo, 1200, 0.85);
    // Mismo bucket que productos, subcarpeta propia.
    const path = `${artistaId}/publicaciones/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error } = await supabase.storage
      .from("productos")
      .upload(path, archivoFinal, { cacheControl: "3600", upsert: false });
    if (error) throw new Error(`Error subiendo la imagen: ${error.message}`);
    const { data: { publicUrl } } = supabase.storage.from("productos").getPublicUrl(path);
    return publicUrl;
  };

  const guardar = async (data: FormData, estado: EstadoDestino) => {
    if (!editando && !archivo) {
      toast.error("La imagen es obligatoria");
      return;
    }

    setEnviando(estado);
    try {
      const imagen_url = archivo ? await subirImagen() : publicacion!.imagen_url;

      /**
       * Se sanitiza ANTES de guardar, no solo al mostrar.
       *
       * ⚠️ Esto NO es la barrera de seguridad: corre en el navegador, y quien
       * quiera saltárselo puede escribir directo a PostgREST con su token. La
       * defensa real sigue siendo la sanitización del renderizador, que corre
       * en el servidor y no se puede evitar.
       *
       * Sirve igual: evita guardar basura por un pegado desde Word o desde otra
       * página, y deja la base limpia.
       */
      const cuerpoLimpio = sanitizarHtml(data.cuerpo);

      if (editando) {
        const { error } = await supabase
          .from("publicaciones")
          .update({
            categoria: data.categoria,
            titular:   data.titular,
            bajada:    data.bajada || null,
            cuerpo:    cuerpoLimpio,
            imagen_url,
            estado,
            // El slug NO se regenera: la URL pública de la publicación no debe
            // cambiar porque se corrigió el titular.
          })
          .eq("id", publicacion!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("publicaciones").insert({
          artista_id:  artistaId,
          tipo:        "noticia",
          categoria:   data.categoria,
          titular:     data.titular,
          bajada:      data.bajada || null,
          cuerpo:      cuerpoLimpio,
          imagen_url,
          slug:        generarSlug(data.titular),
          estado,
          visibilidad: "publica",
        });
        if (error) throw error;
      }

      toast.success(
        estado === "borrador"
          ? "Borrador guardado"
          : "Enviada a revisión. Te avisaremos cuando la revisemos."
      );
      queryClient.invalidateQueries({ queryKey: ["panel-publicaciones"] });
      router.push("/panel/publicaciones");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar la publicación");
    } finally {
      setEnviando(null);
    }
  };

  const inputClass =
    "w-full rounded-md px-3 py-2.5 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none transition-colors";
  const labelClass = "block text-sm mb-1.5";
  const labelStyle = { fontFamily: "var(--font-body)", color: "#444444" };
  const fieldStyle = { fontFamily: "var(--font-body)", color: "#111111" };

  const errorEl = (msg?: string) =>
    msg ? (
      <p className="text-xs mt-1" style={{ fontFamily: "var(--font-body)", color: "#e8003d" }}>
        {msg}
      </p>
    ) : null;

  return (
    <form noValidate>
      {/* Feedback del admin cuando la publicación fue devuelta */}
      {publicacion?.estado === "devuelta" && publicacion.comentario_moderacion && (
        <div
          className="mb-6 rounded-lg border p-4"
          style={{ backgroundColor: "#fff7ed", borderColor: "#fed7aa" }}
        >
          <p
            className="mb-1"
            style={{ fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: 600, color: "#9a3412" }}
          >
            Qué hay que corregir
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#7c2d12", lineHeight: 1.6 }}>
            {publicacion.comentario_moderacion}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Columna izquierda ── */}
        <div className="flex flex-col gap-5">
          {/* Categoría */}
          <div>
            <label className={labelClass} style={labelStyle}>Categoría</label>
            <select {...register("categoria")} className={inputClass} style={fieldStyle}>
              <option value="">Selecciona una categoría</option>
              {CATEGORIAS_NOTICIA.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {errorEl(errors.categoria?.message)}
          </div>

          {/* Titular */}
          <div>
            <label className={labelClass} style={labelStyle}>
              Titular
              <span
                className="float-right text-xs"
                style={{ color: restantes < 0 ? "#e8003d" : restantes <= 10 ? "#f59e0b" : "#999999" }}
              >
                {restantes >= 0 ? `Quedan ${restantes}` : `${Math.abs(restantes)} de más`}
              </span>
            </label>
            <input
              {...register("titular")}
              maxLength={TITULAR_MAX}
              className={inputClass}
              style={fieldStyle}
              placeholder="Ej: Nuevo single de la banda"
            />
            {errorEl(errors.titular?.message)}
          </div>

          {/* Bajada */}
          <div>
            <label className={labelClass} style={labelStyle}>
              Bajada <span style={{ color: "#999999" }}>(opcional)</span>
            </label>
            <textarea
              {...register("bajada")}
              rows={2}
              maxLength={200}
              className={`${inputClass} resize-none`}
              style={fieldStyle}
              placeholder="Un resumen de una o dos líneas"
            />
            {errorEl(errors.bajada?.message)}
          </div>

          {/* Cuerpo */}
          <div>
            <label className={labelClass} style={labelStyle}>Contenido</label>
            {/*
              El editor no es un <input>, así que no se registra con
              `register()`: se controla con setValue. `shouldValidate` mantiene
              vivo el mensaje de error mientras se escribe.
            */}
            <EditorContenido
              valor={cuerpoInicial}
              placeholder="Cuenta la noticia..."
              onChange={(html) =>
                setValue("cuerpo", html, { shouldValidate: true, shouldDirty: true })
              }
            />
            {errorEl(errors.cuerpo?.message)}
          </div>
        </div>

        {/* ── Columna derecha ── */}
        <div className="flex flex-col gap-5">
          <div>
            <label className={labelClass} style={labelStyle}>
              Imagen {!editando && <span style={{ color: "#e8003d" }}>*</span>}
            </label>

            <div
              {...getRootProps()}
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors"
              style={{
                borderColor: isDragActive ? "#e8003d" : "#e8e8e8",
                backgroundColor: isDragActive ? "#fff5f5" : "#f8f7f5",
              }}
            >
              <input {...getInputProps()} />
              <Upload size={24} className="mx-auto mb-2 text-[#cccccc]" />
              <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#666666" }}>
                {isDragActive
                  ? "Suelta la imagen aquí"
                  : preview
                    ? "Arrastra otra imagen para reemplazarla"
                    : "Arrastra tu imagen aquí o haz click"}
              </p>
            </div>

            <div
              style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#999999", marginTop: "6px", lineHeight: 1.5 }}
            >
              📐 Se redimensiona a 1200 px de ancho<br />
              📁 Formatos: JPG, PNG, WEBP<br />
              🖼️ Una imagen, la portada de la noticia
            </div>

            {preview && (
              <div className="relative mt-3 rounded-lg overflow-hidden border border-[#e8e8e8]">
                <img src={preview} alt="Portada" className="w-full object-cover" style={{ maxHeight: "260px" }} />
                {archivo && (
                  <button
                    type="button"
                    onClick={() => setArchivo(null)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: "rgba(17,17,17,0.7)" }}
                    aria-label="Quitar imagen"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Envío */}
      <div className="mt-8 pt-8 border-t border-[#e8e8e8] flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleSubmit((d) => guardar(d, "borrador"))}
          disabled={enviando !== null}
          className="h-12 px-6 rounded-md border font-semibold transition-colors"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "15px",
            borderColor: "#111111",
            color: "#111111",
            backgroundColor: "#ffffff",
            cursor: enviando ? "not-allowed" : "pointer",
            opacity: enviando ? 0.6 : 1,
          }}
        >
          {enviando === "borrador" ? "Guardando..." : "Guardar borrador"}
        </button>

        <button
          type="button"
          onClick={handleSubmit((d) => guardar(d, "pendiente"))}
          disabled={enviando !== null}
          className="flex-1 h-12 rounded-md text-white font-semibold transition-colors"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "16px",
            backgroundColor: enviando ? "#f0a0b0" : "#e8003d",
            cursor: enviando ? "not-allowed" : "pointer",
          }}
        >
          {enviando === "pendiente" ? "Enviando..." : "Enviar a revisión"}
        </button>
      </div>

      <p
        className="mt-3"
        style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#999999" }}
      >
        Un borrador solo lo ves tú. Al enviar a revisión, el equipo la revisa antes
        de publicarla.
      </p>
    </form>
  );
}
