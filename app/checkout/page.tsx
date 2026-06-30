"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { X, Minus, Plus, Tag } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useCarrito } from "@/lib/stores/carrito";
import { formatCLP } from "@/lib/constants";
import Header from "@/components/layout/Header";

interface Cupon {
  id: string;
  codigo: string;
  tipo: string;
  valor: number;
  monto_minimo?: number;
  fecha_expiracion?: string;
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
    if (hidratado && items.length === 0) router.replace("/");
  }, [hidratado, items.length, router]);

  if (!hidratado) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f7f5" }}>
        <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Cargando...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f7f5" }}>
        <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Redirigiendo...</p>
      </div>
    );
  }

  const subtotal = totalFn();

  const calcularDescuento = (): number => {
    if (!cuponAplicado) return 0;
    if (cuponAplicado.tipo === "porcentaje") return Math.round(subtotal * cuponAplicado.valor / 100);
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
      if (data.fecha_expiracion && new Date(data.fecha_expiracion) < new Date()) { toast.error("Este cupón ha expirado"); return; }
      if (data.usos_maximos && data.usos_actuales >= data.usos_maximos) { toast.error("Este cupón ya alcanzó su límite de usos"); return; }
      if (data.monto_minimo && subtotal < data.monto_minimo) { toast.error(`Monto mínimo: ${formatCLP(data.monto_minimo)}`); return; }

      setCuponAplicado(data as Cupon);
      toast.success(`Cupón aplicado: ${data.valor}${data.tipo === "porcentaje" ? "%" : ` ${formatCLP(data.valor)}`} de descuento`);
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

  const inputClass = "w-full rounded-md px-3 py-2.5 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none transition-colors";
  const labelStyle = { fontFamily: "Barlow, sans-serif", fontSize: "14px" as const, color: "#444444" };
  const errStyle   = { fontFamily: "Barlow, sans-serif", fontSize: "12px" as const, color: "#e8003d" };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <h1 className="mb-8" style={{ fontFamily: "Oswald, sans-serif", fontSize: "32px", fontWeight: "700", color: "#111111" }}>
            Checkout
          </h1>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="grid grid-cols-3 gap-8">

              {/* ── Columna izquierda (col-span-2) ── */}
              <div className="col-span-2 flex flex-col gap-8">

                {/* Tu pedido */}
                <section>
                  <h2 className="mb-4" style={{ fontFamily: "Oswald, sans-serif", fontSize: "18px", fontWeight: "600", color: "#111111" }}>
                    Tu pedido
                  </h2>
                  <div className="rounded-xl border border-[#e8e8e8] overflow-hidden">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 border-b border-[#e8e8e8] last:border-b-0">
                        {item.imagen ? (
                          <img src={item.imagen} alt={item.nombre} className="w-14 h-14 rounded object-cover shrink-0 border border-[#e8e8e8]" />
                        ) : (
                          <div className="w-14 h-14 rounded bg-[#f8f7f5] shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ fontFamily: "Oswald, sans-serif", color: "#111111" }}>{item.nombre}</p>
                          {item.artista && <p className="text-xs" style={{ fontFamily: "Barlow, sans-serif", color: "#999" }}>{item.artista}</p>}
                          <p className="text-sm font-bold mt-0.5" style={{ fontFamily: "DM Sans, sans-serif", color: "#e8003d" }}>{formatCLP(item.precio)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button type="button" onClick={() => actualizarCantidad(item.id, item.cantidad - 1)} className="w-7 h-7 rounded border border-[#e8e8e8] flex items-center justify-center">
                            <Minus size={11} />
                          </button>
                          <span className="w-6 text-center text-sm" style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}>{item.cantidad}</span>
                          <button type="button" onClick={() => actualizarCantidad(item.id, item.cantidad + 1)} className="w-7 h-7 rounded border border-[#e8e8e8] flex items-center justify-center">
                            <Plus size={11} />
                          </button>
                        </div>
                        <p className="text-sm font-semibold w-20 text-right shrink-0" style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}>
                          {formatCLP(item.precio * item.cantidad)}
                        </p>
                        <button type="button" onClick={() => remover(item.id)} className="text-[#ccc] hover:text-[#e8003d] transition-colors shrink-0">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <div className="flex justify-between p-3" style={{ backgroundColor: "#f8f7f5" }}>
                      <span style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Subtotal</span>
                      <span style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 700, color: "#111111" }}>{formatCLP(subtotal)}</span>
                    </div>
                  </div>
                </section>

                {/* Cupón */}
                <section>
                  <h2 className="mb-3" style={{ fontFamily: "Oswald, sans-serif", fontSize: "18px", fontWeight: "600", color: "#111111" }}>
                    ¿Tienes un cupón?
                  </h2>
                  {cuponAplicado ? (
                    <div className="flex items-center justify-between p-3 rounded-lg border" style={{ backgroundColor: "#dcfce7", borderColor: "#86efac" }}>
                      <div className="flex items-center gap-2">
                        <Tag size={15} style={{ color: "#166534" }} />
                        <span style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#166534", fontWeight: 600 }}>
                          {cuponAplicado.codigo} — {cuponAplicado.tipo === "porcentaje" ? `${cuponAplicado.valor}% de descuento` : `${formatCLP(cuponAplicado.valor)} de descuento`}
                        </span>
                      </div>
                      <button type="button" onClick={() => { setCuponAplicado(null); setCuponCodigo(""); }} className="text-xs underline" style={{ fontFamily: "Barlow, sans-serif", color: "#166534" }}>
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={cuponCodigo}
                        onChange={(e) => setCuponCodigo(e.target.value.toUpperCase())}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); validarCupon(); } }}
                        placeholder="CÓDIGO"
                        className={`${inputClass} uppercase tracking-widest`}
                        style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
                      />
                      <button type="button" onClick={validarCupon} disabled={buscandoCupon} className="px-5 py-2 rounded-md text-white text-sm font-semibold shrink-0" style={{ fontFamily: "Barlow, sans-serif", backgroundColor: "#111111" }}>
                        {buscandoCupon ? "..." : "Aplicar"}
                      </button>
                    </div>
                  )}
                </section>

                {/* Datos comprador */}
                <section>
                  <h2 className="mb-4" style={{ fontFamily: "Oswald, sans-serif", fontSize: "18px", fontWeight: "600", color: "#111111" }}>
                    Datos del comprador
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label style={labelStyle} className="block mb-1.5">Nombre completo</label>
                      <input {...register("nombre")} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }} />
                      {errors.nombre && <p className="mt-1" style={errStyle}>{errors.nombre.message}</p>}
                    </div>
                    <div>
                      <label style={labelStyle} className="block mb-1.5">Email</label>
                      <input type="email" {...register("email")} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }} />
                      {errors.email && <p className="mt-1" style={errStyle}>{errors.email.message}</p>}
                    </div>
                    <div>
                      <label style={labelStyle} className="block mb-1.5">Teléfono (opcional)</label>
                      <input type="tel" {...register("telefono")} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }} />
                    </div>
                    <div className="col-span-2">
                      <label style={labelStyle} className="block mb-1.5">Dirección de envío</label>
                      <input {...register("direccion")} placeholder="Av. Ejemplo 1234, depto 5A" className={inputClass} style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }} />
                      {errors.direccion && <p className="mt-1" style={errStyle}>{errors.direccion.message}</p>}
                    </div>
                    <div>
                      <label style={labelStyle} className="block mb-1.5">Ciudad</label>
                      <input {...register("ciudad")} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }} />
                      {errors.ciudad && <p className="mt-1" style={errStyle}>{errors.ciudad.message}</p>}
                    </div>
                    <div>
                      <label style={labelStyle} className="block mb-1.5">Región</label>
                      <input {...register("region")} className={inputClass} style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }} />
                      {errors.region && <p className="mt-1" style={errStyle}>{errors.region.message}</p>}
                    </div>
                  </div>
                </section>
              </div>

              {/* ── Columna derecha — Resumen ── */}
              <div>
                <div className="sticky top-20 rounded-xl border border-[#e8e8e8] p-6" style={{ backgroundColor: "#f8f7f5" }}>
                  <h2 className="mb-4" style={{ fontFamily: "Oswald, sans-serif", fontSize: "18px", fontWeight: "600", color: "#111111" }}>Resumen</h2>

                  <div className="flex flex-col gap-2 mb-4">
                    {items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm gap-2">
                        <span className="truncate" style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
                          {item.nombre}{item.cantidad > 1 ? ` ×${item.cantidad}` : ""}
                        </span>
                        <span className="shrink-0" style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}>
                          {formatCLP(item.precio * item.cantidad)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-[#e8e8e8] pt-4 flex flex-col gap-2">
                    {cuponAplicado && (
                      <div className="flex justify-between text-sm">
                        <span style={{ fontFamily: "Barlow, sans-serif", color: "#166534" }}>Descuento</span>
                        <span style={{ fontFamily: "DM Sans, sans-serif", color: "#166534" }}>-{formatCLP(descuento)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span style={{ fontFamily: "Barlow, sans-serif", fontWeight: 600, color: "#111111" }}>Total</span>
                      <span style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: "22px", color: "#e8003d" }}>{formatCLP(total)}</span>
                    </div>
                  </div>

                  {/* Métodos de pago */}
                  <div className="mt-5 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setMetodoPago("mercadopago")}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left"
                      style={{ borderColor: metodoPago === "mercadopago" ? "#e8003d" : "#e8e8e8", backgroundColor: "#ffffff" }}
                    >
                      <span className="text-xl">🔴</span>
                      <div>
                        <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", fontWeight: 600, color: "#111111" }}>MercadoPago</p>
                        <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "11px", color: "#666666" }}>Tarjetas de crédito y débito</p>
                      </div>
                    </button>
                    <div className="w-full flex items-center gap-3 p-3 rounded-lg border border-[#e8e8e8] opacity-50 cursor-not-allowed select-none">
                      <span className="text-xl">🟢</span>
                      <div>
                        <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", fontWeight: 600, color: "#111111" }}>WebPay</p>
                        <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "11px", color: "#666666" }}>Próximamente</p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={pagando}
                    className="w-full h-12 rounded-md text-white font-semibold mt-5"
                    style={{ fontFamily: "Barlow, sans-serif", fontSize: "15px", backgroundColor: pagando ? "#f0a0b0" : "#e8003d", cursor: pagando ? "not-allowed" : "pointer" }}
                    onMouseEnter={(e) => { if (!pagando) e.currentTarget.style.backgroundColor = "#c5002e"; }}
                    onMouseLeave={(e) => { if (!pagando) e.currentTarget.style.backgroundColor = "#e8003d"; }}
                  >
                    {pagando ? "Procesando..." : "Ir a pagar →"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
