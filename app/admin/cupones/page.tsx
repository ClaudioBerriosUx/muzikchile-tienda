"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Power } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { formatCLP } from "@/lib/constants";
import StatusBadge from "@/components/ui/StatusBadge";

interface Cupon {
  id: string;
  codigo: string;
  tipo_descuento: string;
  valor: number;
  usos_actuales: number;
  usos_maximos?: number;
  expira_at?: string;
  activo: boolean;
  artista_id?: string | null;
  artistas?: { nombre: string } | { nombre: string }[] | null;
}

interface FormState {
  codigo: string;
  tipo: string;
  valor: string;
  usos_maximos: string;
  expira_at: string;
}

const FORM_VACIO: FormState = { codigo: "", tipo: "porcentaje", valor: "", usos_maximos: "", expira_at: "" };

function nombreArtista(c: Cupon): string {
  if (!c.artista_id) return "Global";
  if (!c.artistas) return "—";
  const a = c.artistas;
  return Array.isArray(a) ? (a[0]?.nombre ?? "—") : a.nombre;
}

export default function CuponesPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando,   setEditando]   = useState<Cupon | null>(null);
  const [form,       setForm]       = useState<FormState>(FORM_VACIO);
  const [guardando,  setGuardando]  = useState(false);

  const { data: cupones = [] } = useQuery<Cupon[]>({
    queryKey: ["admin-cupones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cupones")
        .select("*, artistas(nombre)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Cupon[];
    },
  });

  const abrir = (cupon?: Cupon) => {
    setEditando(cupon ?? null);
    setForm(cupon ? {
      codigo: cupon.codigo,
      tipo: cupon.tipo_descuento,
      valor: String(cupon.valor),
      usos_maximos: cupon.usos_maximos ? String(cupon.usos_maximos) : "",
      expira_at: cupon.expira_at ? cupon.expira_at.slice(0, 10) : "",
    } : FORM_VACIO);
    setDialogOpen(true);
  };

  const guardar = async () => {
    if (!form.codigo.trim() || !form.valor) { toast.error("Código y valor son obligatorios"); return; }
    setGuardando(true);
    try {
      const payload = {
        codigo: form.codigo.trim().toUpperCase(),
        tipo_descuento: form.tipo,
        valor: Number(form.valor),
        usos_maximos: form.usos_maximos ? Number(form.usos_maximos) : null,
        expira_at: form.expira_at || null,
        artista_id: null,
      };
      if (editando) {
        const { error } = await supabase.from("cupones").update(payload).eq("id", editando.id);
        if (error) throw error;
        toast.success("Cupón actualizado");
      } else {
        const { error } = await supabase.from("cupones").insert({ ...payload, activo: true, usos_actuales: 0 });
        if (error) throw error;
        toast.success("Cupón creado");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-cupones"] });
      setDialogOpen(false);
    } catch (error) {
      const message = (error as { message?: string })?.message;
      toast.error(message ? `Error al guardar: ${message}` : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const toggleActivo = async (cupon: Cupon) => {
    const { error } = await supabase.from("cupones").update({ activo: !cupon.activo }).eq("id", cupon.id);
    if (error) { toast.error("Error al cambiar estado"); return; }
    toast.success(cupon.activo ? "Cupón desactivado" : "Cupón activado");
    queryClient.invalidateQueries({ queryKey: ["admin-cupones"] });
  };

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const inputClass = "w-full rounded-md px-3 py-2.5 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none transition-colors";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", fontWeight: "700", color: "#111111" }}>
          Cupones globales
        </h1>
        <button
          onClick={() => abrir()}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-white text-sm font-semibold"
          style={{ fontFamily: "Barlow, sans-serif", backgroundColor: "#e8003d" }}
        >
          <Plus size={16} /> Nuevo cupón
        </button>
      </div>

      <div className="rounded-xl border border-[#e8e8e8] overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: "#f8f7f5" }}>
            <tr>
              {["Código", "Tipo", "Valor", "Usos", "Expira", "Artista", "Estado", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wide" style={{ fontFamily: "Barlow, sans-serif", color: "#666666", fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cupones.map((c, i) => (
              <tr key={c.id} style={{ borderTop: i > 0 ? "1px solid #f0f0f0" : undefined }}>
                <td className="px-4 py-3 font-mono font-bold" style={{ color: "#111111" }}>{c.codigo}</td>
                <td className="px-4 py-3" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
                  {c.tipo_descuento === "porcentaje" ? "%" : "$"}
                </td>
                <td className="px-4 py-3" style={{ fontFamily: "DM Sans, sans-serif", color: "#e8003d", fontWeight: 700 }}>
                  {c.tipo_descuento === "porcentaje" ? `${c.valor}%` : formatCLP(c.valor)}
                </td>
                <td className="px-4 py-3" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
                  {c.usos_actuales}{c.usos_maximos ? ` / ${c.usos_maximos}` : ""}
                </td>
                <td className="px-4 py-3" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
                  {c.expira_at ? new Date(c.expira_at).toLocaleDateString("es-CL") : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded" style={{
                    fontFamily: "Barlow, sans-serif",
                    backgroundColor: c.artista_id ? "#dbeafe" : "#f3f4f6",
                    color: c.artista_id ? "#1e40af" : "#666666",
                  }}>
                    {nombreArtista(c)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded font-medium" style={{
                    fontFamily: "Barlow, sans-serif",
                    backgroundColor: c.activo ? "#dcfce7" : "#fee2e2",
                    color: c.activo ? "#166534" : "#991b1b",
                  }}>
                    {c.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => abrir(c)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-[#f8f7f5]" title="Editar">
                      <Pencil size={13} style={{ color: "#666" }} />
                    </button>
                    <button onClick={() => toggleActivo(c)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-[#f8f7f5]" title={c.activo ? "Desactivar" : "Activar"}>
                      <Power size={13} style={{ color: c.activo ? "#e8003d" : "#22c55e" }} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {cupones.length === 0 && (
          <div className="text-center py-12">
            <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Sin cupones creados.</p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Oswald, sans-serif" }}>
              {editando ? "Editar cupón" : "Nuevo cupón global"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#444444", display: "block", marginBottom: "5px" }}>Código</label>
              <input value={form.codigo} onChange={set("codigo")} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif", textTransform: "uppercase" }} placeholder="VERANO2025" />
            </div>
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#444444", display: "block", marginBottom: "5px" }}>Tipo</label>
              <select value={form.tipo} onChange={set("tipo")} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif" }}>
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="fijo">Monto fijo ($)</option>
              </select>
            </div>
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#444444", display: "block", marginBottom: "5px" }}>
                Valor {form.tipo === "porcentaje" ? "(%)" : "(CLP)"}
              </label>
              <input type="number" value={form.valor} onChange={set("valor")} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif" }} placeholder={form.tipo === "porcentaje" ? "10" : "5000"} />
            </div>
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#444444", display: "block", marginBottom: "5px" }}>Usos máximos</label>
              <input type="number" value={form.usos_maximos} onChange={set("usos_maximos")} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif" }} placeholder="Ilimitado" />
            </div>
            <div className="col-span-2">
              <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#444444", display: "block", marginBottom: "5px" }}>Fecha de expiración</label>
              <input type="date" value={form.expira_at} onChange={set("expira_at")} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif" }} />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded border text-sm" style={{ fontFamily: "Barlow, sans-serif", borderColor: "#e8e8e8", color: "#666666" }}>
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando} className="px-4 py-2 rounded text-white text-sm" style={{ fontFamily: "Barlow, sans-serif", backgroundColor: guardando ? "#f0a0b0" : "#e8003d" }}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
