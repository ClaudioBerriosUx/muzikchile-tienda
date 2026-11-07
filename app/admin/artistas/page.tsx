"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Music, UserPlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { formatearFecha, founderVigente, textoFounder } from "@/lib/comision";

interface Artista {
  id: string;
  nombre: string;
  slug: string;
  foto_url?: string;
  bio?: string;
  ciudad?: string;
  region?: string;
  comision: number;
  es_founder: boolean;
  founder_hasta: string | null;
  tienda_activa: boolean;
  verificado: boolean;
  es_prueba: boolean;
}

type Campos = Pick<Artista, "comision" | "es_founder" | "founder_hasta" | "verificado" | "es_prueba">;

export default function ArtistasPage() {
  const queryClient = useQueryClient();

  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  // Solo lo que el admin tocó y aún no guarda. El resto se lee de la lista, así
  // una pestaña abierta hace rato no muestra ni guarda valores viejos.
  const [borrador, setBorrador] = useState<Partial<Campos>>({});
  const [guardando, setGuardando] = useState(false);

  const [invitarOpen, setInvitarOpen] = useState(false);
  const [emailInvitar, setEmailInvitar] = useState("");
  const [invitando, setInvitando] = useState(false);

  const { data: artistas = [] } = useQuery<Artista[]>({
    queryKey: ["admin-artistas"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("artistas")
        .select("id, nombre, slug, foto_url, bio, ciudad, region, comision, es_founder, founder_hasta, tienda_activa, verificado, es_prueba")
        .order("nombre");
      if (error) throw error;
      return (data ?? []) as Artista[];
    },
  });

  const seleccionado = artistas.find((a) => a.id === seleccionadoId) ?? null;

  const comision     = borrador.comision ?? seleccionado?.comision ?? 0;
  const esFounder    = borrador.es_founder ?? seleccionado?.es_founder ?? false;
  const verificado   = borrador.verificado ?? seleccionado?.verificado ?? false;
  const esPrueba     = borrador.es_prueba ?? seleccionado?.es_prueba ?? false;
  // founder_hasta admite null como valor elegido: "sin fecha" no es "sin tocar".
  const founderHasta = ("founder_hasta" in borrador ? borrador.founder_hasta : seleccionado?.founder_hasta) ?? "";

  const editar = (campos: Partial<Campos>) => setBorrador((b) => ({ ...b, ...campos }));
  const setComision     = (comision: number)  => editar({ comision });
  const setEsFounder    = (es_founder: boolean) => editar({ es_founder });
  const setFounderHasta = (fecha: string)     => editar({ founder_hasta: fecha || null });
  const setVerificado   = (verificado: boolean) => editar({ verificado });
  const setEsPrueba     = (es_prueba: boolean) => editar({ es_prueba });

  const seleccionar = (id: string) => {
    if (id === seleccionadoId) return;
    setSeleccionadoId(id);
    setBorrador({});
  };

  const guardar = async () => {
    if (!seleccionado) return;

    // La comisión se guarda siempre como la tarifa del artista: el 0% de
    // founder lo decide lib/comision.ts, así rige al vencer founder_hasta.
    const valores: Campos = {
      comision,
      es_founder:    esFounder,
      founder_hasta: esFounder && founderHasta ? founderHasta : null,
      verificado,
      es_prueba:     esPrueba,
    };
    // Solo lo que cambió: guardar la comisión no reescribe los otros campos.
    const cambios = Object.fromEntries(
      Object.entries(valores).filter(([campo, valor]) => valor !== seleccionado[campo as keyof Campos])
    ) as Partial<Campos>;

    if (Object.keys(cambios).length === 0) {
      setBorrador({});
      toast.info("No hay cambios que guardar");
      return;
    }

    setGuardando(true);
    const supabase = createClient();
    // Con .select() se sabe si se guardó: RLS no da error, deja 0 filas.
    const { data, error } = await supabase
      .from("artistas")
      .update(cambios)
      .eq("id", seleccionado.id)
      .select("id")
      .maybeSingle();

    if (error) {
      toast.error(`No se pudo guardar: ${error.message}`);
    } else if (!data) {
      toast.error("No se guardó nada: la base no dejó cambiar este artista. Revisa que sigas con sesión de admin.");
    } else {
      await queryClient.invalidateQueries({ queryKey: ["admin-artistas"] });
      setBorrador({});
      toast.success("Cambios guardados");
    }
    setGuardando(false);
  };

  const invitar = async () => {
    if (!emailInvitar.trim()) return;
    setInvitando(true);
    const supabase = createClient();

    // Solo por la Edge Function: invita Y asigna el rol 'artista'. No hay plan B
    // con signInWithOtp: crearía un usuario sin rol que después no puede entrar
    // al panel (y dependía del registro público abierto).
    const { error } = await supabase.functions.invoke("invitar-artista", {
      body: { email: emailInvitar.trim() },
    });

    if (error) {
      let mensaje = error.message;
      if (error instanceof FunctionsHttpError) {
        const cuerpo = await error.context.json().catch(() => null);
        if (cuerpo?.error) mensaje = cuerpo.error;
      }
      toast.error(`No se pudo invitar: ${mensaje}`);
    } else {
      toast.success("Invitación enviada por email");
      setInvitarOpen(false);
      setEmailInvitar("");
    }
    setInvitando(false);
  };

  const inputClass = "w-full rounded-md px-3 py-2 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none transition-colors";
  const labelClass = "block text-xs mb-1.5 uppercase tracking-wide";

  return (
    <div className="-m-8 flex" style={{ height: "calc(100vh - 64px)" }}>
      {/* Panel izquierdo */}
      <div className="flex flex-col border-r border-[#e8e8e8] overflow-hidden" style={{ width: "40%" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8e8e8] shrink-0 bg-white">
          <h2 style={{ fontFamily: "var(--font-titulo)", fontSize: "16px", color: "#111111" }}>
            Artistas ({artistas.length})
          </h2>
          <button
            onClick={() => setInvitarOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-white text-xs"
            style={{ fontFamily: "var(--font-body)", backgroundColor: "#e8003d" }}
          >
            <UserPlus size={13} /> Invitar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "#f8f7f5" }}>
          {artistas.map((a) => {
            const activo = seleccionado?.id === a.id;
            return (
              <button
                key={a.id}
                onClick={() => seleccionar(a.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-[#e8e8e8] transition-colors"
                style={{
                  borderLeft: activo ? "3px solid #e8003d" : "3px solid transparent",
                  backgroundColor: activo ? "#ffffff" : "transparent",
                  paddingLeft: activo ? "13px" : "16px",
                }}
              >
                {a.foto_url ? (
                  <img src={a.foto_url} alt={a.nombre} className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: "#e8003d", fontFamily: "var(--font-body)" }}>
                    {a.nombre[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ fontFamily: "var(--font-body)", color: "#111111", fontWeight: 600 }}>
                    {a.nombre}
                  </p>
                  <p className="text-xs truncate" style={{ fontFamily: "var(--font-body)", color: "#999999" }}>
                    {a.region ?? "Sin región"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {a.es_prueba && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{
                      fontFamily: "var(--font-body)", backgroundColor: "#e0f2fe", color: "#075985",
                    }}>
                      Prueba
                    </span>
                  )}
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{
                    fontFamily: "var(--font-body)",
                    backgroundColor: founderVigente(a) ? "#fef9c3" : "#f3f4f6",
                    color: founderVigente(a) ? "#854d0e" : "#666666",
                  }}>
                    {founderVigente(a)
                      ? (a.founder_hasta ? `0% hasta ${formatearFecha(a.founder_hasta)}` : "0% de por vida")
                      : `${a.comision ?? 0}%${a.es_founder ? " · founder vencido" : ""}`}
                  </span>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.tienda_activa ? "#22c55e" : "#d1d5db" }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel derecho */}
      <div className="flex-1 overflow-y-auto p-6">
        {!seleccionado ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Music size={40} className="mx-auto mb-3 text-[#cccccc]" />
              <p style={{ fontFamily: "var(--font-body)", fontSize: "18px", color: "#999999" }}>
                Selecciona un artista
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-md">
            {/* Header artista */}
            <div className="flex items-center gap-4 mb-6">
              {seleccionado.foto_url ? (
                <img src={seleccionado.foto_url} alt={seleccionado.nombre} className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                  style={{ backgroundColor: "#e8003d", fontFamily: "var(--font-body)" }}>
                  {seleccionado.nombre[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <h2 style={{ fontFamily: "var(--font-titulo)", fontSize: "22px", color: "#111111" }}>
                  {seleccionado.nombre}
                </h2>
                {seleccionado.region && (
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "#666666" }}>
                    {[seleccionado.ciudad, seleccionado.region].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>

            {seleccionado.bio && (
              <p className="mb-6" style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#666666", lineHeight: 1.6 }}>
                {seleccionado.bio}
              </p>
            )}

            <div className="flex flex-col gap-5">
              {/* Comisión */}
              <div>
                <label style={{ fontFamily: "var(--font-body)", color: "#666666" }} className={labelClass}>
                  Comisión (%)
                </label>
                <input
                  type="number"
                  min={0} max={100}
                  value={comision}
                  onChange={(e) => setComision(Number(e.target.value))}
                  className={inputClass}
                  style={{ fontFamily: "var(--font-body)", color: "#111111" }}
                />
                {esFounder && (
                  <p className="mt-1 text-xs" style={{ fontFamily: "var(--font-body)", color: "#854d0e" }}>
                    {founderHasta
                      ? "Se aplica desde el día siguiente al fin del período founder."
                      : "No se aplica mientras sea founder de por vida."}
                  </p>
                )}
              </div>

              {/* Es Founder */}
              <div className="flex items-center justify-between py-3 border-t border-[#e8e8e8]">
                <div>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#111111", fontWeight: 600 }}>
                    Es Founder
                  </p>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#666666" }}>
                    {textoFounder(founderHasta || null)}
                  </p>
                </div>
                <Switch checked={esFounder} onCheckedChange={setEsFounder} />
              </div>

              {esFounder && (
                <div className="-mt-3">
                  <label htmlFor="founder-hasta" style={{ fontFamily: "var(--font-body)", color: "#666666" }} className={labelClass}>
                    Founder hasta (opcional)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="founder-hasta"
                      type="date"
                      value={founderHasta}
                      onChange={(e) => setFounderHasta(e.target.value)}
                      className={inputClass}
                      style={{ fontFamily: "var(--font-body)", color: "#111111", maxWidth: "200px" }}
                    />
                    {founderHasta && (
                      <button
                        type="button"
                        onClick={() => setFounderHasta("")}
                        className="text-xs underline"
                        style={{ fontFamily: "var(--font-body)", color: "#666666" }}
                      >
                        Quitar fecha
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs" style={{ fontFamily: "var(--font-body)", color: "#999999" }}>
                    Vacío = de por vida. Con fecha, el 0% rige hasta ese día inclusive.
                  </p>
                </div>
              )}

              {/* Tienda: se activa solo desde la bandeja, junto con el modo de cobro. */}
              <div className="flex items-center justify-between py-3 border-t border-[#e8e8e8]">
                <div>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#111111", fontWeight: 600 }}>
                    Tienda {seleccionado.tienda_activa ? "activa" : "no activa"}
                  </p>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#666666" }}>
                    Se activa o suspende en la bandeja de tiendas
                  </p>
                </div>
                <Link href="/admin/tiendas" className="text-sm font-semibold underline" style={{ fontFamily: "var(--font-body)", color: "#444444" }}>
                  Ir a tiendas
                </Link>
              </div>

              {/* Verificado */}
              <div className="flex items-center justify-between py-3 border-t border-[#e8e8e8]">
                <div>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#111111", fontWeight: 600 }}>
                    Artista verificado
                  </p>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#666666" }}>
                    Muestra el badge ✓ Verificado en su perfil público
                  </p>
                </div>
                <Switch checked={verificado} onCheckedChange={setVerificado} />
              </div>

              {/* Artista de prueba */}
              <div className="flex items-center justify-between py-3 border-t border-[#e8e8e8]">
                <div>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#111111", fontWeight: 600 }}>
                    Artista de prueba
                  </p>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#666666" }}>
                    Fuera de la tienda, las noticias, el sitemap y las métricas. Su ficha y productos solo abren por URL directa, sin indexar
                  </p>
                </div>
                <Switch checked={esPrueba} onCheckedChange={setEsPrueba} />
              </div>

              <Link
                href={`/admin/artistas/${seleccionado.id}/editar`}
                className="flex items-center justify-center gap-2 w-full h-10 rounded-md border text-sm font-semibold transition-colors"
                style={{
                  fontFamily: "var(--font-body)",
                  borderColor: "#e8e8e8",
                  color: "#444444",
                  backgroundColor: "#ffffff",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8f7f5")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
              >
                <Pencil size={13} /> Editar perfil completo
              </Link>

              <button
                onClick={guardar}
                disabled={guardando}
                className="w-full h-10 rounded-md text-white text-sm font-semibold"
                style={{ fontFamily: "var(--font-body)", backgroundColor: guardando ? "#f0a0b0" : "#e8003d" }}
              >
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog invitar artista */}
      <Dialog open={invitarOpen} onOpenChange={setInvitarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-titulo)" }}>Invitar artista</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <label style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#444444" }}>
              Email del artista
            </label>
            <input
              type="email"
              value={emailInvitar}
              onChange={(e) => setEmailInvitar(e.target.value)}
              placeholder="artista@ejemplo.com"
              className="w-full mt-2 rounded-md px-3 py-2 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none"
              style={{ fontFamily: "var(--font-body)" }}
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => setInvitarOpen(false)}
              className="px-4 py-2 rounded border text-sm"
              style={{ fontFamily: "var(--font-body)", borderColor: "#e8e8e8", color: "#666666" }}
            >
              Cancelar
            </button>
            <button
              onClick={invitar}
              disabled={invitando || !emailInvitar.trim()}
              className="px-4 py-2 rounded text-white text-sm"
              style={{ fontFamily: "var(--font-body)", backgroundColor: "#e8003d" }}
            >
              {invitando ? "Enviando..." : "Enviar invitación"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
