"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { X, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const ZONAS = ["Chile", "Latinoamérica", "EE.UU.", "Europa", "Mundial"];

const schema = z.object({
  nombre:          z.string().min(3, "Mínimo 3 caracteres"),
  descripcion:     z.string().min(10, "Mínimo 10 caracteres").max(500, "Máximo 500 caracteres"),
  categoria_id:    z.string().uuid("Selecciona una categoría"),
  subcategoria_id: z.string().uuid().optional().or(z.literal("")),
  tipo:            z.enum(["fisico", "digital"]),
  precio:          z.number().min(1100, "Mínimo $1.100 CLP"),
  stock:           z.number().min(0).optional(),
  zonas_envio:     z.array(z.string()).min(1, "Selecciona al menos una zona"),
});

type FormData = z.infer<typeof schema>;

interface Categoria { id: string; nombre: string; slug: string }

export default function NuevoProductoPage() {
  const router = useRouter();
  const supabase = createClient();
  const [archivos, setArchivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);

  const { data: artista } = useQuery({
    queryKey: ["panel-artista"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("artistas").select("id, nombre").eq("user_id", user.id).single();
      return data ?? null;
    },
  });

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias").select("id, nombre, slug").is("padre_id", null).order("orden");
      return (data ?? []) as Categoria[];
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: "fisico", zonas_envio: [] },
  });

  const tipo = watch("tipo");
  const categoriaId = watch("categoria_id");
  const zonas = watch("zonas_envio") ?? [];
  const descripcion = watch("descripcion") ?? "";

  const { data: subcategorias = [] } = useQuery<Categoria[]>({
    queryKey: ["subcategorias", categoriaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias").select("id, nombre, slug").eq("padre_id", categoriaId);
      return (data ?? []) as Categoria[];
    },
    enabled: !!categoriaId,
  });

  // Si tipo digital → marcar todas las zonas y deshabilitar
  useEffect(() => {
    if (tipo === "digital") setValue("zonas_envio", [...ZONAS]);
  }, [tipo, setValue]);

  const toggleZona = (zona: string) => {
    if (tipo === "digital") return;
    const current = getValues("zonas_envio") ?? [];
    setValue(
      "zonas_envio",
      current.includes(zona) ? current.filter((z) => z !== zona) : [...current, zona],
      { shouldValidate: true }
    );
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxFiles: 5,
    onDrop: useCallback((accepted: File[]) => {
      setArchivos((prev) => [...prev, ...accepted].slice(0, 5));
    }, []),
  });

  const previews = useMemo(() => archivos.map((f) => URL.createObjectURL(f)), [archivos]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  const quitarImagen = (idx: number) => {
    setArchivos((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadImages = async (artista_id: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const archivo of archivos) {
      const ext = archivo.name.split(".").pop() ?? "jpg";
      const path = `${artista_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("productos")
        .upload(path, archivo, { cacheControl: "3600", upsert: false });
      if (error) throw new Error(`Error subiendo imagen: ${error.message}`);
      const { data: { publicUrl } } = supabase.storage.from("productos").getPublicUrl(path);
      urls.push(publicUrl);
    }
    return urls;
  };

  const onSubmit = async (data: FormData) => {
    if (!artista) { toast.error("No se encontró tu perfil de artista"); return; }
    if (archivos.length === 0) { toast.error("Agrega al menos una imagen"); return; }

    setEnviando(true);
    try {
      const imagenes = await uploadImages(artista.id);
      const { error } = await supabase.from("productos").insert({
        artista_id:   artista.id,
        categoria_id: data.subcategoria_id || data.categoria_id,
        nombre:       data.nombre,
        descripcion:  data.descripcion,
        tipo:         data.tipo,
        precio:       data.precio,
        stock:        data.tipo === "fisico" ? (data.stock ?? null) : null,
        imagenes,
        zonas_envio:  data.zonas_envio,
        estado:       "en_revision",
      });
      if (error) throw error;
      toast.success("Enviado para aprobación");
      router.push("/panel/productos");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir el producto");
    } finally {
      setEnviando(false);
    }
  };

  const inputClass = "w-full rounded-md px-3 py-2.5 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none transition-colors";
  const labelClass = "block text-sm mb-1.5";
  const errorClass = "text-xs mt-1";

  return (
    <div>
      <h1
        className="mb-8"
        style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", fontWeight: "700", color: "#111111" }}
      >
        Subir producto
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── Columna izquierda ── */}
          <div className="flex flex-col gap-5">
            {/* Nombre */}
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", color: "#444444" }} className={labelClass}>
                Nombre del producto
              </label>
              <input
                {...register("nombre")}
                className={inputClass}
                style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
                placeholder="Ej: Polera tour 2024"
              />
              {errors.nombre && (
                <p style={{ fontFamily: "Barlow, sans-serif", color: "#e8003d" }} className={errorClass}>
                  {errors.nombre.message}
                </p>
              )}
            </div>

            {/* Descripción */}
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", color: "#444444" }} className={labelClass}>
                Descripción
                <span className="ml-auto float-right text-xs" style={{ color: descripcion.length > 460 ? "#e8003d" : "#999" }}>
                  {descripcion.length}/500
                </span>
              </label>
              <textarea
                {...register("descripcion")}
                rows={5}
                maxLength={500}
                className={`${inputClass} resize-none`}
                style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
                placeholder="Describe tu producto..."
              />
              {errors.descripcion && (
                <p style={{ fontFamily: "Barlow, sans-serif", color: "#e8003d" }} className={errorClass}>
                  {errors.descripcion.message}
                </p>
              )}
            </div>

            {/* Categoría */}
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", color: "#444444" }} className={labelClass}>
                Categoría
              </label>
              <select
                {...register("categoria_id")}
                className={inputClass}
                style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
              >
                <option value="">Selecciona una categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              {errors.categoria_id && (
                <p style={{ fontFamily: "Barlow, sans-serif", color: "#e8003d" }} className={errorClass}>
                  {errors.categoria_id.message}
                </p>
              )}
            </div>

            {/* Subcategoría */}
            {subcategorias.length > 0 && (
              <div>
                <label style={{ fontFamily: "Barlow, sans-serif", color: "#444444" }} className={labelClass}>
                  Subcategoría
                </label>
                <select
                  {...register("subcategoria_id")}
                  className={inputClass}
                  style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
                >
                  <option value="">Sin subcategoría</option>
                  {subcategorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Toggle Físico / Digital */}
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", color: "#444444" }} className={labelClass}>
                Tipo de producto
              </label>
              <div className="flex rounded-md border border-[#e8e8e8] overflow-hidden w-fit">
                {(["fisico", "digital"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setValue("tipo", t)}
                    className="px-5 py-2 text-sm transition-colors capitalize"
                    style={{
                      fontFamily: "Barlow, sans-serif",
                      backgroundColor: tipo === t ? "#111111" : "#ffffff",
                      color: tipo === t ? "#ffffff" : "#666666",
                    }}
                  >
                    {t === "fisico" ? "Físico" : "Digital"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Columna derecha ── */}
          <div className="flex flex-col gap-5">
            {/* Precio */}
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", color: "#444444" }} className={labelClass}>
                Precio (CLP)
              </label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                  style={{ fontFamily: "DM Sans, sans-serif", color: "#999" }}
                >
                  $
                </span>
                <input
                  type="number"
                  {...register("precio", { valueAsNumber: true })}
                  className={`${inputClass} pl-7`}
                  style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
                  placeholder="5990"
                  min={1100}
                />
              </div>
              {errors.precio && (
                <p style={{ fontFamily: "Barlow, sans-serif", color: "#e8003d" }} className={errorClass}>
                  {errors.precio.message}
                </p>
              )}
            </div>

            {/* Stock (solo físico) */}
            {tipo === "fisico" && (
              <div>
                <label style={{ fontFamily: "Barlow, sans-serif", color: "#444444" }} className={labelClass}>
                  Stock disponible
                </label>
                <input
                  type="number"
                  {...register("stock", { valueAsNumber: true })}
                  className={inputClass}
                  style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
                  placeholder="10"
                  min={0}
                />
              </div>
            )}

            {/* Upload imágenes */}
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", color: "#444444" }} className={labelClass}>
                Imágenes ({archivos.length}/5)
              </label>

              {archivos.length < 5 && (
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
                  <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#666666" }}>
                    {isDragActive ? "Suelta las fotos aquí" : "Arrastra tus fotos aquí o haz click"}
                  </p>
                  <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#999999", marginTop: "4px" }}>
                    JPG, PNG, WEBP · Máximo 5 fotos
                  </p>
                </div>
              )}

              {previews.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {previews.map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#e8e8e8] shrink-0">
                      <img src={url} alt={`preview ${i}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => quitarImagen(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: "rgba(17,17,17,0.7)" }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Zonas de envío */}
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", color: "#444444" }} className={labelClass}>
                Zonas de envío
                {tipo === "digital" && (
                  <span className="ml-2 text-xs" style={{ color: "#22c55e" }}>
                    (todas incluidas — producto digital)
                  </span>
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                {ZONAS.map((zona) => {
                  const activa = zonas.includes(zona);
                  return (
                    <button
                      key={zona}
                      type="button"
                      onClick={() => toggleZona(zona)}
                      disabled={tipo === "digital"}
                      className="px-3 py-1.5 text-sm rounded border transition-colors"
                      style={{
                        fontFamily: "Barlow, sans-serif",
                        backgroundColor: activa ? "#111111" : "#ffffff",
                        borderColor: activa ? "#111111" : "#e8e8e8",
                        color: activa ? "#ffffff" : "#555555",
                        cursor: tipo === "digital" ? "default" : "pointer",
                        opacity: tipo === "digital" ? 0.7 : 1,
                      }}
                    >
                      {zona}
                    </button>
                  );
                })}
              </div>
              {errors.zonas_envio && (
                <p style={{ fontFamily: "Barlow, sans-serif", color: "#e8003d" }} className={errorClass}>
                  {errors.zonas_envio.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-8 pt-8 border-t border-[#e8e8e8]">
          <button
            type="submit"
            disabled={enviando}
            className="w-full h-12 rounded-md text-white font-semibold transition-colors"
            style={{
              fontFamily: "Barlow, sans-serif",
              fontSize: "16px",
              backgroundColor: enviando ? "#f0a0b0" : "#e8003d",
              cursor: enviando ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => { if (!enviando) e.currentTarget.style.backgroundColor = "#c5002e"; }}
            onMouseLeave={(e) => { if (!enviando) e.currentTarget.style.backgroundColor = "#e8003d"; }}
          >
            {enviando ? "Subiendo..." : "Enviar para aprobación"}
          </button>
        </div>
      </form>
    </div>
  );
}
