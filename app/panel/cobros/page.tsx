"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, CircleDashed, ExternalLink } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface EstadoConexion {
  modelo: string;
  conexion: {
    estado: "conectado" | "reconectar";
    nickname: string | null;
    email: string | null;
    live_mode: boolean;
    expires_at: string;
    conectado_at: string;
  } | null;
}

/** Mensajes del regreso desde /api/mp/oauth/callback (?conectado=1 o ?error=…). */
const MENSAJES_ERROR: Record<string, string> = {
  cancelado:          "No se completó la autorización en Mercado Pago. Puedes intentarlo de nuevo.",
  estado:             "El intento de conexión venció o no es válido. Vuelve a apretar “Conectar Mercado Pago”.",
  sesion:             "Tu sesión cambió durante la conexión. Entra de nuevo y vuelve a intentarlo.",
  cuenta_plataforma:  "Autorizaste con la cuenta de Mercado Pago de MuzikChile. Cierra esa sesión en Mercado Pago y conecta tu propia cuenta.",
  cuenta_duplicada:   "Esa cuenta de Mercado Pago ya está conectada a otro artista. Usa una cuenta tuya o escríbenos.",
  mp:                 "Mercado Pago no respondió como esperábamos. Intenta de nuevo en unos minutos.",
  config:             "No pudimos iniciar la conexión. Escríbenos si sigue pasando.",
};

const TEXTO = { fontFamily: "var(--font-body)" } as const;
const TITULO = { fontFamily: "var(--font-titulo)" } as const;

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

function CobrosContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [confirmarOpen, setConfirmarOpen] = useState(false);
  const [desconectando, setDesconectando] = useState(false);

  const { data, isLoading, isError } = useQuery<EstadoConexion>({
    queryKey: ["mp-conexion"],
    queryFn: async () => {
      const res = await fetch("/api/mp/conexion");
      if (!res.ok) throw new Error("No pudimos leer tu conexión");
      return res.json();
    },
  });

  // Resultado del OAuth: se muestra una vez y se limpia la URL.
  useEffect(() => {
    const error = searchParams.get("error");
    const conectado = searchParams.get("conectado");
    if (!error && !conectado) return;
    if (conectado) toast.success("Tu cuenta de Mercado Pago quedó conectada");
    else toast.error(MENSAJES_ERROR[error!] ?? MENSAJES_ERROR.config, { duration: 10_000 });
    router.replace("/panel/cobros");
  }, [searchParams, router]);

  const desconectar = async () => {
    setDesconectando(true);
    try {
      const res = await fetch("/api/mp/desconectar", { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Cuenta desconectada");
      setConfirmarOpen(false);
      queryClient.invalidateQueries({ queryKey: ["mp-conexion"] });
      queryClient.invalidateQueries({ queryKey: ["mp-conexion-shell"] });
    } catch {
      toast.error("No pudimos desconectar la cuenta. Intenta de nuevo.");
    } finally {
      setDesconectando(false);
    }
  };

  const conexion = data?.conexion ?? null;
  const estado = !conexion ? "no_conectado" : conexion.estado;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2" style={{ ...TITULO, fontSize: "28px", color: "#111111" }}>Cobros</h1>
      <p className="mb-8" style={{ ...TEXTO, fontSize: "14px", color: "#666666" }}>
        Conecta tu cuenta de Mercado Pago para recibir el dinero de tus ventas directo en ella.
        La comisión de MuzikChile se descuenta automáticamente en cada venta.
      </p>

      {data?.modelo !== "marketplace" && (
        <div className="mb-6 rounded-xl border p-4" style={{ backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }}>
          <p style={{ ...TEXTO, fontSize: "14px", color: "#1e3a8a" }}>
            Por ahora tus ventas se siguen pagando como hasta hoy, con liquidaciones de MuzikChile.
            Puedes conectar tu cuenta desde ya: te avisaremos antes de activar el cobro directo.
          </p>
        </div>
      )}

      {/* Estado */}
      <section className="mb-6 rounded-xl border border-[#e8e8e8] p-6 bg-white">
        {isLoading ? (
          <p style={{ ...TEXTO, color: "#999999" }}>Cargando…</p>
        ) : isError ? (
          <p style={{ ...TEXTO, color: "#b91c1c" }}>No pudimos leer el estado de tu conexión. Recarga la página.</p>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3">
              {estado === "conectado" && <CheckCircle2 size={22} className="mt-0.5 shrink-0" style={{ color: "#16a34a" }} />}
              {estado === "reconectar" && <AlertTriangle size={22} className="mt-0.5 shrink-0" style={{ color: "#b45309" }} />}
              {estado === "no_conectado" && <CircleDashed size={22} className="mt-0.5 shrink-0" style={{ color: "#999999" }} />}
              <div>
                <p style={{ ...TEXTO, fontSize: "16px", fontWeight: 600, color: "#111111" }}>
                  {estado === "conectado" && <>Conectado como {conexion?.nickname ?? conexion?.email ?? "tu cuenta"}</>}
                  {estado === "reconectar" && "Hay que reconectar tu cuenta"}
                  {estado === "no_conectado" && "No conectado"}
                </p>
                {conexion && estado === "conectado" && (
                  <p style={{ ...TEXTO, fontSize: "13px", color: "#666666" }}>
                    {conexion.email && conexion.nickname ? `${conexion.email} · ` : ""}
                    Conectada el {fecha(conexion.conectado_at)}
                    {!conexion.live_mode && " · cuenta de prueba"}
                  </p>
                )}
                {estado === "reconectar" && (
                  <p style={{ ...TEXTO, fontSize: "13px", color: "#92400e" }}>
                    Mercado Pago dejó de aceptar la autorización (la revocaste o venció).
                    Mientras no reconectes, tus productos no se podrán comprar con cobro directo.
                  </p>
                )}
                {estado === "no_conectado" && (
                  <p style={{ ...TEXTO, fontSize: "13px", color: "#666666" }}>
                    Sin una cuenta conectada, cuando se active el cobro directo tus productos se verán como “Pronto disponible”.
                  </p>
                )}
              </div>
            </div>

            {/* Aviso antes de autorizar */}
            {estado !== "conectado" && (
              <div className="rounded-lg border p-4" style={{ backgroundColor: "#fef9c3", borderColor: "#fde68a" }}>
                <p className="mb-2" style={{ ...TEXTO, fontSize: "14px", fontWeight: 600, color: "#854d0e" }}>
                  Antes de conectar, revisa con qué cuenta de Mercado Pago tienes sesión abierta
                </p>
                <ul className="list-disc pl-5" style={{ ...TEXTO, fontSize: "13px", color: "#854d0e", lineHeight: 1.6 }}>
                  <li>Mercado Pago usará la cuenta que tengas abierta en este navegador. Tus ventas se depositarán ahí.</li>
                  <li>Usa tu cuenta de vendedor, no una cuenta de comprador ni la de otra persona.</li>
                  <li>
                    Si no es la tuya, cierra sesión en{" "}
                    <a href="https://www.mercadopago.cl" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                      mercadopago.cl <ExternalLink size={11} className="inline" />
                    </a>{" "}
                    y vuelve acá.
                  </li>
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {estado !== "conectado" && (
                // Navegación completa (no fetch): el servidor redirige a Mercado Pago.
                <a
                  href="/api/mp/oauth/iniciar"
                  className="inline-flex h-10 items-center rounded-md px-5 text-sm font-semibold text-white"
                  style={{ ...TEXTO, backgroundColor: "#009ee3" }}
                >
                  {estado === "reconectar" ? "Reconectar Mercado Pago" : "Conectar Mercado Pago"}
                </a>
              )}
              {conexion && (
                <button
                  type="button"
                  onClick={() => setConfirmarOpen(true)}
                  className="inline-flex h-10 items-center rounded-md border px-5 text-sm font-semibold"
                  style={{ ...TEXTO, borderColor: "#e8e8e8", color: "#444444", backgroundColor: "#ffffff" }}
                >
                  Desconectar
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <p style={{ ...TEXTO, fontSize: "12px", color: "#999999", lineHeight: 1.6 }}>
        MuzikChile nunca ve tu contraseña de Mercado Pago. Puedes revocar el acceso cuando quieras desde
        tu cuenta de Mercado Pago o con el botón Desconectar.
      </p>

      <Dialog open={confirmarOpen} onOpenChange={setConfirmarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={TITULO}>¿Desconectar Mercado Pago?</DialogTitle>
          </DialogHeader>
          <p style={{ ...TEXTO, fontSize: "14px", color: "#444444" }}>
            Cuando el cobro directo esté activo, tus productos dejarán de poder comprarse hasta que vuelvas a conectar una cuenta.
          </p>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmarOpen(false)}
              className="h-10 rounded-md border px-4 text-sm"
              style={{ ...TEXTO, borderColor: "#e8e8e8", color: "#444444" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={desconectar}
              disabled={desconectando}
              className="h-10 rounded-md px-4 text-sm font-semibold text-white"
              style={{ ...TEXTO, backgroundColor: desconectando ? "#f0a0b0" : "#e8003d" }}
            >
              {desconectando ? "Desconectando…" : "Desconectar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CobrosPage() {
  return (
    <Suspense fallback={<p style={{ ...TEXTO, color: "#999999" }}>Cargando…</p>}>
      <CobrosContenido />
    </Suspense>
  );
}
