"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DollarSign, Users, CheckCircle, Percent, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { formatCLP } from "@/lib/constants";

interface OrdenLiq {
  id: string;
  monto_artista: number;
  estado: string;
  liquidado?: boolean;
  created_at: string;
}

interface Artista {
  id: string;
  nombre: string;
  foto_url?: string;
  banco?: string;
  cuenta_bancaria?: string;
  tipo_cuenta?: string;
  rut?: string;
  ordenes: OrdenLiq[];
}

interface Liquidacion {
  id: string;
  artista_id: string;
  monto: number;
  fecha: string;
  comprobante_url?: string;
  nota?: string;
  created_at: string;
  artistas?: { nombre: string } | null;
}

export default function LiquidacionesPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [pagarOpen,    setPagarOpen]    = useState(false);
  const [artistaPagar, setArtistaPagar] = useState<Artista | null>(null);
  const [comprobante,  setComprobante]  = useState("");
  const [fechaPago,    setFechaPago]    = useState(new Date().toISOString().slice(0, 10));
  const [nota,         setNota]         = useState("");
  const [archivo,      setArchivo]      = useState<File | null>(null);
  const [pagando,      setPagando]      = useState(false);

  const { data: artistas = [] } = useQuery<Artista[]>({
    queryKey: ["admin-liquidaciones-artistas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artistas")
        .select("id, nombre, foto_url, banco, cuenta_bancaria, tipo_cuenta, rut, ordenes(id, monto_artista, estado, liquidado, created_at)")
        .order("nombre");
      if (error) throw error;
      return (data ?? []) as unknown as Artista[];
    },
  });

  const { data: historial = [] } = useQuery<Liquidacion[]>({
    queryKey: ["admin-historial-liquidaciones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liquidaciones")
        .select("*, artistas(nombre)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Liquidacion[];
    },
  });

  const startOfMonth = useMemo(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const pendientes = useMemo(() =>
    artistas
      .map((a) => ({
        ...a,
        monto: (a.ordenes ?? [])
          .filter((o) => o.estado === "pagado" && !o.liquidado)
          .reduce((acc, o) => acc + (o.monto_artista ?? 0), 0),
      }))
      .filter((a) => a.monto > 0),
  [artistas]);

  const totalAPagar = useMemo(() => pendientes.reduce((acc, a) => acc + a.monto, 0), [pendientes]);

  const pagadosMes = useMemo(() =>
    historial.filter((l) => new Date(l.created_at) >= startOfMonth).length,
  [historial, startOfMonth]);

  const comisionMes = useMemo(() => {
    const inicio = startOfMonth.toISOString();
    return artistas.flatMap((a) => a.ordenes ?? [])
      .filter((o) => o.estado === "pagado" && o.created_at >= inicio)
      .reduce((acc, o) => acc + (o.monto_artista ?? 0), 0);
  }, [artistas, startOfMonth]);

  const abrirPago = (artista: Artista & { monto: number }) => {
    setArtistaPagar(artista);
    setComprobante(""); setNota(""); setArchivo(null);
    setFechaPago(new Date().toISOString().slice(0, 10));
    setPagarOpen(true);
  };

  const confirmarPago = async () => {
    if (!artistaPagar) return;
    setPagando(true);
    try {
      let comprobanteUrl: string | null = null;

      if (archivo) {
        const path = `${artistaPagar.id}/${Date.now()}-${archivo.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("comprobantes")
          .upload(path, archivo, { cacheControl: "3600", upsert: false });
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from("comprobantes").getPublicUrl(path);
        comprobanteUrl = publicUrl;
      }

      const ordenIds = (artistaPagar.ordenes ?? [])
        .filter((o) => o.estado === "pagado" && !o.liquidado)
        .map((o) => o.id);

      if (ordenIds.length > 0) {
        const { error: updErr } = await supabase
          .from("ordenes")
          .update({ liquidado: true })
          .in("id", ordenIds);
        if (updErr) throw updErr;
      }

      const montoTotal = (artistaPagar as Artista & { monto: number }).monto;
      await supabase.from("liquidaciones").insert({
        artista_id: artistaPagar.id,
        monto: montoTotal,
        fecha: fechaPago,
        comprobante: comprobante || null,
        comprobante_url: comprobanteUrl,
        nota: nota || null,
      });

      toast.success(`Pago registrado para ${artistaPagar.nombre}`);
      queryClient.invalidateQueries({ queryKey: ["admin-liquidaciones-artistas"] });
      queryClient.invalidateQueries({ queryKey: ["admin-historial-liquidaciones"] });
      setPagarOpen(false);
    } catch {
      toast.error("Error al registrar el pago");
    } finally {
      setPagando(false);
    }
  };

  const inputClass = "w-full rounded-md px-3 py-2.5 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none transition-colors";

  const metricas = [
    { label: "Total a pagar",        valor: formatCLP(totalAPagar), icon: <DollarSign size={20} />, color: "#e8003d" },
    { label: "Artistas pendientes",  valor: pendientes.length,      icon: <Users size={20} />,      color: "#f59e0b" },
    { label: "Pagados este mes",     valor: pagadosMes,             icon: <CheckCircle size={20} />, color: "#22c55e" },
    { label: "Comisión del mes",     valor: formatCLP(comisionMes), icon: <Percent size={20} />,    color: "#3b82f6" },
  ];

  return (
    <div>
      <h1 className="mb-8" style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", fontWeight: "700", color: "#111111" }}>
        Liquidaciones
      </h1>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {metricas.map((m) => (
          <div key={m.label} className="rounded-xl border border-[#e8e8e8] p-5">
            <div className="flex items-start justify-between">
              <div>
                <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#666666", textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</p>
                <p className="mt-1" style={{ fontFamily: "Oswald, sans-serif", fontSize: "24px", fontWeight: "700", color: "#111111" }}>{m.valor}</p>
              </div>
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${m.color}18` }}>
                <span style={{ color: m.color }}>{m.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pendientes */}
      <h2 className="mb-4" style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", fontWeight: "600", color: "#111111" }}>
        Pendientes de pago
      </h2>
      {pendientes.length === 0 ? (
        <div className="rounded-xl border border-[#e8e8e8] p-10 text-center mb-10" style={{ backgroundColor: "#f8f7f5" }}>
          <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Sin artistas pendientes de liquidación.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-10">
          {pendientes.map((a) => {
            const tieneBanco = !!(a.banco && a.cuenta_bancaria);
            return (
              <div key={a.id} className="flex items-center gap-4 rounded-xl border border-[#e8e8e8] p-4">
                {a.foto_url ? (
                  <img src={a.foto_url} alt={a.nombre} className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ backgroundColor: "#e8003d", fontFamily: "Oswald, sans-serif" }}>
                    {a.nombre[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p style={{ fontFamily: "Barlow, sans-serif", fontWeight: 600, color: "#111111" }}>{a.nombre}</p>
                  {tieneBanco ? (
                    <p className="text-xs" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
                      {a.banco} · {a.tipo_cuenta} · {a.cuenta_bancaria}
                    </p>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ fontFamily: "Barlow, sans-serif", backgroundColor: "#fee2e2", color: "#991b1b" }}>
                      Sin datos bancarios
                    </span>
                  )}
                </div>
                <p style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: "18px", color: "#e8003d", marginRight: "12px" }}>
                  {formatCLP(a.monto)}
                </p>
                <button
                  onClick={() => abrirPago(a)}
                  disabled={!tieneBanco}
                  className="px-4 py-2 rounded-md text-white text-sm font-semibold shrink-0"
                  style={{
                    fontFamily: "Barlow, sans-serif",
                    backgroundColor: tieneBanco ? "#e8003d" : "#d1d5db",
                    cursor: tieneBanco ? "pointer" : "not-allowed",
                  }}
                >
                  Registrar pago
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Historial */}
      <h2 className="mb-4" style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", fontWeight: "600", color: "#111111" }}>
        Historial de pagos
      </h2>
      <div className="rounded-xl border border-[#e8e8e8] overflow-hidden">
        {historial.length === 0 ? (
          <div className="p-8 text-center">
            <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Sin pagos registrados.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: "#f8f7f5" }}>
              <tr>
                {["Artista", "Monto", "Fecha", "Comprobante", "Nota"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wide" style={{ fontFamily: "Barlow, sans-serif", color: "#666666", fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historial.map((l, i) => (
                <tr key={l.id} style={{ borderTop: i > 0 ? "1px solid #f0f0f0" : undefined }}>
                  <td className="px-4 py-3" style={{ fontFamily: "Barlow, sans-serif", color: "#111111" }}>
                    {Array.isArray(l.artistas) ? l.artistas[0]?.nombre : (l.artistas as { nombre: string } | null)?.nombre ?? "—"}
                  </td>
                  <td className="px-4 py-3" style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 700, color: "#e8003d" }}>
                    {formatCLP(l.monto)}
                  </td>
                  <td className="px-4 py-3" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
                    {new Date(l.fecha).toLocaleDateString("es-CL")}
                  </td>
                  <td className="px-4 py-3">
                    {l.comprobante_url ? (
                      <a href={l.comprobante_url} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: "#3b82f6" }}>
                        Ver archivo
                      </a>
                    ) : (l as Liquidacion & { comprobante?: string }).comprobante ? (
                      <span className="text-xs font-mono" style={{ color: "#666666" }}>
                        {(l as Liquidacion & { comprobante?: string }).comprobante}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
                    {l.nota ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Dialog registrar pago */}
      <Dialog open={pagarOpen} onOpenChange={setPagarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Oswald, sans-serif" }}>
              Registrar pago — {artistaPagar?.nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#444444", display: "block", marginBottom: "5px" }}>
                Monto a pagar
              </label>
              <p style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: "22px", color: "#e8003d" }}>
                {artistaPagar ? formatCLP((artistaPagar as Artista & { monto: number }).monto) : ""}
              </p>
            </div>
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#444444", display: "block", marginBottom: "5px" }}>
                N° comprobante
              </label>
              <input value={comprobante} onChange={(e) => setComprobante(e.target.value)} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif" }} placeholder="Ej: 123456789" />
            </div>
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#444444", display: "block", marginBottom: "5px" }}>
                Fecha del pago
              </label>
              <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif" }} />
            </div>
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#444444", display: "block", marginBottom: "5px" }}>
                Subir comprobante (opcional)
              </label>
              <label className="flex items-center gap-2 cursor-pointer border border-dashed border-[#e8e8e8] rounded-lg px-4 py-3 hover:border-[#e8003d] transition-colors">
                <Upload size={16} style={{ color: "#999" }} />
                <span style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#666666" }}>
                  {archivo ? archivo.name : "Seleccionar archivo"}
                </span>
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <div>
              <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#444444", display: "block", marginBottom: "5px" }}>
                Nota para el artista (opcional)
              </label>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={3}
                className={`${inputClass} resize-none`}
                style={{ fontFamily: "DM Sans, sans-serif" }}
                placeholder="Ej: Pago correspondiente a ventas de mayo 2025"
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setPagarOpen(false)} className="px-4 py-2 rounded border text-sm" style={{ fontFamily: "Barlow, sans-serif", borderColor: "#e8e8e8", color: "#666666" }}>
              Cancelar
            </button>
            <button
              onClick={confirmarPago}
              disabled={pagando}
              className="px-4 py-2 rounded text-white text-sm"
              style={{ fontFamily: "Barlow, sans-serif", backgroundColor: pagando ? "#f0a0b0" : "#e8003d" }}
            >
              {pagando ? "Registrando..." : "Confirmar pago"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
