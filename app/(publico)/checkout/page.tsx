"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, ChevronDown, Lock } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useCarrito } from "@/lib/stores/carrito";
import { formatCLP, REGIONES_CHILE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { BotonQuitar, FOCO, MiniaturaItem, Monto, Stepper } from "@/components/tienda/carrito-ui";

interface Cupon {
  id: string;
  codigo: string;
  tipo_descuento: string;
  valor: number;
  expira_at?: string;
  usos_actuales: number;
  usos_maximos?: number;
}

const schema = z.object({
  nombre:    z.string().min(3, "Mínimo 3 caracteres"),
  email:     z.string().email("Email inválido"),
  telefono:  z.string().optional(),
  direccion: z.string().min(5, "Ingresa tu dirección completa"),
  ciudad:    z.string().min(2, "Ingresa tu ciudad"),
  region:    z.string().min(2, "Ingresa tu región"),
});

type FormData = z.infer<typeof schema>;

// ── Piezas de UI ─────────────────────────────────────────────────────────────

const TITULO = { fontFamily: "var(--font-titulo)" } as const;
const CAMPO =
  "h-12 w-full rounded-[10px] border border-tema-borde-campo bg-tema-fondo px-3.5 text-[15px] text-tema-texto outline-none transition-[border-color,box-shadow] placeholder:text-tema-texto-3 focus:border-tema-azul-texto focus:shadow-[0_0_0_3px_rgba(44,86,127,0.6)] aria-[invalid=true]:border-tema-rojo-texto";

function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`paso-${n}`} className="flex flex-col gap-[18px] rounded-xl border border-tema-borde bg-tema-campo p-[18px] md:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-tema-borde-campo bg-tema-hover text-[13px] font-bold" aria-hidden="true">{n}</span>
        <h2 id={`paso-${n}`} className="m-0 text-[26px] uppercase leading-none text-tema-texto" style={TITULO}>{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

function Campo({
  id, etiqueta, error, className, children,
}: { id: string; etiqueta: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-tema-texto">{etiqueta}</label>
      {children}
      {error && <p id={`${id}-error`} className="m-0 text-[13px] text-tema-rojo-texto">{error}</p>}
    </div>
  );
}

function Cargando({ texto }: { texto: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-tema-fondo">
      <p className="text-tema-texto-2">{texto}</p>
    </main>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const supabase = createClient();

  const items          = useCarrito((s) => s.items);
  const remover        = useCarrito((s) => s.remover);
  const actualizarCantidad = useCarrito((s) => s.actualizarCantidad);
  const totalFn        = useCarrito((s) => s.total);

  const [cuponCodigo,    setCuponCodigo]    = useState("");
  const [cuponAplicado,  setCuponAplicado]  = useState<Cupon | null>(null);
  const [buscandoCupon,  setBuscandoCupon]  = useState(false);
  const [metodoPago,     setMetodoPago]     = useState<"mercadopago" | "webpay">("mercadopago");
  const [pagando,        setPagando]        = useState(false);
  const [hidratado,      setHidratado]      = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    // persist solo existe en el cliente
    if (useCarrito.persist.hasHydrated()) {
      setHidratado(true);
      return;
    }
    return useCarrito.persist.onFinishHydration(() => setHidratado(true));
  }, []);

  useEffect(() => {
    if (hidratado && items.length === 0) router.replace("/tienda");
  }, [hidratado, items.length, router]);

  if (!hidratado) {
    return <Cargando texto="Cargando..." />;
  }

  if (items.length === 0) {
    return <Cargando texto="Redirigiendo..." />;
  }

  const subtotal = totalFn();

  const calcularDescuento = (): number => {
    if (!cuponAplicado) return 0;
    if (cuponAplicado.tipo_descuento === "porcentaje") return Math.round(subtotal * cuponAplicado.valor / 100);
    return Math.min(cuponAplicado.valor, subtotal);
  };

  const descuento = calcularDescuento();
  const total     = subtotal - descuento;

  const validarCupon = async () => {
    if (!cuponCodigo.trim()) return;
    setBuscandoCupon(true);
    try {
      const { data, error } = await supabase
        .from("cupones")
        .select("*")
        .eq("codigo", cuponCodigo.toUpperCase())
        .eq("activo", true)
        .single();

      if (error || !data) { toast.error("Cupón inválido o no existe"); return; }
      if (data.expira_at && new Date(data.expira_at) < new Date()) { toast.error("Este cupón ha expirado"); return; }
      if (data.usos_maximos && data.usos_actuales >= data.usos_maximos) { toast.error("Este cupón ya alcanzó su límite de usos"); return; }

      setCuponAplicado(data as Cupon);
      toast.success(`Cupón aplicado: ${data.valor}${data.tipo_descuento === "porcentaje" ? "%" : ` ${formatCLP(data.valor)}`} de descuento`);
    } finally {
      setBuscandoCupon(false);
    }
  };

  const onSubmit = async (comprador: FormData) => {
    if (metodoPago !== "mercadopago") { toast.info("WebPay estará disponible próximamente"); return; }
    setPagando(true);
    try {
      const res = await fetch("/api/mercadopago/crear-preferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ id: i.id, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad, imagen: i.imagen })),
          comprador,
          cupon_id: cuponAplicado?.id ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Error al procesar el pago"); return; }
      const url = data.modo === "produccion" ? data.init_point : data.sandbox_init_point;
      window.location.href = url;
    } catch {
      toast.error("Error de conexión. Intenta de nuevo.");
    } finally {
      setPagando(false);
    }
  };

  /** Props de accesibilidad de un campo del formulario. */
  const a11y = (campo: keyof FormData) => ({
    id: `chk-${campo}`,
    "aria-invalid": errors[campo] ? true : undefined,
    "aria-describedby": errors[campo] ? `chk-${campo}-error` : undefined,
  });

  const textoCupon = (c: Cupon) =>
    c.tipo_descuento === "porcentaje" ? `${c.valor}% de descuento` : `${formatCLP(c.valor)} de descuento`;

  const botonPagar = cn(
    "flex h-[52px] items-center justify-center gap-2.5 rounded-[10px] border-0 px-6 text-base font-bold text-tema-texto",
    pagando ? "cursor-not-allowed bg-tema-rojo-oscuro" : "cursor-pointer bg-tema-rojo hover:brightness-110",
    FOCO
  );

  return (
    <main className="min-h-screen bg-tema-fondo text-tema-texto">
      <div className="mx-auto max-w-[1280px] px-5 md:px-10">
        <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-[9px] pb-1 pt-(--aire-bajo-header) text-[13px] text-tema-texto-3 md:pt-[calc(var(--aire-bajo-header)+4px)]">
          <Link href="/tienda" className="text-tema-texto-3 hover:text-tema-texto-claro">Tienda</Link>
          <span aria-hidden="true">/</span>
          <Link href="/carrito" className="text-tema-texto-3 hover:text-tema-texto-claro">Carrito</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-tema-texto-claro">Checkout</span>
        </nav>

        <header className="flex flex-col gap-1.5 pb-[22px] pt-3">
          <h1 className="m-0 text-[40px] uppercase leading-none text-tema-texto md:text-[64px]" style={TITULO}>Casi listo</h1>
          <p className="m-0 text-[15px] text-tema-texto-2">Revisa tu pedido y déjanos tus datos para cerrar la compra.</p>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-1 items-start gap-3 pb-8 md:gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:pb-20">

            {/* ── Columna izquierda ── */}
            <div className="flex min-w-0 flex-col gap-3 md:gap-6">

              <Paso n={1} titulo="Tu pedido">
                <ul className="m-0 flex list-none flex-col p-0">
                  {items.map((item) => (
                    <li key={item.id} className="grid grid-cols-[56px_minmax(0,1fr)] gap-3.5 border-b border-tema-borde py-3 sm:grid-cols-[56px_minmax(0,1fr)_auto] sm:items-center">
                      <MiniaturaItem imagen={item.imagen} size={56} />
                      <div className="min-w-0">
                        <p className="m-0 text-[15px] font-bold leading-[1.35] text-tema-texto">{item.nombre}</p>
                        <p className="m-0 text-[13px] text-tema-texto-3">
                          {item.artista ? `${item.artista} · ` : ""}{formatCLP(item.precio)} c/u
                        </p>
                      </div>
                      <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:justify-end">
                        <Stepper
                          nombre={item.nombre}
                          cantidad={item.cantidad}
                          onMenos={() => actualizarCantidad(item.id, item.cantidad - 1)}
                          onMas={() => actualizarCantidad(item.id, item.cantidad + 1)}
                        />
                        <Monto className="min-w-[84px] text-right text-xl text-tema-precio">{formatCLP(item.precio * item.cantidad)}</Monto>
                        <BotonQuitar nombre={item.nombre} onClick={() => remover(item.id)} />
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col gap-2">
                  <label htmlFor="chk-cupon" className="text-[10px] font-bold uppercase tracking-[0.16em] text-tema-texto-3">¿Tienes un cupón?</label>
                  {cuponAplicado ? (
                    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-tema-ok bg-tema-ok/15 px-3.5 py-3">
                      <span className="flex items-center gap-2 text-sm text-tema-texto">
                        <Check size={16} strokeWidth={3} className="shrink-0 text-tema-ok-texto" aria-hidden="true" />
                        <span><strong className="font-bold">{cuponAplicado.codigo}</strong> aplicado: {textoCupon(cuponAplicado)}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => { setCuponAplicado(null); setCuponCodigo(""); }}
                        className={cn("shrink-0 cursor-pointer border-0 bg-transparent p-0 text-[13px] font-bold text-tema-azul-texto hover:text-tema-azul-texto-hover", FOCO)}
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2.5">
                      <input
                        id="chk-cupon"
                        type="text"
                        value={cuponCodigo}
                        onChange={(e) => setCuponCodigo(e.target.value.toUpperCase())}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); validarCupon(); } }}
                        placeholder="Escribe tu código"
                        autoComplete="off"
                        className={cn(CAMPO, "min-w-0 flex-1 uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal")}
                      />
                      <button
                        type="button"
                        onClick={validarCupon}
                        disabled={buscandoCupon}
                        className={cn("h-12 shrink-0 cursor-pointer rounded-[10px] border-0 bg-tema-azul px-5 text-sm font-bold text-tema-texto hover:brightness-110 disabled:cursor-wait disabled:opacity-70", FOCO)}
                      >
                        {buscandoCupon ? "..." : "Aplicar"}
                      </button>
                    </div>
                  )}
                </div>
              </Paso>

              <Paso n={2} titulo="Tus datos">
                <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                  <Campo id="chk-nombre" etiqueta="Nombre completo" error={errors.nombre?.message} className="md:col-span-2">
                    <input {...register("nombre")} {...a11y("nombre")} autoComplete="name" className={CAMPO} />
                  </Campo>
                  <Campo id="chk-email" etiqueta="Correo" error={errors.email?.message}>
                    <input type="email" {...register("email")} {...a11y("email")} autoComplete="email" placeholder="tu@correo.cl" className={CAMPO} />
                  </Campo>
                  <Campo id="chk-telefono" etiqueta="Teléfono (opcional)">
                    <input type="tel" {...register("telefono")} id="chk-telefono" autoComplete="tel" placeholder="+56 9 1234 5678" className={CAMPO} />
                  </Campo>
                </div>
              </Paso>

              <Paso n={3} titulo="Dirección de envío">
                <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                  <Campo id="chk-direccion" etiqueta="Dirección" error={errors.direccion?.message} className="md:col-span-2">
                    <input {...register("direccion")} {...a11y("direccion")} autoComplete="street-address" placeholder="Av. Ejemplo 1234, depto 5A" className={CAMPO} />
                  </Campo>
                  <Campo id="chk-ciudad" etiqueta="Ciudad" error={errors.ciudad?.message}>
                    <input {...register("ciudad")} {...a11y("ciudad")} autoComplete="address-level2" className={CAMPO} />
                  </Campo>
                  <Campo id="chk-region" etiqueta="Región" error={errors.region?.message}>
                    <span className="relative block">
                      <select {...register("region")} {...a11y("region")} defaultValue="" autoComplete="address-level1" className={cn(CAMPO, "cursor-pointer appearance-none pr-9")}>
                        <option value="" disabled>Selecciona tu región</option>
                        {REGIONES_CHILE.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <ChevronDown size={14} strokeWidth={3} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-tema-texto-2" />
                    </span>
                  </Campo>
                </div>
              </Paso>
            </div>

            {/* ── Columna derecha — Resumen ── */}
            <aside aria-label="Resumen del pedido" className="min-w-0 lg:sticky lg:top-[calc(var(--header-ocupa)+24px)]">
              <div className="flex flex-col gap-4 rounded-xl border border-tema-borde bg-tema-campo p-[18px] md:p-6">
                <h2 className="m-0 text-[26px] uppercase leading-none text-tema-texto" style={TITULO}>Resumen</h2>

                <dl className="m-0 flex flex-col gap-2.5 text-[15px] text-tema-texto-claro">
                  <div className="flex justify-between gap-3">
                    <dt>Subtotal ({items.reduce((a, i) => a + i.cantidad, 0)} productos)</dt>
                    <dd className="m-0 tabular-nums">{formatCLP(subtotal)}</dd>
                  </div>
                  {cuponAplicado && (
                    <div className="flex justify-between gap-3 text-tema-ok-texto">
                      <dt>Cupón {cuponAplicado.codigo}</dt>
                      <dd className="m-0 tabular-nums">−{formatCLP(descuento)}</dd>
                    </div>
                  )}
                </dl>

                <div className="flex items-baseline justify-between border-t border-tema-borde-campo pt-4">
                  <span className="text-[15px] font-bold">Total</span>
                  <Monto className="text-[44px] text-tema-texto">{formatCLP(total)}</Monto>
                </div>

                <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
                  <legend className="mb-2.5 p-0 text-[10px] font-bold uppercase tracking-[0.16em] text-tema-texto-3">Método de pago</legend>
                  <button
                    type="button"
                    onClick={() => setMetodoPago("mercadopago")}
                    aria-pressed={metodoPago === "mercadopago"}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-[10px] border p-3.5 text-left",
                      metodoPago === "mercadopago" ? "border-tema-azul bg-tema-azul-fondo" : "border-tema-borde bg-transparent",
                      FOCO
                    )}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-tema-azul-texto" aria-hidden="true">
                      {metodoPago === "mercadopago" && <span className="h-2.5 w-2.5 rounded-full bg-tema-azul-texto" />}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[15px] font-bold text-tema-texto">MercadoPago</span>
                      <span className="text-[13px] text-tema-azul-texto-suave">Tarjetas de crédito y débito</span>
                    </span>
                  </button>
                  <div className="flex select-none items-center gap-3 rounded-[10px] border border-tema-borde p-3.5 opacity-55" aria-disabled="true">
                    <span className="h-5 w-5 shrink-0 rounded-full border-2 border-[#5A5A5A]" aria-hidden="true" />
                    <span className="flex-1 text-[15px] font-bold text-tema-texto">WebPay</span>
                    <span className="rounded-md border border-tema-borde-campo px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.12em] text-tema-texto-claro">Próximamente</span>
                  </div>
                </fieldset>

                <button type="submit" disabled={pagando} className={cn(botonPagar, "hidden lg:flex")}>
                  {pagando ? "Procesando..." : `Ir a pagar ${formatCLP(total)}`}
                </button>

                <p className="m-0 flex items-start gap-[9px] text-[13px] leading-[1.55] text-tema-texto-3">
                  <Lock size={14} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Pagas en MercadoPago. MuzikChile no guarda los datos de tu tarjeta.
                </p>
              </div>
            </aside>
          </div>

          {/* Barra fija en móvil y tablet: total + pagar */}
          <div className="sticky bottom-0 z-20 -mx-5 flex items-center gap-3.5 border-t border-tema-borde-campo bg-tema-superficie/95 px-5 py-3 backdrop-blur md:-mx-10 md:px-10 lg:hidden">
            <div className="flex flex-col gap-px">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-tema-texto-3">Total</span>
              <Monto className="text-[28px] text-tema-texto">{formatCLP(total)}</Monto>
            </div>
            <button type="submit" disabled={pagando} className={cn(botonPagar, "h-[50px] flex-1")}>
              {pagando ? "Procesando..." : "Ir a pagar"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
