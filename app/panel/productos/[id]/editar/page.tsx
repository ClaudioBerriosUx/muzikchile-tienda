"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { X, Upload, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const ZONAS = ["Chile", "Latinoamérica", "EE.UU.", "Europa", "Mundial"];

const comprimirImagen = (archivo: File, maxWidth = 800, calidad = 0.85): Promise<File> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(archivo);

    img.onload = () => {
      const canvas = document.createElement("canvas");

      let width  = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width  = maxWidth;
      }

      canvas.width  = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(archivo); return; }
          const comprimido = new File(
            [blob],
            archivo.name.replace(/\.[^.]+$/, ".jpg"),
            { type: "image/jpeg" }
          );
          URL.revokeObjectURL(url);
          resolve(comprimido);
        },
        "image/jpeg",
        calidad
      );
    };

    img.src = url;
  });
};

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

interface Categoria { id: string; nombre: string; slug: string; padre_id: string | null }

interface Producto {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: "fisico" | "digital";
  precio: number;
  stock: number | null;
  imagenes: string[];
  zonas_envio: string[];
  estado: string;
  categoria_id: string;
  categorias: { id: string; nombre: string; padre_id: string | null } | null;
}

export default function EditarProductoPage() {
  const params  = useParams<{ id: string }>();
  const router  = useRouter();
  const supabase = createClient();

  const [archivosNuevos,      setArchivosNuevos]      = useState<File[]>([]);
  const [imagenesExistentes,  setImagenesExistentes]  = useState<string[]>([]);
  const [enviando,            setEnviando]            = useState(false);

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

  const { data: producto, isLoading } = useQuery<Producto | null>({
    queryKey: ["producto-editar", params.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("productos")
        .select("*, categorias(id, nombre, padre_id)")
        .eq("id", params.id)
        .single();
      return data as Producto | null;
    },
    enabled: !!params.id,
  });

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias").select("id, nombre, slug, padre_id").is("padre_id", null).order("orden");
      return (data ?? []) as Categoria[];
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: "fisico", zonas_envio: [] },
  });

  const tipo        = watch("tipo");
  const categoriaId = watch("categoria_id");
  const zonas       = watch("zonas_envio") ?? [];
  const descripcion = watch("descripcion") ?? "";

  // Precargar datos del producto en el formulario
  useEffect(() => {
    if (!producto) return;

    setImagenesExistentes(producto.imagenes ?? []);

    const cat = producto.categorias;
    // Si la categoría tiene padre → es subcategoría
    const esSub       = !!cat?.padre_id;
    const categoriaId = esSub ? cat!.padre_id! : producto.categoria_id;
    const subId       = esSub ? producto.categoria_id : "";

    reset({
      nombre:          producto.nombre,
      descripcion:     producto.descripcion,
      tipo:            producto.tipo,
      precio:          producto.precio,
      stock:           producto.stock ?? undefined,
      zonas_envio:     producto.zonas_envio ?? [],
      categoria_id:    categoriaId,
      subcategoria_id: subId,
    });
  }, [producto, reset]);

  const { data: subcategorias = [] } = useQuery<Categoria[]>({
    queryKey: ["subcategorias", categoriaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias").select("id, nombre, slug, padre_id").eq("padre_id", categoriaId);
      return (data ?? []) as Categoria[];
    },
    enabled: !!categoriaId,
  });

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

  const totalImagenes = imagenesExistentes.length + archivosNuevos.length;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxFiles: 5,
    onDrop: useCallback((accepted: File[]) => {
      setArchivosNuevos((prev) => [...prev, ...accepted].slice(0, 5 - imagenesExistentes.length));
    }, [imagenesExistentes.length]),
  });

  const nuevasPreviews = useMemo(
    () => archivosNuevos.map((f) => URL.createObjectURL(f)),
    [archivosNuevos]
  );
  useEffect(() => () => nuevasPreviews.forEach(URL.revokeObjectURL), [nuevasPreviews]);

  const quitarExistente = (idx: number) => {
    setImagenesExistentes((prev) => prev.filter((_, i) => i !== idx));
  };

  const quitarNueva = (idx: number) => {
    setArchivosNuevos((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadNuevas = async (artista_id: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const archivo of archivosNuevos) {
      const archivoFinal = await comprimirImagen(archivo, 800, 0.85);
      const path = `${artista_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error } = await supabase.storage
        .from("productos")
        .upload(path, archivoFinal, { cacheControl: "3600", upsert: false });
      if (error) throw new Error(`Error subiendo imagen: ${error.message}`);
      const { data: { publicUrl } } = supabase.storage.from("productos").getPublicUrl(path);
      urls.push(publicUrl);
    }
    return urls;
  };

  const onSubmit = async (data: FormData) => {
    if (!artista) { toast.error("No se encontró tu perfil de artista"); return; }
    if (totalImagenes === 0) { toast.error("Agrega al menos una imagen"); return; }

    setEnviando(true);
    try {
      const urlsNuevas = await uploadNuevas(artista.id);
      const imagenes   = [...imagenesExistentes, ...urlsNuevas];

      const { error } = await supabase
        .from("productos")
        .update({
          categoria_id: data.subcategoria_id || data.categoria_id,
          nombre:       data.nombre,
          descripcion:  data.descripcion,
          tipo:         data.tipo,
          precio:       data.precio,
          stock:        data.tipo === "fisico" ? (data.stock ?? null) : null,
          imagenes,
          zonas_envio:  data.zonas_envio,
          estado:       "en_revision",
        })
        .eq("id", params.id);

      if (error) throw error;
      toast.success("Producto actualizado — en revisión");
      router.push("/panel/productos");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setEnviando(false);
    }
  };

  const inputClass = "w-full rounded-md px-3 py-2.5 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none transition-colors";
  const labelClass = "block text-sm mb-1.5";
  const errorClass = "text-xs mt-1";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Cargando producto...</p>
      </div>
    );
  }

  if (!producto) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-4">
        <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Producto no encontrado.</p>
        <Link href="/panel/productos" style={{ fontFamily: "Barlow, sans-serif", color: "#e8003d", fontSize: "14px" }}>
          ← Volver a mis productos
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/panel/productos"
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#e8003d")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
        >
          <ArrowLeft size={14} /> Volver a mis productos
        </Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <h1 style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", fontWeight: "700", color: "#111111" }}>
          Editar producto
        </h1>
        {producto.estado && (
          <span
            className="text-xs px-2.5 py-1 rounded-full"
            style={{
              fontFamily: "Barlow, sans-serif",
              backgroundColor:
                producto.estado === "aprobado"   ? "#f0fdf4" :
                producto.estado === "en_revision" ? "#fffbeb" : "#fff1f2",
              color:
                producto.estado === "aprobado"   ? "#16a34a" :
                producto.estado === "en_revision" ? "#b45309" : "#e8003d",
            }}
          >
            {producto.estado === "aprobado"    ? "Aprobado" :
             producto.estado === "en_revision" ? "En revisión" : producto.estado}
          </span>
        )}
      </div>

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

            {/* Imágenes */}
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", color: "#444444" }} className={labelClass}>
                Imágenes ({totalImagenes}/5)
              </label>

              {/* Imágenes existentes */}
              {imagenesExistentes.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {imagenesExistentes.map((url, i) => (
                    <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#e8e8e8] shrink-0">
                      <img src={url} alt={`imagen ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => quitarExistente(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: "rgba(17,17,17,0.7)" }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Dropzone para nuevas */}
              {totalImagenes < 5 && (
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
                    {isDragActive ? "Suelta las fotos aquí" : "Arrastra fotos nuevas aquí o haz click"}
                  </p>
                  <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#999999", marginTop: "4px" }}>
                    JPG, PNG, WEBP · Máximo {5 - imagenesExistentes.length} fotos más
                  </p>
                </div>
              )}

              <div style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#999999", marginTop: "6px", lineHeight: 1.5 }}>
                📐 Tamaño recomendado: 800 × 800 px (cuadrada)<br />
                📁 Formatos: JPG, PNG, WEBP<br />
                ⚖️ Peso máximo: 5 MB por imagen
              </div>

              {/* Previews de nuevas */}
              {nuevasPreviews.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {nuevasPreviews.map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-dashed border-[#e8003d] shrink-0">
                      <img src={url} alt={`nueva ${i}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => quitarNueva(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: "rgba(232,0,61,0.8)" }}
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

        {/* Aviso estado */}
        {producto.estado === "aprobado" && (
          <div
            className="mt-6 p-4 rounded-lg border"
            style={{ backgroundColor: "#fffbeb", borderColor: "#fde68a" }}
          >
            <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#92400e" }}>
              Al guardar los cambios el producto volverá a estado <strong>en revisión</strong> hasta que el equipo de MuzikChile lo apruebe nuevamente.
            </p>
          </div>
        )}

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
            {enviando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
