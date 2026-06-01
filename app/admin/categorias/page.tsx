"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

interface Categoria {
  id: string;
  nombre: string;
  icono?: string;
  padre_id?: string | null;
  orden?: number;
}

interface CategoriaConHijas extends Categoria {
  hijas: Categoria[];
}

interface FormState {
  nombre: string;
  icono: string;
  padre_id: string;
}

const FORM_VACIO: FormState = { nombre: "", icono: "", padre_id: "" };

export default function CategoriasPage() {
  const queryClient = useQueryClient();

  const [dialogOpen,  setDialogOpen]  = useState(false);
  const [editando,    setEditando]    = useState<Categoria | null>(null);
  const [form,        setForm]        = useState<FormState>(FORM_VACIO);
  const [guardando,   setGuardando]   = useState(false);

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["admin-categorias"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("categorias")
        .select("id, nombre, icono, padre_id, orden")
        .order("orden");
      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
  });

  const raices: CategoriaConHijas[] = categorias
    .filter((c) => !c.padre_id)
    .map((c) => ({ ...c, hijas: categorias.filter((h) => h.padre_id === c.id) }));

  const abrir = (cat?: Categoria, padre_id = "") => {
    setEditando(cat ?? null);
    setForm(cat ? { nombre: cat.nombre, icono: cat.icono ?? "", padre_id: cat.padre_id ?? "" } : { ...FORM_VACIO, padre_id });
    setDialogOpen(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    setGuardando(true);
    const supabase = createClient();
    try {
      if (editando) {
        const payload = {
          nombre: form.nombre.trim(),
          icono: form.icono.trim() || null,
          padre_id: form.padre_id || null,
        };
        const { error } = await supabase.from("categorias").update(payload).eq("id", editando.id);
        if (error) throw error;
        toast.success("Categoría actualizada");
      } else {
        const { data: existentes } = await supabase
          .from("categorias")
          .select("orden")
          .is("padre_id", form.padre_id || null)
          .order("orden", { ascending: false })
          .limit(1);
        const siguienteOrden = existentes?.[0]?.orden != null ? existentes[0].orden + 1 : 0;
        const payload = {
          nombre: form.nombre.trim(),
          icono: form.icono.trim() || null,
          padre_id: form.padre_id || null,
          orden: siguienteOrden,
        };
        const { error } = await supabase.from("categorias").insert(payload);
        if (error) throw error;
        toast.success("Categoría creada");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-categorias"] });
      setDialogOpen(false);
    } catch (error) {
      console.error("Error al guardar categoría:", error);
      toast.error("Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("categorias").delete().eq("id", id);
    if (error) {
      console.error("Error al eliminar categoría:", error);
      toast.error("No se puede eliminar — tiene productos asociados");
      return;
    }
    toast.success("Categoría eliminada");
    queryClient.invalidateQueries({ queryKey: ["admin-categorias"] });
  };

  const btnStyle = { fontFamily: "Barlow, sans-serif" as const };
  const inputClass = "w-full rounded-md px-3 py-2.5 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none transition-colors";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", fontWeight: "700", color: "#111111" }}>
          Categorías
        </h1>
        <button
          onClick={() => abrir()}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-white text-sm font-semibold"
          style={{ ...btnStyle, backgroundColor: "#e8003d" }}
        >
          <Plus size={16} /> Nueva categoría
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {raices.length === 0 && (
          <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Sin categorías aún.</p>
        )}

        {raices.map((cat) => (
          <div key={cat.id} className="border border-[#e8e8e8] rounded-xl overflow-hidden">
            {/* Header categoría raíz */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: "#f8f7f5" }}>
              {cat.icono && <span className="text-xl">{cat.icono}</span>}
              <span className="flex-1" style={{ fontFamily: "Oswald, sans-serif", fontSize: "16px", fontWeight: "600", color: "#111111" }}>
                {cat.nombre}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => abrir(cat)}
                  className="w-8 h-8 rounded flex items-center justify-center transition-colors hover:bg-white"
                  title="Editar"
                >
                  <Pencil size={14} style={{ color: "#666666" }} />
                </button>
                <button
                  onClick={() => eliminar(cat.id)}
                  className="w-8 h-8 rounded flex items-center justify-center transition-colors hover:bg-white"
                  title="Eliminar"
                >
                  <Trash2 size={14} style={{ color: "#e8003d" }} />
                </button>
              </div>
            </div>

            {/* Subcategorías */}
            {cat.hijas.length > 0 && (
              <div className="border-t border-[#e8e8e8]">
                {cat.hijas.map((hija, i) => (
                  <div
                    key={hija.id}
                    className="flex items-center gap-2 px-4 py-2.5"
                    style={{ borderBottom: i < cat.hijas.length - 1 ? "1px solid #f0f0f0" : undefined }}
                  >
                    <span style={{ color: "#cccccc", marginLeft: "24px" }}>└</span>
                    {hija.icono && <span>{hija.icono}</span>}
                    <span className="flex-1" style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#444444" }}>
                      {hija.nombre}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => abrir(hija)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-[#f8f7f5]">
                        <Pencil size={12} style={{ color: "#999" }} />
                      </button>
                      <button onClick={() => eliminar(hija.id)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-[#f8f7f5]">
                        <Trash2 size={12} style={{ color: "#e8003d" }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Botón agregar subcategoría */}
            <div className="px-4 py-2 border-t border-[#f0f0f0]">
              <button
                onClick={() => abrir(undefined, cat.id)}
                className="text-sm flex items-center gap-1 transition-colors"
                style={{ ...btnStyle, color: "#e8003d" }}
              >
                <Plus size={13} /> Agregar subcategoría
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Dialog nueva / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Oswald, sans-serif" }}>
              {editando ? "Editar categoría" : "Nueva categoría"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#444444", display: "block", marginBottom: "6px" }}>
                Nombre
              </label>
              <input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                className={inputClass}
                style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
                placeholder="Ej: Ropa"
              />
            </div>
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#444444", display: "block", marginBottom: "6px" }}>
                Ícono (emoji)
              </label>
              <input
                value={form.icono}
                onChange={(e) => setForm((f) => ({ ...f, icono: e.target.value }))}
                className={inputClass}
                style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
                placeholder="🎵"
              />
            </div>
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#444444", display: "block", marginBottom: "6px" }}>
                Es subcategoría de (opcional)
              </label>
              <select
                value={form.padre_id}
                onChange={(e) => setForm((f) => ({ ...f, padre_id: e.target.value }))}
                className={inputClass}
                style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
              >
                <option value="">— Categoría raíz —</option>
                {raices.map((r) => (
                  <option key={r.id} value={r.id}>{r.icono ? `${r.icono} ` : ""}{r.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setDialogOpen(false)}
              className="px-4 py-2 rounded border text-sm"
              style={{ ...btnStyle, borderColor: "#e8e8e8", color: "#666666" }}
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="px-4 py-2 rounded text-white text-sm"
              style={{ ...btnStyle, backgroundColor: guardando ? "#f0a0b0" : "#e8003d" }}
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
