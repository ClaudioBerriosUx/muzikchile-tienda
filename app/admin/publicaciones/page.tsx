"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Undo2, Newspaper, Trash2, EyeOff, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/ui/StatusBadge";
import { etiquetaCategoria } from "@/lib/publicaciones";
import { borrarImagenDePublicacion } from "@/lib/storage";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import Link from "next/link";
import type { Database } from "@/lib/supabase/types";

type PublicacionRow = Database["public"]["Tables"]["publicaciones"]["Row"];

/** El join a artistas es a-uno por el FK artista_id. */
type Publicacion = PublicacionRow & {
  artistas: { nombre: string } | null;
};

const ESTADOS_FILTRO = [
  { value: "todos",     label: "Todos los estados" },
  { value: "pendiente", label: "Pendientes" },
  { value: "publicada", label: "Publicadas" },
  { value: "devuelta",  label: "Devueltas" },
  { value: "borrador",  label: "Borradores" },
];

export default function ModerarPublicacionesPage() {
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"pendientes" | "todas">("pendientes");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [seleccionada, setSeleccionada] = useState<Publicacion | null>(null);
  const [mostrarDevolucion, setMostrarDevolucion] = useState(false);
  const [comentario, setComentario] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [aBorrar, setABorrar] = useState<Publicacion | null>(null);
  const [borrando, setBorrando] = useState(false);

  const { data: publicaciones = [], isLoading } = useQuery<Publicacion[]>({
    queryKey: ["admin-publicaciones", tab, filtroEstado],
    queryFn: async () => {
      const supabase = createClient();
      let q = supabase
        .from("publicaciones")
        .select("*, artistas(nombre)")
        .order("created_at", { ascending: true });

      if (tab === "pendientes") {
        q = q.eq("estado", "pendiente");
      } else if (filtroEstado !== "todos") {
        q = q.eq("estado", filtroEstado);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Contador de la cola: independiente de la vista actual.
  const { data: totalPendientes = 0 } = useQuery({
    queryKey: ["admin-count-publicaciones-pendientes"],
    queryFn: async () => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("publicaciones")
        .select("id", { count: "exact", head: true })
        .eq("estado", "pendiente");
      if (error) throw error;
      return count ?? 0;
    },
  });

  /**
   * El reseteo va en los handlers y no en un useEffect: resetear estado dentro
   * de un efecto dispara renders en cascada (react-hooks/set-state-in-effect).
   * El molde de `admin/productos` lo hace con efectos; acá se corrigió.
   */
  const cerrarFormDevolucion = () => {
    setMostrarDevolucion(false);
    setComentario("");
  };

  const seleccionar = (p: Publicacion | null) => {
    setSeleccionada(p);
    cerrarFormDevolucion();
  };

  const cambiarTab = (t: "pendientes" | "todas") => {
    setTab(t);
    seleccionar(null);
  };

  const cambiarFiltro = (valor: string) => {
    setFiltroEstado(valor);
    seleccionar(null);
  };

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-publicaciones"] });
    queryClient.invalidateQueries({ queryKey: ["admin-count-publicaciones-pendientes"] });
  };

  const aprobar = async () => {
    if (!seleccionada) return;
    setProcesando(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("publicaciones")
      .update({ estado: "publicada", comentario_moderacion: null })
      .eq("id", seleccionada.id);
    if (error) {
      toast.error(`Error al aprobar: ${error.message}`);
    } else {
      toast.success("Publicación aprobada");
      invalidar();
      seleccionar(null);
    }
    setProcesando(false);
  };

  const devolver = async () => {
    if (!seleccionada || !comentario.trim()) {
      toast.error("Escribe qué hay que corregir");
      return;
    }
    setProcesando(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("publicaciones")
      .update({ estado: "devuelta", comentario_moderacion: comentario.trim() })
      .eq("id", seleccionada.id);
    if (error) {
      toast.error(`Error al devolver: ${error.message}`);
    } else {
      toast.success("Devuelta al artista con tus comentarios");
      invalidar();
      seleccionar(null);
    }
    setProcesando(false);
  };

  /**
   * Despublicar: saca la publicación del público sin borrarla.
   *
   * Vuelve a 'devuelta' (no a 'borrador') cuando hay motivo, para que el
   * artista vea por qué se retiró y pueda corregirla. Sin motivo va a
   * 'borrador', que es un retiro silencioso.
   *
   * Lo permite `publicaciones_update_admin`, que no restringe estados.
   */
  const despublicar = async () => {
    if (!seleccionada) return;
    setProcesando(true);
    const supabase = createClient();

    const motivo = comentario.trim();
    const { error } = await supabase
      .from("publicaciones")
      .update({
        estado: motivo ? "devuelta" : "borrador",
        comentario_moderacion: motivo || null,
      })
      .eq("id", seleccionada.id);

    if (error) {
      toast.error(`Error al despublicar: ${error.message}`);
    } else {
      toast.success(
        motivo
          ? "Retirada del público y devuelta al artista"
          : "Retirada del público como borrador"
      );
      invalidar();
      seleccionar(null);
    }
    setProcesando(false);
  };

  /** Borrado definitivo. Lo permite `publicaciones_delete_admin`. */
  const borrar = async () => {
    if (!aBorrar) return;
    setBorrando(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("publicaciones")
      .delete()
      .eq("id", aBorrar.id);

    if (error) {
      toast.error(`Error al eliminar: ${error.message}`);
    } else {
      // Best-effort, después de borrar la fila. Ver lib/storage.ts.
      await borrarImagenDePublicacion(supabase, aBorrar.imagen_url);
      toast.success("Publicación eliminada");
      invalidar();
      setABorrar(null);
      seleccionar(null);
    }
    setBorrando(false);
  };

  const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="-m-8 flex" style={{ height: "calc(100vh - 64px)" }}>
      {/* ── Panel izquierdo: la cola ── */}
      <div className="flex flex-col border-r border-[#e8e8e8] overflow-hidden" style={{ width: "38%" }}>
        {/* Tabs */}
        <div className="flex border-b border-[#e8e8e8] shrink-0">
          {([
            ["pendientes", `Pendientes (${totalPendientes})`],
            ["todas", "Todas"],
          ] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => cambiarTab(t)}
              className="flex-1 py-3 text-sm transition-colors"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? "#111111" : "#666666",
                borderBottom: tab === t ? "2px solid #e8003d" : "2px solid transparent",
                backgroundColor: "#ffffff",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filtro por estado (solo en "Todas") */}
        {tab === "todas" && (
          <div className="px-3 py-2 border-b border-[#e8e8e8] shrink-0 bg-white">
            <select
              value={filtroEstado}
              onChange={(e) => cambiarFiltro(e.target.value)}
              className="w-full rounded-md px-2 py-1.5 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none"
              style={{ fontFamily: "var(--font-body)", color: "#444444" }}
            >
              {ESTADOS_FILTRO.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "#f8f7f5" }}>
          {isLoading ? (
            <div className="p-8 text-center">
              <p style={{ fontFamily: "var(--font-body)", color: "#666666" }}>Cargando...</p>
            </div>
          ) : publicaciones.length === 0 ? (
            <div className="p-8 text-center">
              <Newspaper size={32} className="mx-auto mb-2 text-[#cccccc]" />
              <p style={{ fontFamily: "var(--font-body)", color: "#666666" }}>
                {tab === "pendientes" ? "Nada pendiente por revisar" : "Sin publicaciones en esta vista"}
              </p>
            </div>
          ) : (
            publicaciones.map((p) => {
              const activa = seleccionada?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => seleccionar(p)}
                  className="w-full flex items-center gap-3 p-3 text-left transition-colors border-b border-[#e8e8e8]"
                  style={{
                    borderLeft: activa ? "3px solid #e8003d" : "3px solid transparent",
                    backgroundColor: activa ? "#ffffff" : "transparent",
                    paddingLeft: activa ? "9px" : "12px",
                  }}
                >
                  <div className="w-16 h-14 rounded-lg overflow-hidden shrink-0 border border-[#e8e8e8]">
                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt={p.titular} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#f0f0f0" }}>
                        <Newspaper size={16} className="text-[#ccc]" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2" style={{ fontFamily: "var(--font-body)", color: "#111111" }}>
                      {p.titular}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ fontFamily: "var(--font-body)", color: "#666666" }}>
                      {p.artistas?.nombre ?? "—"} · {etiquetaCategoria(p.categoria)}
                    </p>
                    <div className="mt-1"><StatusBadge estado={p.estado} /></div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Panel derecho: lectura completa ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {!seleccionada ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Newspaper size={40} className="mx-auto mb-3 text-[#cccccc]" />
              <p style={{ fontFamily: "var(--font-body)", fontSize: "18px", color: "#999999" }}>
                Selecciona una publicación
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl">
            {/* Portada */}
            {seleccionada.imagen_url && (
              <div className="rounded-lg overflow-hidden border border-[#e8e8e8] mb-6">
                <img
                  src={seleccionada.imagen_url}
                  alt={seleccionada.titular}
                  className="w-full object-contain bg-[#f8f7f5]"
                  style={{ maxHeight: "380px" }}
                />
              </div>
            )}

            <div className="flex items-center gap-2 mb-3">
              <StatusBadge estado={seleccionada.estado} />
              <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "#999999" }}>
                {etiquetaCategoria(seleccionada.categoria)} · {fecha(seleccionada.created_at)}
              </span>
            </div>

            <h2 style={{ fontFamily: "var(--font-titulo)", fontSize: "26px", color: "#111111", lineHeight: 1.2 }}>
              {seleccionada.titular}
            </h2>

            <p className="mt-2" style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#666666" }}>
              por <strong style={{ color: "#111111" }}>{seleccionada.artistas?.nombre ?? "—"}</strong>
            </p>

            {seleccionada.bajada && (
              <p
                className="mt-4"
                style={{ fontFamily: "var(--font-body)", fontSize: "17px", color: "#444444", lineHeight: 1.6, fontWeight: 500 }}
              >
                {seleccionada.bajada}
              </p>
            )}

            {seleccionada.cuerpo && (
              <p
                className="mt-4 whitespace-pre-wrap"
                style={{ fontFamily: "var(--font-body)", fontSize: "15px", color: "#444444", lineHeight: 1.75 }}
              >
                {seleccionada.cuerpo}
              </p>
            )}

            {/* Comentario previo, si ya fue devuelta antes */}
            {seleccionada.comentario_moderacion && (
              <div
                className="mt-6 rounded-lg border p-4"
                style={{ backgroundColor: "#fff7ed", borderColor: "#fed7aa" }}
              >
                <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 600, color: "#9a3412" }}>
                  Comentario de moderación actual
                </p>
                <p className="mt-1" style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#7c2d12", lineHeight: 1.6 }}>
                  {seleccionada.comentario_moderacion}
                </p>
              </div>
            )}

            {/* ── Acciones: solo tienen sentido sobre lo pendiente ── */}
            {seleccionada.estado === "pendiente" ? (
              <div className="mt-8 flex flex-col gap-3 pt-6 border-t border-[#e8e8e8]">
                <button
                  onClick={aprobar}
                  disabled={procesando}
                  className="w-full h-11 rounded-md text-white font-semibold flex items-center justify-center gap-2 transition-colors"
                  style={{
                    fontFamily: "var(--font-body)",
                    backgroundColor: procesando ? "#86efac" : "#22c55e",
                    cursor: procesando ? "not-allowed" : "pointer",
                  }}
                >
                  <CheckCircle size={16} /> Aprobar y publicar
                </button>

                {!mostrarDevolucion ? (
                  <button
                    onClick={() => setMostrarDevolucion(true)}
                    className="w-full h-11 rounded-md font-semibold flex items-center justify-center gap-2 border transition-colors"
                    style={{
                      fontFamily: "var(--font-body)",
                      backgroundColor: "#ffffff",
                      borderColor: "#e8003d",
                      color: "#e8003d",
                    }}
                  >
                    <Undo2 size={16} /> Devolver al artista
                  </button>
                ) : (
                  <div className="border border-[#e8e8e8] rounded-lg p-4">
                    <p className="mb-2 text-sm" style={{ fontFamily: "var(--font-body)", color: "#444444" }}>
                      ¿Qué tiene que corregir? El artista verá este texto:
                    </p>
                    <textarea
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      rows={4}
                      placeholder="Ej: falta la fecha del show y la imagen está pixelada."
                      className="w-full rounded-md px-3 py-2 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none resize-none"
                      style={{ fontFamily: "var(--font-body)", color: "#111111" }}
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={cerrarFormDevolucion}
                        className="flex-1 h-9 rounded border text-sm"
                        style={{ fontFamily: "var(--font-body)", borderColor: "#e8e8e8", color: "#666666" }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={devolver}
                        disabled={procesando || !comentario.trim()}
                        className="flex-1 h-9 rounded text-white text-sm"
                        style={{
                          fontFamily: "var(--font-body)",
                          backgroundColor: !comentario.trim() || procesando ? "#f0a0b0" : "#e8003d",
                          cursor: !comentario.trim() || procesando ? "not-allowed" : "pointer",
                        }}
                      >
                        Devolver
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-8 pt-6 border-t border-[#e8e8e8]">
                <p
                  className="mb-4"
                  style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "#999999" }}
                >
                  {seleccionada.estado === "borrador"
                    ? "Es un borrador del artista: todavía no la envía a revisión."
                    : seleccionada.estado === "devuelta"
                      ? "Devuelta al artista. Volverá a la cola cuando la reenvíe."
                      : "Está publicada y visible para el público."}
                </p>

                {/* Publicada: ver en el sitio y retirarla sin borrarla. */}
                {seleccionada.estado === "publicada" && (
                  <div className="flex flex-col gap-3">
                    <Link
                      href={`/noticias/${seleccionada.slug}`}
                      target="_blank"
                      className="w-full h-11 rounded-md border flex items-center justify-center gap-2 transition-colors"
                      style={{ fontFamily: "var(--font-body)", borderColor: "#e8e8e8", color: "#444444" }}
                    >
                      <ExternalLink size={16} /> Ver en el sitio
                    </Link>

                    <div className="border border-[#e8e8e8] rounded-lg p-4">
                      <p className="mb-2 text-sm" style={{ fontFamily: "var(--font-body)", color: "#444444" }}>
                        Retirar del público. Motivo <strong>opcional</strong>: si lo
                        escribes, vuelve al artista como devuelta; si lo dejas vacío,
                        pasa a borrador en silencio.
                      </p>
                      <textarea
                        value={comentario}
                        onChange={(e) => setComentario(e.target.value)}
                        rows={3}
                        placeholder="Motivo (opcional)"
                        className="w-full rounded-md px-3 py-2 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none resize-none"
                        style={{ fontFamily: "var(--font-body)", color: "#111111" }}
                      />
                      <button
                        onClick={despublicar}
                        disabled={procesando}
                        className="w-full h-10 mt-3 rounded-md font-semibold flex items-center justify-center gap-2 border"
                        style={{
                          fontFamily: "var(--font-body)",
                          backgroundColor: "#ffffff",
                          borderColor: "#f59e0b",
                          color: "#9a3412",
                          cursor: procesando ? "not-allowed" : "pointer",
                        }}
                      >
                        <EyeOff size={15} /> Despublicar
                      </button>
                    </div>
                  </div>
                )}

                {/* Borrado definitivo: disponible en cualquier estado. */}
                <button
                  onClick={() => setABorrar(seleccionada)}
                  className="w-full h-10 mt-3 rounded-md flex items-center justify-center gap-2 border transition-colors"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "14px",
                    borderColor: "#fecaca",
                    color: "#e8003d",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <Trash2 size={15} /> Eliminar definitivamente
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmación de borrado */}
      <Dialog open={!!aBorrar} onOpenChange={() => !borrando && setABorrar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-titulo)" }}>
              ¿Eliminar definitivamente?
            </DialogTitle>
            <DialogDescription style={{ fontFamily: "var(--font-body)" }}>
              {aBorrar
                ? `“${aBorrar.titular}” de ${aBorrar.artistas?.nombre ?? "—"} se eliminará junto con su imagen. No se puede deshacer.`
                : "No se puede deshacer."}
              {aBorrar?.estado === "publicada" &&
                " Si solo quieres retirarla del público, usa Despublicar."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setABorrar(null)}
              disabled={borrando}
              className="px-4 py-2 rounded border text-sm"
              style={{ fontFamily: "var(--font-body)", borderColor: "#e8e8e8", color: "#444444" }}
            >
              Cancelar
            </button>
            <button
              onClick={borrar}
              disabled={borrando}
              className="px-4 py-2 rounded text-white text-sm"
              style={{
                fontFamily: "var(--font-body)",
                backgroundColor: borrando ? "#f0a0b0" : "#e8003d",
                cursor: borrando ? "not-allowed" : "pointer",
              }}
            >
              {borrando ? "Eliminando..." : "Sí, eliminar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
