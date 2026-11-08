"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, ExternalLink, Store } from "lucide-react";
import { toast } from "sonner";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCLP } from "@/lib/constants";
import {
  ETIQUETA_ESTADO_TIENDA,
  FALTA_CHECKLIST,
  type ChecklistTienda,
  type EstadoTienda,
  type TiendaAdmin,
} from "@/lib/tienda";

const TEXTO = { fontFamily: "var(--font-body)" } as const;
const TITULO = { fontFamily: "var(--font-titulo)" } as const;

const COLOR_ESTADO: Record<EstadoTienda, { bg: string; text: string }> = {
  no_activa:  { bg: "#f3f4f6", text: "#374151" },
  solicitada: { bg: "#fffbeb", text: "#b45309" },
  devuelta:   { bg: "#fff1f2", text: "#be123c" },
  activa:     { bg: "#f0fdf4", text: "#15803d" },
  suspendida: { bg: "#fff1f2", text: "#be123c" },
};

const ORDEN_CHECKLIST = Object.keys(FALTA_CHECKLIST) as (keyof ChecklistTienda)[];

const ETIQUETA_CHECKLIST: Record<keyof ChecklistTienda, string> = {
  terminos:  "Términos aceptados",
  identidad: "Identidad de Mercado Pago declarada",
  mp:        "Mercado Pago conectado",
  despacho:  "Despacho o retiro definido",
  contacto:  "Correo de contacto para compradores",
  producto:  "Al menos un producto en borrador",
};

/** Ya activada, el borrador dejó de exigirse: mostrarlo pendiente confunde. */
const itemsChecklist = (estado: EstadoTienda) =>
  estado === "activa" || estado === "suspendida" ? ORDEN_CHECKLIST.filter((k) => k !== "producto") : ORDEN_CHECKLIST;

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });

function EtiquetaEstado({ estado }: { estado: EstadoTienda }) {
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold" style={{ ...TEXTO, backgroundColor: COLOR_ESTADO[estado].bg, color: COLOR_ESTADO[estado].text }}>
      {ETIQUETA_ESTADO_TIENDA[estado]}
    </span>
  );
}

export default function TiendasAdminPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"solicitadas" | "todas">("solicitadas");
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);

  const { data: tiendas = [], isLoading, isError } = useQuery<TiendaAdmin[]>({
    queryKey: ["admin-tiendas", tab],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tiendas${tab === "solicitadas" ? "?estado=solicitada" : ""}`);
      if (!res.ok) throw new Error("No pudimos leer las tiendas");
      return (await res.json()).tiendas;
    },
  });

  const seleccionada = tiendas.find((t) => t.artistaId === seleccionadaId) ?? null;

  const cambiarTab = (t: "solicitadas" | "todas") => {
    setTab(t);
    setSeleccionadaId(null);
  };

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-tiendas"] });
    queryClient.invalidateQueries({ queryKey: ["admin-count-tiendas"] });
    queryClient.invalidateQueries({ queryKey: ["admin-count-revision"] });
    queryClient.invalidateQueries({ queryKey: ["admin-artistas"] });
  };

  return (
    <div className="-m-8 flex" style={{ height: "calc(100vh - 64px)" }}>
      {/* ── Panel izquierdo: la cola ── */}
      <div className="flex flex-col overflow-hidden border-r border-[#e8e8e8]" style={{ width: "38%" }}>
        <div className="flex shrink-0 border-b border-[#e8e8e8]">
          {([["solicitadas", "Solicitudes"], ["todas", "Todas"]] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => cambiarTab(t)}
              className="flex-1 py-3 text-sm transition-colors"
              style={{
                ...TEXTO,
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

        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "#f8f7f5" }}>
          {isLoading ? (
            <p className="p-8 text-center" style={{ ...TEXTO, color: "#666666" }}>Cargando...</p>
          ) : isError ? (
            <p className="p-8 text-center" style={{ ...TEXTO, color: "#b91c1c" }}>No pudimos leer las tiendas. Recarga la página.</p>
          ) : tiendas.length === 0 ? (
            <div className="p-8 text-center">
              <Store size={32} className="mx-auto mb-2 text-[#cccccc]" />
              <p style={{ ...TEXTO, color: "#666666" }}>
                {tab === "solicitadas" ? "No hay solicitudes por revisar" : "Sin tiendas en esta vista"}
              </p>
            </div>
          ) : (
            tiendas.map((t) => {
              const activa = seleccionadaId === t.artistaId;
              const items = itemsChecklist(t.estado);
              const listos = items.filter((k) => t.checklist[k]).length;
              return (
                <button
                  key={t.artistaId}
                  onClick={() => setSeleccionadaId(t.artistaId)}
                  className="w-full border-b border-[#e8e8e8] p-3 text-left transition-colors"
                  style={{
                    borderLeft: activa ? "3px solid #e8003d" : "3px solid transparent",
                    backgroundColor: activa ? "#ffffff" : "transparent",
                    paddingLeft: activa ? "9px" : "12px",
                  }}
                >
                  <p className="truncate text-sm font-medium" style={{ ...TEXTO, color: "#111111" }}>{t.nombre}</p>
                  <p className="mt-0.5 text-xs" style={{ ...TEXTO, color: "#666666" }}>
                    Checklist {listos}/{items.length}
                    {t.solicitadaAt && t.estado === "solicitada" ? ` · solicitada el ${fecha(t.solicitadaAt)}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <EtiquetaEstado estado={t.estado} />
                    {t.esPrueba && (
                      <span className="rounded px-1.5 py-0.5 text-xs" style={{ ...TEXTO, backgroundColor: "#e0f2fe", color: "#075985" }}>Prueba</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Panel derecho: la revisión ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {!seleccionada ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Store size={40} className="mx-auto mb-3 text-[#cccccc]" />
              <p style={{ ...TEXTO, fontSize: "18px", color: "#999999" }}>Selecciona una tienda</p>
            </div>
          </div>
        ) : (
          // La key limpia el formulario de devolver al cambiar de tienda o de estado.
          <Detalle key={`${seleccionada.artistaId}-${seleccionada.estado}`} tienda={seleccionada} onCambio={invalidar} />
        )}
      </div>
    </div>
  );
}

function Detalle({ tienda, onCambio }: { tienda: TiendaAdmin; onCambio: () => void }) {
  const [abierto, setAbierto] = useState<"devolver" | "suspender" | null>(null);
  const [texto, setTexto] = useState("");
  const [procesando, setProcesando] = useState(false);

  // Al reactivar una suspendida no se exige un borrador: lo mismo en la base.
  const items = itemsChecklist(tienda.estado);
  const faltanParaAprobar = items.filter((k) => !tienda.checklist[k]);
  const borradores = tienda.productos.filter((p) => p.estado === "borrador").length;

  const accion = async (nombre: "aprobar" | "devolver" | "suspender", mensaje: string) => {
    setProcesando(true);
    try {
      const res = await fetch("/api/admin/tiendas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: nombre, artista_id: tienda.artistaId, texto }),
      });
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) throw new Error(cuerpo?.error ?? "No pudimos aplicar el cambio.");
      // El cambio ya quedó; el correo al artista puede fallar aparte.
      if (cuerpo?.correo === "fallido") {
        toast.success(mensaje);
        toast.warning(`No se pudo enviar el correo a ${tienda.nombre}: avísale a mano. El sistema lo reintenta mañana.`, { duration: Infinity });
      } else {
        toast.success(`${mensaje} Le avisamos por correo.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos aplicar el cambio.");
    } finally {
      setProcesando(false);
      onCambio();
    }
  };

  const d = tienda.despacho;
  const conEnvio = d.despacho_modo === "envio" || d.despacho_modo === "ambos";
  const conRetiro = d.despacho_modo === "retiro" || d.despacho_modo === "ambos";

  return (
    <div className="max-w-2xl">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h2 style={{ ...TITULO, fontSize: "24px", color: "#111111" }}>{tienda.nombre}</h2>
        <EtiquetaEstado estado={tienda.estado} />
      </div>
      <p className="mb-5 flex flex-wrap items-center gap-3" style={{ ...TEXTO, fontSize: "13px", color: "#666666" }}>
        <a href={`/artista/${tienda.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
          Ver ficha <ExternalLink size={11} />
        </a>
        <span>Cobro actual: {tienda.cobro === "marketplace" ? "marketplace" : "centralizado"}</span>
        <span>
          Comisión: {tienda.comision.porcentaje}%{tienda.comision.detalle ? ` (${tienda.comision.detalle})` : ""}
        </span>
      </p>

      {tienda.enBaja && (
        <p className="mb-5 rounded-lg border p-3" style={{ ...TEXTO, fontSize: "14px", backgroundColor: "#fff1f2", borderColor: "#fecdd3", color: "#9f1239" }}>
          Esta cuenta está dada de baja.
        </p>
      )}
      {tienda.comentario && (
        <p className="mb-5 rounded-lg border p-3" style={{ ...TEXTO, fontSize: "14px", backgroundColor: "#f8f7f5", borderColor: "#e8e8e8", color: "#444444" }}>
          <strong>{tienda.estado === "suspendida" ? "Motivo de la suspensión:" : "Último comentario:"}</strong> {tienda.comentario}
        </p>
      )}

      <Bloque titulo="Checklist (en vivo)">
        <ul className="flex flex-col gap-1.5">
          {items.map((k) => (
            <li key={k} className="flex items-center gap-2" style={{ ...TEXTO, fontSize: "14px", color: tienda.checklist[k] ? "#111111" : "#9f1239" }}>
              {tienda.checklist[k]
                ? <CheckCircle2 size={16} aria-label="Listo" className="shrink-0" style={{ color: "#16a34a" }} />
                : <CircleDashed size={16} aria-label="Falta" className="shrink-0" style={{ color: "#be123c" }} />}
              {ETIQUETA_CHECKLIST[k]}
            </li>
          ))}
        </ul>
      </Bloque>

      <Bloque titulo="Identidad y Mercado Pago">
        <p className="mb-2" style={{ ...TEXTO, fontSize: "14px", color: "#444444" }}>
          {tienda.identidadDeclaradaAt
            ? `Declaró su identidad el ${fecha(tienda.identidadDeclaradaAt)}.`
            : "No ha declarado su identidad."}{" "}
          <strong>Revísala antes de aprobar: el sistema no la comprueba.</strong>
        </p>
        <p style={{ ...TEXTO, fontSize: "14px", color: "#444444" }}>
          {tienda.conexion
            ? <>Cuenta conectada: {tienda.conexion.nickname ?? "sin alias"}{tienda.conexion.email ? ` · ${tienda.conexion.email}` : ""}{tienda.conexion.estado === "reconectar" ? " · hay que reconectar" : ""}{!tienda.conexion.liveMode ? " · cuenta de prueba" : ""}</>
            : "Sin cuenta conectada."}
        </p>
      </Bloque>

      <Bloque titulo="Despacho">
        {!d.despacho_modo ? (
          <p style={{ ...TEXTO, fontSize: "14px", color: "#666666" }}>Sin definir.</p>
        ) : (
          <ul className="flex flex-col gap-1" style={{ ...TEXTO, fontSize: "14px", color: "#444444" }}>
            {conEnvio && (
              <li>
                Envío: {d.despacho_costo === 0 ? "incluido en el precio" : formatCLP(d.despacho_costo ?? 0)},{" "}
                {d.despacho_plazo_min} a {d.despacho_plazo_max} días hábiles
              </li>
            )}
            {conRetiro && <li>Retiro: {d.retiro_detalle}</li>}
          </ul>
        )}
      </Bloque>

      <Bloque titulo="Contacto para compradores">
        <p style={{ ...TEXTO, fontSize: "14px", color: tienda.contactoEmail ? "#444444" : "#666666" }}>
          {tienda.contactoEmail ?? "Sin definir."}
        </p>
      </Bloque>

      <Bloque titulo="Términos">
        <p style={{ ...TEXTO, fontSize: "14px", color: "#444444" }}>
          {tienda.terminos.aceptadoAt
            ? `Aceptó la versión ${tienda.terminos.version} el ${fecha(tienda.terminos.aceptadoAt)}.`
            : `No ha aceptado la versión ${tienda.terminos.version}.`}
        </p>
      </Bloque>

      <Bloque titulo={`Productos (${tienda.productos.length})`}>
        {tienda.productos.length === 0 ? (
          <p style={{ ...TEXTO, fontSize: "14px", color: "#666666" }}>Sin productos.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {tienda.productos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3" style={{ ...TEXTO, fontSize: "14px", color: "#444444" }}>
                <span className="truncate">{p.nombre}</span>
                <StatusBadge estado={p.estado} />
              </li>
            ))}
          </ul>
        )}
      </Bloque>

      {/* ── Acciones ── */}
      {(tienda.estado === "solicitada" || tienda.estado === "suspendida") && (
        <div className="mb-4 rounded-xl border border-[#e8e8e8] p-4">
          <p className="mb-3" style={{ ...TEXTO, fontSize: "13px", color: "#666666" }}>
            {tienda.estado === "solicitada"
              ? `Al aprobar, la tienda queda activa y cobra por Mercado Pago del artista. ${borradores === 1 ? "Su borrador pasa" : `Sus ${borradores} borradores pasan`} a revisión: no se publica nada todavía.`
              : "Al reactivar, la tienda vuelve a estar activa y sigue cobrando por Mercado Pago del artista."}
          </p>
          {faltanParaAprobar.length > 0 && (
            <p className="mb-3" style={{ ...TEXTO, fontSize: "13px", color: "#9f1239" }}>
              No se puede aprobar: falta {faltanParaAprobar.map((k) => FALTA_CHECKLIST[k]).join(", ")}.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={procesando || faltanParaAprobar.length > 0}
              onClick={() => accion("aprobar", tienda.estado === "solicitada" ? "Tienda aprobada" : "Tienda reactivada")}
              className="h-10 rounded-md px-5 text-sm font-semibold text-white"
              style={{ ...TEXTO, backgroundColor: procesando || faltanParaAprobar.length > 0 ? "#d4d4d4" : "#16a34a" }}
            >
              {tienda.estado === "solicitada" ? "Aprobar" : "Reactivar"}
            </button>
            {tienda.estado === "solicitada" && (
              <button
                type="button"
                disabled={procesando}
                onClick={() => setAbierto("devolver")}
                className="h-10 rounded-md border px-5 text-sm font-semibold"
                style={{ ...TEXTO, borderColor: "#e8e8e8", color: "#444444", backgroundColor: "#ffffff" }}
              >
                Devolver con comentario
              </button>
            )}
          </div>
        </div>
      )}

      {tienda.estado === "activa" && abierto !== "suspender" && (
        <button
          type="button"
          onClick={() => setAbierto("suspender")}
          className="h-10 rounded-md border px-5 text-sm font-semibold"
          style={{ ...TEXTO, borderColor: "#fecdd3", color: "#be123c", backgroundColor: "#ffffff" }}
        >
          Suspender tienda
        </button>
      )}

      {abierto && (
        <div className="rounded-xl border border-[#e8e8e8] p-4">
          <label className="mb-2 block text-sm" style={{ ...TEXTO, color: "#444444" }}>
            {abierto === "devolver" ? "Qué tiene que corregir (lo verá el artista)" : "Motivo de la suspensión (lo verá el artista)"}
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-md border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#e8003d] focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={procesando || !texto.trim()}
              onClick={() => accion(abierto, abierto === "devolver" ? "Solicitud devuelta" : "Tienda suspendida")}
              className="h-10 rounded-md px-5 text-sm font-semibold text-white"
              style={{ ...TEXTO, backgroundColor: procesando || !texto.trim() ? "#d4d4d4" : "#e8003d" }}
            >
              {abierto === "devolver" ? "Devolver" : "Suspender"}
            </button>
            <button
              type="button"
              onClick={() => { setAbierto(null); setTexto(""); }}
              className="h-10 rounded-md border px-5 text-sm"
              style={{ ...TEXTO, borderColor: "#e8e8e8", color: "#444444" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <p className="mt-6" style={{ ...TEXTO, fontSize: "12px", color: "#999999" }}>
        Los productos se aprueban aparte, en{" "}
        <Link href="/admin/productos" className="underline">Productos pendientes</Link>.
      </p>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-xl border border-[#e8e8e8] p-4">
      <h3 className="mb-2" style={{ ...TEXTO, fontSize: "13px", fontWeight: 700, color: "#111111" }}>{titulo}</h3>
      {children}
    </section>
  );
}
