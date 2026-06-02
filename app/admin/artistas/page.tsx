"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Music, UserPlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

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
  tienda_activa: boolean;
  verificado: boolean;
}

export default function ArtistasPage() {
  const queryClient = useQueryClient();

  const [seleccionado, setSeleccionado] = useState<Artista | null>(null);
  const [comision, setComision] = useState(0);
  const [esFounder, setEsFounder] = useState(false);
  const [tiendaActiva, setTiendaActiva] = useState(false);
  const [verificado, setVerificado] = useState(false);
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
        .select("id, nombre, slug, foto_url, bio, ciudad, region, comision, es_founder, tienda_activa, verificado")
        .order("nombre");
      console.log("admin artistas data:", data);
      console.log("admin artistas error:", error);
      if (error) throw error;
      return (data ?? []) as Artista[];
    },
  });

  useEffect(() => {
    if (seleccionado) {
      setComision(seleccionado.comision ?? 0);
      setEsFounder(seleccionado.es_founder ?? false);
      setTiendaActiva(seleccionado.tienda_activa ?? false);
      setVerificado(seleccionado.verificado ?? false);
    }
  }, [seleccionado?.id]);

  const guardar = async () => {
    if (!seleccionado) return;
    setGuardando(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("artistas")
      .update({ comision: esFounder ? 0 : comision, es_founder: esFounder, tienda_activa: tiendaActiva, verificado })
      .eq("id", seleccionado.id);
    if (error) { toast.error("Error al guardar"); }
    else {
      toast.success("Cambios guardados");
      queryClient.invalidateQueries({ queryKey: ["admin-artistas"] });
    }
    setGuardando(false);
  };

  const invitar = async () => {
    if (!emailInvitar.trim()) return;
    setInvitando(true);
    const supabase = createClient();

    // Intenta Edge Function primero
    try {
      const { error } = await supabase.functions.invoke("invitar-artista", {
        body: { email: emailInvitar.trim() },
      });
      if (!error) {
        toast.success("Invitación enviada por email");
        setInvitarOpen(false);
        setEmailInvitar("");
        setInvitando(false);
        return;
      }
    } catch {
      // fallthrough al magic link directo
    }

    // Fallback: magic link real via Supabase Auth
    const siteUrl = process.env.NEXT_PUBLIC_URL ?? window.location.origin;
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: emailInvitar.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${siteUrl}/registro`,
      },
    });

    if (otpError) {
      toast.error(otpError.message);
    } else {
      toast.success("Magic link enviado al email del artista");
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
          <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: "16px", fontWeight: "600", color: "#111111" }}>
            Artistas ({artistas.length})
          </h2>
          <button
            onClick={() => setInvitarOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-white text-xs"
            style={{ fontFamily: "Barlow, sans-serif", backgroundColor: "#e8003d" }}
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
                onClick={() => setSeleccionado(a)}
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
                    style={{ backgroundColor: "#e8003d", fontFamily: "Oswald, sans-serif" }}>
                    {a.nombre[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ fontFamily: "Barlow, sans-serif", color: "#111111", fontWeight: 600 }}>
                    {a.nombre}
                  </p>
                  <p className="text-xs truncate" style={{ fontFamily: "Barlow, sans-serif", color: "#999999" }}>
                    {a.region ?? "Sin región"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{
                    fontFamily: "Barlow, sans-serif",
                    backgroundColor: a.es_founder ? "#fef9c3" : "#f3f4f6",
                    color: a.es_founder ? "#854d0e" : "#666666",
                  }}>
                    {a.es_founder ? "Founder 0%" : `${a.comision ?? 0}%`}
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
              <p style={{ fontFamily: "Oswald, sans-serif", fontSize: "18px", color: "#999999" }}>
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
                  style={{ backgroundColor: "#e8003d", fontFamily: "Oswald, sans-serif" }}>
                  {seleccionado.nombre[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: "22px", fontWeight: "700", color: "#111111" }}>
                  {seleccionado.nombre}
                </h2>
                {seleccionado.region && (
                  <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#666666" }}>
                    {[seleccionado.ciudad, seleccionado.region].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>

            {seleccionado.bio && (
              <p className="mb-6" style={{ fontFamily: "DM Sans, sans-serif", fontSize: "14px", color: "#666666", lineHeight: 1.6 }}>
                {seleccionado.bio}
              </p>
            )}

            <div className="flex flex-col gap-5">
              {/* Comisión */}
              <div>
                <label style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }} className={labelClass}>
                  Comisión (%)
                </label>
                <input
                  type="number"
                  min={0} max={100}
                  value={comision}
                  onChange={(e) => setComision(Number(e.target.value))}
                  disabled={esFounder}
                  className={inputClass}
                  style={{
                    fontFamily: "DM Sans, sans-serif",
                    color: "#111111",
                    opacity: esFounder ? 0.5 : 1,
                    cursor: esFounder ? "not-allowed" : "text",
                  }}
                />
                {esFounder && (
                  <p className="mt-1 text-xs" style={{ fontFamily: "Barlow, sans-serif", color: "#854d0e" }}>
                    Los artistas Founder tienen 0% de comisión
                  </p>
                )}
              </div>

              {/* Es Founder */}
              <div className="flex items-center justify-between py-3 border-t border-[#e8e8e8]">
                <div>
                  <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#111111", fontWeight: 600 }}>
                    Es Founder
                  </p>
                  <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#666666" }}>
                    Comisión 0% de por vida
                  </p>
                </div>
                <Switch
                  checked={esFounder}
                  onCheckedChange={(checked) => {
                    setEsFounder(checked);
                    if (checked) setComision(0);
                  }}
                />
              </div>

              {/* Tienda activa */}
              <div className="flex items-center justify-between py-3 border-t border-[#e8e8e8]">
                <div>
                  <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#111111", fontWeight: 600 }}>
                    Tienda activa
                  </p>
                  <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#666666" }}>
                    Visible en el marketplace
                  </p>
                </div>
                <Switch checked={tiendaActiva} onCheckedChange={setTiendaActiva} />
              </div>

              {/* Verificado */}
              <div className="flex items-center justify-between py-3 border-t border-[#e8e8e8]">
                <div>
                  <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#111111", fontWeight: 600 }}>
                    Artista verificado
                  </p>
                  <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#666666" }}>
                    Muestra el badge ✓ Verificado en su perfil público
                  </p>
                </div>
                <Switch checked={verificado} onCheckedChange={setVerificado} />
              </div>

              <Link
                href={`/admin/artistas/${seleccionado.id}/editar`}
                className="flex items-center justify-center gap-2 w-full h-10 rounded-md border text-sm font-semibold transition-colors"
                style={{
                  fontFamily: "Barlow, sans-serif",
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
                style={{ fontFamily: "Barlow, sans-serif", backgroundColor: guardando ? "#f0a0b0" : "#e8003d" }}
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
            <DialogTitle style={{ fontFamily: "Oswald, sans-serif" }}>Invitar artista</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#444444" }}>
              Email del artista
            </label>
            <input
              type="email"
              value={emailInvitar}
              onChange={(e) => setEmailInvitar(e.target.value)}
              placeholder="artista@ejemplo.com"
              className="w-full mt-2 rounded-md px-3 py-2 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none"
              style={{ fontFamily: "DM Sans, sans-serif" }}
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => setInvitarOpen(false)}
              className="px-4 py-2 rounded border text-sm"
              style={{ fontFamily: "Barlow, sans-serif", borderColor: "#e8e8e8", color: "#666666" }}
            >
              Cancelar
            </button>
            <button
              onClick={invitar}
              disabled={invitando || !emailInvitar.trim()}
              className="px-4 py-2 rounded text-white text-sm"
              style={{ fontFamily: "Barlow, sans-serif", backgroundColor: "#e8003d" }}
            >
              {invitando ? "Enviando..." : "Enviar invitación"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
