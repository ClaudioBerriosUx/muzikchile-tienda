"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, CircleDashed, ExternalLink } from "lucide-react";
import { AyudaDespacho, QuePuedesVender } from "@/components/panel/AyudaTienda";
import ConexionMP from "@/components/panel/ConexionMP";
import { createClient } from "@/lib/supabase/client";
import { CORREO_CONTACTO } from "@/lib/site";
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

const ETIQUETA_CHECKLIST: Record<keyof ChecklistTienda, string> = {
  terminos:  "Términos aceptados",
  mp:        "Mercado Pago conectado",
  identidad: "Identidad de Mercado Pago declarada",
  despacho:  "Despacho o retiro definido",
  producto:  "Al menos un producto en borrador",
};

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

/** Una vista por estado: cada una decide qué se ve y qué se puede editar. */
function TiendaContenido() {
  const queryClient = useQueryClient();

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

  return (
    <div className="max-w-3xl">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 style={{ ...TITULO, fontSize: "28px", color: "#111111" }}>Mi tienda</h1>
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ ...TEXTO, backgroundColor: COLOR_ESTADO[data.estado].bg, color: COLOR_ESTADO[data.estado].text }}
        >
          {ETIQUETA_ESTADO_TIENDA[data.estado]}
        </span>
      </div>

      {data.estado === "activa" && <VistaActiva data={data} onCambio={refrescar} />}
      {data.estado === "solicitada" && <VistaSolicitada data={data} />}
      {data.estado === "suspendida" && <VistaSuspendida data={data} />}
      {(data.estado === "no_activa" || data.estado === "devuelta") && <VistaChecklist data={data} onCambio={refrescar} />}
    </div>
  );
}

// ── no_activa y devuelta: el checklist editable ──────────────────────────────

function VistaChecklist({ data, onCambio }: { data: PanelTienda; onCambio: () => void }) {
  const [enviando, setEnviando] = useState(false);
  const { checklist, estado } = data;
  const faltan = (Object.keys(FALTA_CHECKLIST) as (keyof ChecklistTienda)[]).filter((k) => !checklist[k]);

  const solicitar = async () => {
    setEnviando(true);
    try {
      const res = await fetch("/api/panel/tienda/solicitar", { method: "POST" });
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) throw new Error(cuerpo?.error ?? "No pudimos enviar tu solicitud.");
      toast.success("Solicitud enviada. La revisaremos pronto.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos enviar tu solicitud.");
    } finally {
      setEnviando(false);
      onCambio();
    }
  };

  return (
    <>
      <p className="mb-6" style={{ ...TEXTO, fontSize: "14px", color: "#666666" }}>
        Tu ficha y tus noticias ya funcionan sin tienda. Actívala cuando quieras vender en MuzikChile.
      </p>

      {estado === "devuelta" && data.comentario && (
        <Aviso fondo="#fff1f2" borde="#fda4af" color="#9f1239">
          <p className="mb-1" style={{ fontSize: "15px", fontWeight: 700 }}>Tu solicitud volvió con un comentario</p>
          <p>{data.comentario}</p>
          <p className="mt-2" style={{ fontSize: "13px" }}>Corrige lo indicado y vuelve a solicitar la activación.</p>
        </Aviso>
      )}

      <Tarjeta>
        <ComoFunciona data={data} />
      </Tarjeta>

      <h2 className="mb-3 mt-6" style={{ ...TITULO, fontSize: "18px", color: "#111111" }}>Para activar tu tienda</h2>

      <div className="flex flex-col gap-4">
        <Paso listo={checklist.terminos} titulo="1. Acepta los términos para artistas">
          <Terminos data={data} onCambio={onCambio} />
        </Paso>
        <Paso listo={checklist.mp} titulo="2. Conecta tu cuenta de Mercado Pago">
          <ConexionMP />
        </Paso>
        <Paso listo={checklist.identidad} titulo="3. Declara tu identidad en Mercado Pago">
          <Identidad data={data} onCambio={onCambio} />
        </Paso>
        <Paso listo={checklist.despacho} titulo="4. Define despacho o retiro">
          <AyudaDespacho />
          <div className="mt-4">
            {/* La key vuelve a cargar el formulario si lo guardado cambia. */}
            <FormDespacho key={JSON.stringify(data.despacho)} artistaId={data.artistaId} inicial={data.despacho} onCambio={onCambio} />
          </div>
        </Paso>
        <Paso listo={checklist.producto} titulo="5. Crea al menos un producto en borrador">
          <div className="mb-3"><QuePuedesVender /></div>
          <p className="mb-3" style={{ ...TEXTO, fontSize: "14px", color: "#666666" }}>
            Tus productos se guardan como borrador. Cuando aprobemos tu tienda, pasan a revisión sin que tengas que reenviarlos.
          </p>
          <BotonEnlace href="/panel/productos">Ir a mis productos</BotonEnlace>
        </Paso>
      </div>

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
    </>
  );
}

// ── solicitada: el checklist en solo lectura ─────────────────────────────────

function VistaSolicitada({ data }: { data: PanelTienda }) {
  const llaves = Object.keys(ETIQUETA_CHECKLIST) as (keyof ChecklistTienda)[];
  return (
    <>
      <div className="mt-4" />
      <Aviso fondo="#fffbeb" borde="#fde68a" color="#92400e">
        <p style={{ fontSize: "15px", fontWeight: 700 }}>Tu solicitud está en revisión</p>
        <p className="mt-1">Verás el resultado acá, en Mi tienda. Mientras tanto puedes seguir creando y editando borradores.</p>
      </Aviso>

      <Tarjeta titulo="Lo que enviaste">
        <ul className="flex flex-col gap-2">
          {llaves.map((k) => (
            <li key={k} className="flex items-center gap-2.5" style={{ ...TEXTO, fontSize: "14px", color: "#444444" }}>
              {data.checklist[k]
                ? <CheckCircle2 size={17} aria-label="Listo" className="shrink-0" style={{ color: "#16a34a" }} />
                : <CircleDashed size={17} aria-label="Pendiente" className="shrink-0" style={{ color: "#be123c" }} />}
              {ETIQUETA_CHECKLIST[k]}
            </li>
          ))}
        </ul>
        <p className="mt-3" style={{ ...TEXTO, fontSize: "13px", color: "#666666" }}>
          <TextoDespacho despacho={data.despacho} />
        </p>
      </Tarjeta>

      <div className="mt-4 flex flex-wrap gap-3">
        <BotonEnlace href="/panel/productos/nuevo">Crear un borrador</BotonEnlace>
        <BotonEnlace href="/panel/productos">Ir a mis productos</BotonEnlace>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <Plegable titulo="Cómo funciona"><ComoFunciona data={data} sinTitulo /></Plegable>
        <Plegable titulo="¿Qué puedes vender?"><QuePuedesVender /></Plegable>
      </div>
    </>
  );
}

// ── activa: el panel de la tienda ────────────────────────────────────────────

function VistaActiva({ data, onCambio }: { data: PanelTienda; onCambio: () => void }) {
  const accesos: { href: string; texto: string; contador?: number }[] = [
    { href: "/panel/productos/nuevo", texto: "Subir producto" },
    { href: "/panel/productos", texto: "Mis productos" },
    { href: "/panel/despacho", texto: "Por despachar", contador: data.porDespachar },
    { href: "/panel/cupones", texto: "Cupones" },
    { href: "/panel/liquidaciones", texto: "Liquidaciones" },
  ];

  return (
    <>
      <p className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1" style={{ ...TEXTO, fontSize: "14px", color: "#666666" }}>
        {data.activaDesde && <span>Activa desde el {fecha(data.activaDesde)}</span>}
        <a href={`/artista/${data.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline">
          Ver mi tienda pública <ExternalLink size={12} />
        </a>
      </p>

      {!data.checklist.mp && (
        <Aviso fondo="#fef2f2" borde="#fca5a5" color="#991b1b">
          <p style={{ fontSize: "15px", fontWeight: 700 }}>Tu cuenta de Mercado Pago está desconectada</p>
          <p className="mt-1">Tus productos aparecen como “Pronto disponible” y nadie puede comprarlos. Conéctala de nuevo más abajo.</p>
        </Aviso>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {accesos.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-[#e8e8e8] bg-white p-3 text-center text-sm font-semibold hover:border-[#111111]"
            style={{ ...TEXTO, color: "#111111" }}
          >
            {a.texto}
            {!!a.contador && (
              <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: "#e8003d" }}>{a.contador}</span>
            )}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <Tarjeta titulo="Mercado Pago"><ConexionMP /></Tarjeta>

        <Tarjeta titulo="Despacho y retiro">
          <FormDespacho key={JSON.stringify(data.despacho)} artistaId={data.artistaId} inicial={data.despacho} onCambio={onCambio} />
        </Tarjeta>

        <Tarjeta titulo="Comisión">
          <p style={{ ...TEXTO, fontSize: "14px", color: "#444444" }}>
            La comisión de tu tienda hoy es <strong>{data.comision.porcentaje}%</strong>
            {data.comision.detalle ? ` (${data.comision.detalle})` : ""}. Se descuenta automáticamente en cada venta.
          </p>
        </Tarjeta>

        <Tarjeta titulo="Términos para artistas">
          {!data.terminos.aceptadoAt && (
            <p className="mb-3 rounded-lg border p-3" style={{ ...TEXTO, fontSize: "14px", backgroundColor: "#fffbeb", borderColor: "#fde68a", color: "#92400e" }}>
              <strong>Hay una versión nueva de los términos.</strong>
              {data.ultimaAceptacion ? ` Aceptaste la versión ${data.ultimaAceptacion.version} el ${fecha(data.ultimaAceptacion.aceptadoAt)}.` : ""}
              {" "}Acéptala para seguir usando tu tienda.
            </p>
          )}
          <Terminos data={data} onCambio={onCambio} />
        </Tarjeta>

        <Plegable titulo="Cómo funciona"><ComoFunciona data={data} sinTitulo /></Plegable>
        <Plegable titulo="¿Cómo le llega el producto a tu comprador?"><AyudaDespacho /></Plegable>
        <Plegable titulo="¿Qué puedes vender?"><QuePuedesVender /></Plegable>
      </div>
    </>
  );
}

// ── suspendida ───────────────────────────────────────────────────────────────

function VistaSuspendida({ data }: { data: PanelTienda }) {
  return (
    <>
      <div className="mt-4" />
      <Aviso fondo="#fef2f2" borde="#fca5a5" color="#991b1b">
        <p style={{ fontSize: "15px", fontWeight: 700 }}>Tu tienda está suspendida</p>
        {data.comentario && <p className="mt-1"><strong>Motivo:</strong> {data.comentario}</p>}
      </Aviso>

      <div className="flex flex-col gap-4">
        <Tarjeta titulo="Qué corregir">
          <p style={{ ...TEXTO, fontSize: "14px", color: "#444444", lineHeight: 1.6 }}>
            Corrige lo que indica el motivo y escríbenos a{" "}
            <a href={`mailto:${CORREO_CONTACTO}`} className="font-semibold underline">{CORREO_CONTACTO}</a> contándonos qué hiciste.
            Revisamos tu caso y, si está resuelto, reactivamos tu tienda.
          </p>
        </Tarjeta>

        <Tarjeta titulo="Tus pedidos ya pagados">
          <p className="mb-3" style={{ ...TEXTO, fontSize: "14px", color: "#444444", lineHeight: 1.6 }}>
            La suspensión no cancela lo que ya vendiste: debes cumplir los pedidos ya pagados.
            {data.porDespachar > 0
              ? ` Tienes ${data.porDespachar === 1 ? "1 pedido" : `${data.porDespachar} pedidos`} por despachar.`
              : " Hoy no tienes pedidos por despachar."}
          </p>
          <BotonEnlace href="/panel/despacho">Ir a Por despachar</BotonEnlace>
        </Tarjeta>
      </div>
    </>
  );
}

// ── Piezas ───────────────────────────────────────────────────────────────────

function ComoFunciona({ data, sinTitulo }: { data: PanelTienda; sinTitulo?: boolean }) {
  return (
    <>
      {!sinTitulo && <h2 className="mb-3" style={{ ...TITULO, fontSize: "18px", color: "#111111" }}>Cómo funciona</h2>}
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
    </>
  );
}

function TextoDespacho({ despacho: d }: { despacho: DespachoTienda }) {
  const conEnvio = d.despacho_modo === "envio" || d.despacho_modo === "ambos";
  const conRetiro = d.despacho_modo === "retiro" || d.despacho_modo === "ambos";
  return (
    <>
      {conEnvio && <>Envío: ${(d.despacho_costo ?? 0).toLocaleString("es-CL")} por pedido, para todo Chile, {d.despacho_plazo_min} a {d.despacho_plazo_max} días hábiles. </>}
      {conRetiro && <>Retiro: {d.retiro_detalle}.</>}
    </>
  );
}

function Aviso({ fondo, borde, color, children }: { fondo: string; borde: string; color: string; children: React.ReactNode }) {
  return (
    <div role="status" className="mb-6 rounded-xl border p-4" style={{ ...TEXTO, fontSize: "14px", lineHeight: 1.6, backgroundColor: fondo, borderColor: borde, color }}>
      {children}
    </div>
  );
}

function Tarjeta({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#e8e8e8] bg-white p-6">
      {titulo && <h2 className="mb-3" style={{ ...TEXTO, fontSize: "15px", fontWeight: 700, color: "#111111" }}>{titulo}</h2>}
      {children}
    </section>
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

function Plegable({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-[#e8e8e8] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4" style={{ ...TEXTO, fontSize: "14px", fontWeight: 600, color: "#111111" }}>
        {titulo}
        <ChevronDown size={16} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

function BotonEnlace({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center rounded-md border px-5 text-sm font-semibold"
      style={{ ...TEXTO, borderColor: "#e8e8e8", color: "#444444", backgroundColor: "#ffffff" }}
    >
      {children}
    </Link>
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
            <input type="number" min={0} value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="3990" aria-describedby="ayuda-costo-envio" className={`${CAMPO} mt-1.5`} />
            <span id="ayuda-costo-envio" className="mt-1 block text-xs" style={{ color: "#666666" }}>
              Costo fijo por pedido, para todo Chile.
            </span>
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
            aria-describedby="ayuda-retiro"
            className={`${CAMPO} mt-1.5 resize-none`}
          />
          <span id="ayuda-retiro" className="mt-1 block text-xs" style={{ color: "#666666" }}>
            Se muestra en la ficha de tus productos y en el checkout.
          </span>
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
