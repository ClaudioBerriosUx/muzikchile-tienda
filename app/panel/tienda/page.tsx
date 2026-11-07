"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, CircleDashed, ExternalLink } from "lucide-react";
import { AyudaDespacho, QuePuedesVender } from "@/components/panel/AyudaTienda";
import ConexionMP from "@/components/panel/ConexionMP";
import { createClient } from "@/lib/supabase/client";
import {
  ETIQUETA_ESTADO_TIENDA,
  FALTA_CHECKLIST,
  type ChecklistTienda,
  type DespachoTienda,
  type EstadoTienda,
  type PanelTienda,
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

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

function TiendaContenido() {
  const queryClient = useQueryClient();
  const [enviando, setEnviando] = useState(false);

  const { data, isLoading, isError } = useQuery<PanelTienda>({
    queryKey: ["panel-tienda"],
    queryFn: async () => {
      const res = await fetch("/api/panel/tienda");
      if (!res.ok) throw new Error("No pudimos leer tu tienda");
      return res.json();
    },
  });

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ["panel-tienda"] });

  if (isLoading) return <p style={{ ...TEXTO, color: "#999999" }}>Cargando…</p>;
  if (isError || !data) return <p style={{ ...TEXTO, color: "#b91c1c" }}>No pudimos leer tu tienda. Recarga la página.</p>;

  const { estado, checklist } = data;
  const faltan = (Object.keys(FALTA_CHECKLIST) as (keyof ChecklistTienda)[]).filter((k) => !checklist[k]);
  const puedeSolicitar = estado === "no_activa" || estado === "devuelta";

  const solicitar = async () => {
    setEnviando(true);
    try {
      const res = await fetch("/api/panel/tienda/solicitar", { method: "POST" });
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) throw new Error(cuerpo?.error ?? "No pudimos enviar tu solicitud.");
      toast.success("Solicitud enviada. Te avisaremos cuando la revisemos.");
      refrescar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos enviar tu solicitud.");
      refrescar();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 style={{ ...TITULO, fontSize: "28px", color: "#111111" }}>Mi tienda</h1>
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ ...TEXTO, backgroundColor: COLOR_ESTADO[estado].bg, color: COLOR_ESTADO[estado].text }}
        >
          {ETIQUETA_ESTADO_TIENDA[estado]}
        </span>
      </div>
      <p className="mb-6" style={{ ...TEXTO, fontSize: "14px", color: "#666666" }}>
        Tu ficha y tus noticias ya funcionan sin tienda. Actívala cuando quieras vender en MuzikChile.
      </p>

      {estado === "solicitada" && (
        <Aviso fondo="#fffbeb" borde="#fde68a" color="#92400e">
          Estamos revisando tu solicitud. Mientras tanto puedes seguir editando tus borradores.
        </Aviso>
      )}
      {estado === "activa" && (
        <Aviso fondo="#f0fdf4" borde="#bbf7d0" color="#166534">
          Tu tienda está activa. Cada producto pasa por revisión antes de publicarse.
        </Aviso>
      )}
      {(estado === "devuelta" || estado === "suspendida") && data.comentario && (
        <Aviso fondo="#fff1f2" borde="#fecdd3" color="#9f1239">
          <strong>{estado === "devuelta" ? "Qué hay que corregir:" : "Motivo de la suspensión:"}</strong> {data.comentario}
        </Aviso>
      )}

      <section className="mb-6 rounded-xl border border-[#e8e8e8] bg-white p-6">
        <h2 className="mb-3" style={{ ...TITULO, fontSize: "18px", color: "#111111" }}>Cómo funciona</h2>
        <ul className="list-disc space-y-1.5 pl-5" style={{ ...TEXTO, fontSize: "14px", color: "#444444", lineHeight: 1.6 }}>
          <li>Cobras directo en tu cuenta de Mercado Pago.</li>
          <li>
            La comisión de MuzikChile se descuenta automáticamente en cada venta. La de tu tienda hoy es{" "}
            <strong>{data.comision.porcentaje}%</strong>
            {data.comision.detalle ? ` (${data.comision.detalle})` : ""}.
          </li>
          <li>Necesitas una cuenta de Mercado Pago con identidad verificada y saldo para devoluciones.</li>
          <li>Tú despachas los pedidos y defines el costo y el plazo.</li>
          <li>Tú emites la boleta o factura de cada venta.</li>
          <li>El comprador puede retractarse dentro de 10 días desde que recibe el producto, y la devolución sale de tu cuenta.</li>
          <li>Por ahora solo se venden productos físicos.</li>
        </ul>
      </section>

      <h2 className="mb-3" style={{ ...TITULO, fontSize: "18px", color: "#111111" }}>
        {puedeSolicitar ? "Para activar tu tienda" : "Tu configuración"}
      </h2>

      <div className="flex flex-col gap-4">
        <Paso listo={checklist.terminos} titulo="1. Acepta los términos para artistas">
          <Terminos data={data} onCambio={refrescar} />
        </Paso>

        <Paso listo={checklist.mp} titulo="2. Conecta tu cuenta de Mercado Pago">
          <ConexionMP />
        </Paso>

        <Paso listo={checklist.identidad} titulo="3. Declara tu identidad en Mercado Pago">
          <Identidad data={data} onCambio={refrescar} />
        </Paso>

        <Paso listo={checklist.despacho} titulo="4. Define despacho o retiro">
          {/* La key vuelve a cargar el formulario si lo guardado cambia. */}
          <FormDespacho key={JSON.stringify(data.despacho)} artistaId={data.artistaId} inicial={data.despacho} onCambio={refrescar} />
        </Paso>

        <Paso listo={checklist.producto} titulo="5. Crea al menos un producto en borrador">
          <div className="mb-3"><QuePuedesVender /></div>
          <p className="mb-3" style={{ ...TEXTO, fontSize: "14px", color: "#666666" }}>
            {estado === "activa"
              ? "Lo que subas pasa a revisión antes de publicarse."
              : "Tus productos se guardan como borrador. Cuando aprobemos tu tienda, pasan a revisión sin que tengas que reenviarlos."}
          </p>
          <Link
            href="/panel/productos"
            className="inline-flex h-10 items-center rounded-md border px-5 text-sm font-semibold"
            style={{ ...TEXTO, borderColor: "#e8e8e8", color: "#444444", backgroundColor: "#ffffff" }}
          >
            Ir a mis productos
          </Link>
        </Paso>
      </div>

      {puedeSolicitar && (
        <div className="mt-6 rounded-xl border border-[#e8e8e8] bg-white p-6">
          {faltan.length > 0 && (
            <p className="mb-2" style={{ ...TEXTO, fontSize: "14px", color: "#666666" }}>
              Falta: {faltan.map((k) => FALTA_CHECKLIST[k]).join(", ")}.
            </p>
          )}
          <p className="mb-3" style={{ ...TEXTO, fontSize: "14px", color: "#666666" }}>
            Revisamos tu solicitud y verás el resultado acá, en Mi tienda.
          </p>
          <button
            type="button"
            onClick={solicitar}
            disabled={faltan.length > 0 || enviando}
            className="h-11 w-full rounded-md text-sm font-semibold text-white"
            style={{
              ...TEXTO,
              backgroundColor: faltan.length > 0 || enviando ? "#d4d4d4" : "#e8003d",
              cursor: faltan.length > 0 || enviando ? "not-allowed" : "pointer",
            }}
          >
            {enviando ? "Enviando…" : estado === "devuelta" ? "Volver a solicitar activación" : "Solicitar activación"}
          </button>
        </div>
      )}
    </div>
  );
}

function Aviso({ fondo, borde, color, children }: { fondo: string; borde: string; color: string; children: React.ReactNode }) {
  return (
    <div role="status" className="mb-6 rounded-xl border p-4" style={{ ...TEXTO, fontSize: "14px", lineHeight: 1.6, backgroundColor: fondo, borderColor: borde, color }}>
      {children}
    </div>
  );
}

function Paso({ listo, titulo, children }: { listo: boolean; titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#e8e8e8] bg-white p-6">
      <div className="mb-3 flex items-center gap-2.5">
        {listo
          ? <CheckCircle2 size={18} aria-label="Listo" className="shrink-0" style={{ color: "#16a34a" }} />
          : <CircleDashed size={18} aria-label="Pendiente" className="shrink-0" style={{ color: "#999999" }} />}
        <h3 style={{ ...TEXTO, fontSize: "15px", fontWeight: 700, color: "#111111" }}>{titulo}</h3>
      </div>
      {children}
    </section>
  );
}

function Terminos({ data, onCambio }: { data: PanelTienda; onCambio: () => void }) {
  const [marcado, setMarcado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const enlace = (
    <a href="/terminos-artistas" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
      Términos para artistas <ExternalLink size={11} className="inline" />
    </a>
  );

  if (data.terminos.aceptadoAt) {
    return (
      <p style={{ ...TEXTO, fontSize: "14px", color: "#666666" }}>
        Aceptaste la versión {data.terminos.version} el {fecha(data.terminos.aceptadoAt)}. {enlace}
      </p>
    );
  }

  const aceptar = async () => {
    setGuardando(true);
    try {
      const res = await fetch("/api/panel/tienda/aceptar-terminos", { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Términos aceptados");
      onCambio();
    } catch {
      toast.error("No pudimos guardar tu aceptación. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-start gap-2.5" style={{ ...TEXTO, fontSize: "14px", color: "#444444" }}>
        <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} className="mt-1" />
        <span>Leí y acepto los {enlace}, versión {data.terminos.version}.</span>
      </label>
      <button
        type="button"
        onClick={aceptar}
        disabled={!marcado || guardando}
        className="h-10 w-fit rounded-md px-5 text-sm font-semibold text-white"
        style={{ ...TEXTO, backgroundColor: !marcado || guardando ? "#d4d4d4" : "#111111", cursor: !marcado || guardando ? "not-allowed" : "pointer" }}
      >
        {guardando ? "Guardando…" : "Aceptar términos"}
      </button>
    </div>
  );
}

function Identidad({ data, onCambio }: { data: PanelTienda; onCambio: () => void }) {
  const [guardando, setGuardando] = useState(false);

  const cambiar = async (valor: boolean) => {
    setGuardando(true);
    const supabase = createClient();
    const { data: filas, error } = await supabase
      .from("tiendas")
      .update({ identidad_mp_declarada: valor })
      .eq("artista_id", data.artistaId)
      .select("artista_id");
    if (error?.code === "22023") toast.error(error.message);
    else if (error || !filas?.length) toast.error("No pudimos guardar tu declaración. Intenta de nuevo.");
    onCambio();
    setGuardando(false);
  };

  const conectada = data.checklist.mp;

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-start gap-2.5" style={{ ...TEXTO, fontSize: "14px", color: conectada ? "#444444" : "#999999" }}>
        <input
          type="checkbox"
          checked={conectada && data.identidadDeclarada}
          disabled={guardando || !conectada}
          onChange={(e) => cambiar(e.target.checked)}
          className="mt-1"
        />
        <span>Declaro que la cuenta de Mercado Pago que conecté es mía y tiene mi identidad verificada. Lo revisamos al aprobar tu tienda.</span>
      </label>
      {!conectada && (
        <p style={{ ...TEXTO, fontSize: "13px", color: "#666666" }}>Primero conecta tu cuenta de Mercado Pago, en el paso 2.</p>
      )}
    </div>
  );
}

const CAMPO = "w-full rounded-md border border-[#e8e8e8] px-3 py-2.5 text-sm focus:border-[#e8003d] focus:outline-none";

function FormDespacho({ artistaId, inicial, onCambio }: { artistaId: string; inicial: DespachoTienda; onCambio: () => void }) {
  const [modo, setModo] = useState<DespachoTienda["despacho_modo"]>(inicial.despacho_modo);
  const [costo, setCosto] = useState(inicial.despacho_costo?.toString() ?? "");
  const [plazoMin, setPlazoMin] = useState(inicial.despacho_plazo_min?.toString() ?? "");
  const [plazoMax, setPlazoMax] = useState(inicial.despacho_plazo_max?.toString() ?? "");
  const [retiro, setRetiro] = useState(inicial.retiro_detalle ?? "");
  const [guardando, setGuardando] = useState(false);

  const conEnvio = modo === "envio" || modo === "ambos";
  const conRetiro = modo === "retiro" || modo === "ambos";

  const guardar = async () => {
    const entero = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : null);
    const c = entero(costo), min = entero(plazoMin), max = entero(plazoMax);

    if (!modo) { toast.error("Elige cómo entregas tus productos"); return; }
    if (conEnvio && c === null) { toast.error("Escribe el costo de envío. Si lo incluyes en el precio, pon 0."); return; }
    if (conEnvio && (min === null || max === null || max < min)) { toast.error("Revisa el plazo: desde y hasta, en días hábiles."); return; }
    if (conRetiro && !retiro.trim()) { toast.error("Escribe dónde y cuándo se retira"); return; }

    setGuardando(true);
    const supabase = createClient();
    const { data: filas, error } = await supabase
      .from("tiendas")
      .update({
        despacho_modo: modo,
        despacho_costo: conEnvio ? c : null,
        despacho_plazo_min: conEnvio ? min : null,
        despacho_plazo_max: conEnvio ? max : null,
        retiro_detalle: conRetiro ? retiro.trim() : null,
      })
      .eq("artista_id", artistaId)
      .select("artista_id");
    setGuardando(false);

    if (error || !filas?.length) {
      toast.error(error?.message ?? "No pudimos guardar el despacho. Intenta de nuevo.");
      return;
    }
    toast.success("Despacho guardado");
    onCambio();
  };

  const opciones: { valor: NonNullable<DespachoTienda["despacho_modo"]>; texto: string }[] = [
    { valor: "envio", texto: "Envío" },
    { valor: "retiro", texto: "Retiro" },
    { valor: "ambos", texto: "Envío y retiro" },
  ];

  return (
    <div className="flex flex-col gap-4" style={TEXTO}>
      <AyudaDespacho />
      <div role="group" aria-label="Cómo entregas" className="flex w-fit overflow-hidden rounded-md border border-[#e8e8e8]">
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            aria-pressed={modo === o.valor}
            onClick={() => setModo(o.valor)}
            className="px-4 py-2 text-sm"
            style={{ backgroundColor: modo === o.valor ? "#111111" : "#ffffff", color: modo === o.valor ? "#ffffff" : "#666666" }}
          >
            {o.texto}
          </button>
        ))}
      </div>

      {conEnvio && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm" style={{ color: "#444444" }}>
            Costo de envío (CLP)
            <input type="number" min={0} value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="3990" className={`${CAMPO} mt-1.5`} />
          </label>
          <label className="text-sm" style={{ color: "#444444" }}>
            Plazo desde (días hábiles)
            <input type="number" min={0} value={plazoMin} onChange={(e) => setPlazoMin(e.target.value)} placeholder="2" className={`${CAMPO} mt-1.5`} />
          </label>
          <label className="text-sm" style={{ color: "#444444" }}>
            Plazo hasta (días hábiles)
            <input type="number" min={0} value={plazoMax} onChange={(e) => setPlazoMax(e.target.value)} placeholder="5" className={`${CAMPO} mt-1.5`} />
          </label>
        </div>
      )}

      {conRetiro && (
        <label className="text-sm" style={{ color: "#444444" }}>
          Dónde y cuándo se retira
          <textarea
            value={retiro}
            maxLength={300}
            rows={2}
            onChange={(e) => setRetiro(e.target.value)}
            placeholder="Ej: Metro Baquedano, sábados de 12 a 14 h, coordinando por correo"
            className={`${CAMPO} mt-1.5 resize-none`}
          />
        </label>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="h-10 w-fit rounded-md px-5 text-sm font-semibold text-white"
        style={{ backgroundColor: guardando ? "#d4d4d4" : "#111111" }}
      >
        {guardando ? "Guardando…" : "Guardar despacho"}
      </button>
    </div>
  );
}

export default function TiendaPage() {
  return (
    <Suspense fallback={<p style={{ ...TEXTO, color: "#999999" }}>Cargando…</p>}>
      <TiendaContenido />
    </Suspense>
  );
}
