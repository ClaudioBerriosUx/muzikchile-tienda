"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatCLP } from "@/lib/constants";
import { textoPlazo } from "@/lib/checkout/despacho";
import { MOTIVOS_REEMBOLSO, type MotivoReembolso } from "@/lib/reembolsos";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * El tipo sale del select (sin cast): así una columna mal escrita no compila.
 * La interfaz a mano que había antes usaba nombre_comprador, email_comprador
 * y external_reference, que no existen; la tabla mostraba "—" siempre.
 */
async function traerOrdenes(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("ordenes")
    .select("*, artistas(nombre), productos(nombre)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
type Orden = Awaited<ReturnType<typeof traerOrdenes>>[number];

/**
 * Correos del pedido (tabla `correos`, solo lectura para admin): la
 * confirmación al comprador (referencia = grupo_id) y la "nueva venta" a cada
 * artista (grupo_id:artista_id). Un fallido con 5 intentos ya no se reintenta:
 * hay que avisar a mano.
 */
async function traerCorreos(supabase: ReturnType<typeof createClient>, grupoId: string) {
  const { data, error } = await supabase
    .from("correos")
    .select("tipo, referencia, destinatario, estado, intentos, ultimo_error, enviado_at")
    .in("tipo", ["confirmacion_compra", "nueva_venta"])
    .or(`referencia.eq.${grupoId},referencia.like.${grupoId}:*`);
  if (error) throw error;
  return data;
}

const ETIQUETA_CORREO: Record<string, string> = {
  confirmacion_compra: "Confirmación al comprador",
  nueva_venta: "Nueva venta al artista",
};
const ESTADO_CORREO: Record<string, string> = {
  enviado: "Enviado",
  fallido: "Falló",
  pendiente: "Pendiente",
  buzon_local: "Sin enviar (fuera de producción)",
};

// 'reembolsado' lo pone el webhook (revertir_pago) cuando MP informa un pago
// reembolsado o con contracargo.
const ESTADOS = ["todos", "pendiente", "pagado", "enviado", "entregado", "reembolsado"];

const BADGE_ESTADO: Record<string, { bg: string; text: string }> = {
  pendiente:   { bg: "#fef9c3", text: "#854d0e" },
  pagado:      { bg: "#dbeafe", text: "#1e40af" },
  enviado:     { bg: "#fed7aa", text: "#9a3412" },
  entregado:   { bg: "#dcfce7", text: "#166534" },
  reembolsado: { bg: "#f3e8ff", text: "#6b21a8" },
};

function nombre(v: { nombre: string } | { nombre: string }[] | null) {
  if (!v) return "—";
  return Array.isArray(v) ? (v[0]?.nombre ?? "—") : v.nombre;
}

export default function OrdenesPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [estadoFiltro,  setEstadoFiltro]  = useState("todos");
  const [busqueda,      setBusqueda]      = useState("");
  const [seleccionada,  setSeleccionada]  = useState<Orden | null>(null);
  const [nuevoEstado,   setNuevoEstado]   = useState("");
  const [actualizando,  setActualizando]  = useState(false);
  // Reembolso total del pedido (/api/admin/mp/reembolsar). El resultado se
  // guarda con su grupo para no mostrarlo en otro pedido.
  const [confirmarReembolso, setConfirmarReembolso] = useState(false);
  const [reembolsando,       setReembolsando]       = useState(false);
  const [resultadoReembolso, setResultadoReembolso] = useState<{ grupo: string; ok: boolean; texto: string } | null>(null);
  // Es de emergencia: el motivo es obligatorio y, con "otro", también el detalle.
  const [motivoReembolso,  setMotivoReembolso]  = useState<MotivoReembolso | "">("");
  const [detalleReembolso, setDetalleReembolso] = useState("");
  const faltaMotivo = !motivoReembolso || (motivoReembolso === "otro" && !detalleReembolso.trim());

  const { data: ordenes = [] } = useQuery({
    queryKey: ["admin-ordenes"],
    queryFn: () => traerOrdenes(supabase),
  });

  const grupoSeleccionado = seleccionada?.grupo_id ?? null;
  // Todas las líneas del pedido: el reembolso es del pago entero, no de una línea.
  const lineasPedido = grupoSeleccionado ? ordenes.filter((o) => o.grupo_id === grupoSeleccionado) : [];
  const totalPedido = lineasPedido.reduce((acc, o) => acc + o.monto_artista + o.comision_monto + (o.envio_monto ?? 0), 0);
  const puedeReembolsar = lineasPedido.length > 0 && lineasPedido.every((o) => o.estado === "pagado");

  const reembolsar = async () => {
    if (!grupoSeleccionado || faltaMotivo) return;
    setReembolsando(true);
    let resultado: { ok: boolean; texto: string };
    try {
      const res = await fetch("/api/admin/mp/reembolsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupo: grupoSeleccionado, motivo: motivoReembolso, detalle: detalleReembolso.trim() || null }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        resultado = {
          ok: true,
          texto: `Mercado Pago aceptó el reembolso: pago ${data?.payment_id}, ${formatCLP(Number(data?.mp?.amount ?? totalPedido))}, estado "${data?.mp?.status ?? "—"}". ` +
            `El pedido pasa a "reembolsado" cuando Mercado Pago avise al webhook: recarga en un minuto.` +
            (data?.motivo_guardado === false ? " Ojo: el motivo no quedó guardado en la orden (ver el log)." : ""),
        };
      } else if (data?.mp_status) {
        resultado = { ok: false, texto: `Mercado Pago no hizo el reembolso (${data.mp_status}): ${data.mp?.message ?? data.mp?.error ?? "sin detalle"}.` };
      } else {
        resultado = { ok: false, texto: data?.error ?? `Error ${res.status}` };
      }
    } catch {
      resultado = { ok: false, texto: "Error de conexión: no sabemos si Mercado Pago recibió el pedido. Revisa el pago en Mercado Pago antes de reintentar." };
    }
    setResultadoReembolso({ grupo: grupoSeleccionado, ...resultado });
    setReembolsando(false);
    setConfirmarReembolso(false);
    setMotivoReembolso("");
    setDetalleReembolso("");
    queryClient.invalidateQueries({ queryKey: ["admin-ordenes"] });
  };
  const { data: correos = [] } = useQuery({
    queryKey: ["admin-ordenes-correos", grupoSeleccionado],
    queryFn: () => traerCorreos(supabase, grupoSeleccionado!),
    enabled: !!grupoSeleccionado,
  });

  const filtradas = useMemo(() => {
    let lista = ordenes;
    if (estadoFiltro !== "todos") lista = lista.filter((o) => o.estado === estadoFiltro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(
        (o) =>
          o.comprador_nombre.toLowerCase().includes(q) ||
          o.comprador_email.toLowerCase().includes(q) ||
          nombre(o.artistas).toLowerCase().includes(q)
      );
    }
    return lista;
  }, [ordenes, estadoFiltro, busqueda]);

  const cambiarEstado = async () => {
    if (!seleccionada || !nuevoEstado) return;
    setActualizando(true);
    const { error } = await supabase
      .from("ordenes")
      .update({ estado: nuevoEstado })
      .eq("id", seleccionada.id);
    if (error) { toast.error("Error al actualizar"); }
    else {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["admin-ordenes"] });
      setSeleccionada((prev) => prev ? { ...prev, estado: nuevoEstado } : null);
    }
    setActualizando(false);
  };

  const inputClass = "rounded-md px-3 py-2 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none transition-colors";

  return (
    <div className="-m-8 flex" style={{ height: "calc(100vh - 64px)" }}>
      {/* Tabla */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filtros */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e8e8e8] shrink-0 bg-white flex-wrap">
          <h1 style={{ fontFamily: "var(--font-titulo)", fontSize: "20px", color: "#111111" }}>
            Órdenes
          </h1>
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className={inputClass}
            style={{ fontFamily: "var(--font-body)" }}
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e} style={{ textTransform: "capitalize" }}>
                {e.charAt(0).toUpperCase() + e.slice(1)}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="Buscar comprador o artista..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className={`${inputClass} w-56`}
            style={{ fontFamily: "var(--font-body)" }}
          />
          <span className="ml-auto text-sm" style={{ fontFamily: "var(--font-body)", color: "#666666" }}>
            {filtradas.length} órdenes
          </span>
        </div>

        {/* Tabla scroll */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: "#f8f7f5", position: "sticky", top: 0 }}>
              <tr>
                {["ID", "Comprador", "Artista", "Producto", "Monto", "Comisión", "Estado", "Fecha"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs uppercase tracking-wide"
                    style={{ fontFamily: "var(--font-body)", color: "#666666", fontWeight: 600 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((o, i) => {
                const badge = BADGE_ESTADO[o.estado] ?? { bg: "#f3f4f6", text: "#374151" };
                const activa = seleccionada?.id === o.id;
                return (
                  <tr
                    key={o.id}
                    onClick={() => { setSeleccionada(o); setNuevoEstado(o.estado); }}
                    className="cursor-pointer transition-colors"
                    style={{
                      borderTop: i > 0 ? "1px solid #f0f0f0" : undefined,
                      backgroundColor: activa ? "#f8f7f5" : undefined,
                    }}
                    onMouseEnter={(e) => { if (!activa) e.currentTarget.style.backgroundColor = "#fafafa"; }}
                    onMouseLeave={(e) => { if (!activa) e.currentTarget.style.backgroundColor = ""; }}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[#999]">
                      {(o.grupo_id ?? o.id).slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3" style={{ fontFamily: "var(--font-body)", color: "#111111" }}>
                      {o.comprador_nombre || "—"}
                    </td>
                    <td className="px-4 py-3" style={{ fontFamily: "var(--font-body)", color: "#666666" }}>
                      {nombre(o.artistas)}
                    </td>
                    <td className="px-4 py-3 max-w-[160px] truncate" style={{ fontFamily: "var(--font-body)", color: "#666666" }}>
                      {nombre(o.productos)}
                    </td>
                    <td className="px-4 py-3" style={{ fontFamily: "var(--font-body)", fontWeight: 600, color: "#111111" }}>
                      {formatCLP(o.precio_unitario * o.cantidad)}
                    </td>
                    <td className="px-4 py-3" style={{ fontFamily: "var(--font-body)", color: "#666666" }}>
                      {formatCLP(o.comision_monto)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: badge.bg, color: badge.text, fontFamily: "var(--font-body)" }}>
                        {o.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ fontFamily: "var(--font-body)", color: "#999999" }}>
                      {new Date(o.created_at).toLocaleDateString("es-CL")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtradas.length === 0 && (
            <div className="text-center py-16">
              <p style={{ fontFamily: "var(--font-body)", color: "#666666" }}>Sin órdenes</p>
            </div>
          )}
        </div>
      </div>

      {/* Panel detalle */}
      {seleccionada && (
        <div className="w-80 border-l border-[#e8e8e8] overflow-y-auto shrink-0 bg-white" style={{ borderLeft: "1px solid #e8e8e8" }}>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontFamily: "var(--font-titulo)", fontSize: "16px", color: "#111111" }}>
                Detalle orden
              </h2>
              <button onClick={() => setSeleccionada(null)} className="text-[#999] hover:text-[#111] text-lg leading-none">×</button>
            </div>

            {[
              ["ID", (seleccionada.grupo_id ?? seleccionada.id).slice(0, 8).toUpperCase()],
              ["Comprador", seleccionada.comprador_nombre || "—"],
              ["Email", seleccionada.comprador_email || "—"],
              ["Artista", nombre(seleccionada.artistas)],
              ["Producto", nombre(seleccionada.productos)],
              ["Precio unit.", formatCLP(seleccionada.precio_unitario)],
              ["Cantidad", String(seleccionada.cantidad)],
              ["Monto artista", formatCLP(seleccionada.monto_artista)],
              ["Comisión", formatCLP(seleccionada.comision_monto)],
              // Copia de la entrega informada al comprador; vacía en órdenes anteriores al commit 7.
              ["Entrega", seleccionada.entrega === "retiro"
                ? `Retiro: ${seleccionada.entrega_detalle ?? "—"}`
                : seleccionada.entrega === "envio"
                  ? ["Envío", textoPlazo(seleccionada.entrega_plazo_min, seleccionada.entrega_plazo_max)].filter(Boolean).join(" · ")
                  : "—"],
              ["Envío cobrado (en esta línea)", formatCLP(seleccionada.envio_monto ?? 0)],
              // Copia del contacto que vio el comprador; vacía en órdenes anteriores al commit 8d.
              ["Contacto del vendedor", seleccionada.vendedor_contacto ?? "—"],
              ...(seleccionada.reembolso_motivo && seleccionada.reembolso_pedido_at
                ? [["Reembolso de emergencia", [
                    MOTIVOS_REEMBOLSO[seleccionada.reembolso_motivo as MotivoReembolso] ?? seleccionada.reembolso_motivo,
                    seleccionada.reembolso_detalle,
                    new Date(seleccionada.reembolso_pedido_at).toLocaleString("es-CL"),
                  ].filter(Boolean).join(" · ")]]
                : []),
            ].map(([label, val]) => (
              <div key={label} className="mb-3">
                <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "#999999", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#111111", marginTop: "2px" }}>{val}</p>
              </div>
            ))}

            {(seleccionada.direccion_envio || seleccionada.ciudad_envio) && (
              <div className="mb-3">
                <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "#999999", textTransform: "uppercase" }}>Dirección envío</p>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#111111", marginTop: "2px" }}>
                  {[seleccionada.direccion_envio, seleccionada.ciudad_envio, seleccionada.region_envio].filter(Boolean).join(", ")}
                </p>
              </div>
            )}

            {/* Un reembolso parcial deja el pago aprobado: no revierte nada, hay que revisarlo. */}
            {seleccionada.reembolso_parcial_monto != null && seleccionada.reembolso_parcial_at && (
              <p
                role="note"
                className="mb-3 rounded-md p-2.5"
                style={{ fontFamily: "var(--font-body)", fontSize: "13px", lineHeight: 1.5, backgroundColor: "#fffbeb", color: "#92400e" }}
              >
                <strong>Reembolso parcial en Mercado Pago:</strong> {formatCLP(Number(seleccionada.reembolso_parcial_monto))}{" "}
                de {formatCLP(totalPedido)} (informado el {new Date(seleccionada.reembolso_parcial_at).toLocaleString("es-CL")}).
                El pedido sigue pagado: revisa con el artista qué se devolvió y ajusta el estado o el stock a mano.
              </p>
            )}

            {grupoSeleccionado && (puedeReembolsar || resultadoReembolso?.grupo === grupoSeleccionado) && (
              <div className="mb-3">
                <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "#999999", textTransform: "uppercase" }}>Reembolso</p>
                {puedeReembolsar && (
                  <>
                    <p className="mt-1" style={{ fontFamily: "var(--font-body)", fontSize: "13px", lineHeight: 1.5, color: "#666666" }}>
                      El reembolso lo hace el artista desde su panel de Mercado Pago. Usa esto solo si él no puede o no lo hace.
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmarReembolso(true)}
                      className="mt-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold"
                      style={{ borderColor: "#b91c1c", color: "#b91c1c", fontFamily: "var(--font-body)" }}
                    >
                      Reembolso de emergencia ({formatCLP(totalPedido)})
                    </button>
                  </>
                )}
                {resultadoReembolso?.grupo === grupoSeleccionado && (
                  <p
                    role="status"
                    className="mt-2 rounded-md p-2.5"
                    style={{
                      fontFamily: "var(--font-body)", fontSize: "13px", lineHeight: 1.5,
                      backgroundColor: resultadoReembolso.ok ? "#dcfce7" : "#fee2e2",
                      color: resultadoReembolso.ok ? "#166534" : "#991b1b",
                    }}
                  >
                    {resultadoReembolso.texto}
                  </p>
                )}
              </div>
            )}

            <Dialog open={confirmarReembolso} onOpenChange={(abierto) => { if (!reembolsando) setConfirmarReembolso(abierto); }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle style={{ fontFamily: "var(--font-titulo)" }}>
                    ¿Reembolsar {formatCLP(totalPedido)} a {seleccionada.comprador_nombre}?
                  </DialogTitle>
                  <DialogDescription>
                    No se puede deshacer. Mercado Pago devuelve el pago completo del pedido{" "}
                    {(grupoSeleccionado ?? "").slice(0, 8).toUpperCase()} ({lineasPedido.length}{" "}
                    {lineasPedido.length === 1 ? "producto" : "productos"}, envío incluido) al medio con que pagó.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3" style={{ fontFamily: "var(--font-body)" }}>
                  <label className="text-sm" style={{ color: "#444444" }}>
                    Motivo
                    <select
                      value={motivoReembolso}
                      onChange={(e) => setMotivoReembolso(e.target.value as MotivoReembolso | "")}
                      disabled={reembolsando}
                      className="mt-1.5 block w-full rounded-md border border-[#d4d4d4] px-3 py-2 text-sm"
                    >
                      <option value="" disabled>Elige el motivo</option>
                      {(Object.keys(MOTIVOS_REEMBOLSO) as MotivoReembolso[]).map((m) => (
                        <option key={m} value={m}>{MOTIVOS_REEMBOLSO[m]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm" style={{ color: "#444444" }}>
                    Detalle{motivoReembolso === "otro" ? " (obligatorio)" : " (opcional)"}
                    <textarea
                      value={detalleReembolso}
                      onChange={(e) => setDetalleReembolso(e.target.value)}
                      maxLength={500}
                      rows={3}
                      disabled={reembolsando}
                      placeholder="Ej: el artista no respondió en 5 días hábiles"
                      className="mt-1.5 block w-full resize-none rounded-md border border-[#d4d4d4] px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <DialogFooter>
                  <button
                    type="button"
                    onClick={() => setConfirmarReembolso(false)}
                    disabled={reembolsando}
                    className="rounded-md border border-[#d4d4d4] px-4 py-2 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={reembolsar}
                    disabled={reembolsando || faltaMotivo}
                    className="rounded-md px-4 py-2 text-sm font-semibold text-white"
                    style={{ backgroundColor: reembolsando || faltaMotivo ? "#d4d4d4" : "#b91c1c" }}
                  >
                    {reembolsando ? "Reembolsando..." : "Sí, reembolsar"}
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {grupoSeleccionado && (
              <div className="mb-3">
                <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "#999999", textTransform: "uppercase" }}>Correos del pedido</p>
                {correos.length === 0 ? (
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#111111", marginTop: "2px" }}>
                    {seleccionada.estado === "pendiente" ? "Se envían al confirmarse el pago." : "Ninguno registrado."}
                  </p>
                ) : (
                  <ul className="mt-1 flex flex-col gap-1.5">
                    {correos.map((c) => (
                      <li key={`${c.tipo}-${c.referencia}`} style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "#111111" }}>
                        <span style={{ fontWeight: 600 }}>{ETIQUETA_CORREO[c.tipo] ?? c.tipo}:</span>{" "}
                        <span style={{ color: c.estado === "fallido" ? "#b91c1c" : "#111111" }}>
                          {ESTADO_CORREO[c.estado] ?? c.estado}
                          {c.estado === "fallido" && ` (${c.intentos} intento${c.intentos === 1 ? "" : "s"}${c.intentos >= 5 ? ", avisar a mano" : ""})`}
                        </span>
                        {c.destinatario && <span style={{ color: "#666666" }}> · {c.destinatario}</span>}
                        {c.estado === "fallido" && c.ultimo_error && (
                          <span className="block" style={{ color: "#666666", fontSize: "12px" }}>{c.ultimo_error}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="border-t border-[#e8e8e8] mt-4 pt-4">
              <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "#444444", marginBottom: "6px" }}>
                Cambiar estado
              </p>
              <select
                value={nuevoEstado}
                onChange={(e) => setNuevoEstado(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none mb-3"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {/* 'reembolsado' no se elige a mano: lo pone el webhook, que además devuelve stock y cupón. */}
                {ESTADOS.filter((e) => e !== "todos" && e !== "reembolsado").map((e) => (
                  <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
                ))}
              </select>
              <button
                onClick={cambiarEstado}
                disabled={actualizando || nuevoEstado === seleccionada.estado}
                className="w-full h-9 rounded-md text-white text-sm"
                style={{
                  fontFamily: "var(--font-body)",
                  backgroundColor: actualizando || nuevoEstado === seleccionada.estado ? "#d1d5db" : "#e8003d",
                }}
              >
                {actualizando ? "Guardando..." : "Confirmar cambio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
