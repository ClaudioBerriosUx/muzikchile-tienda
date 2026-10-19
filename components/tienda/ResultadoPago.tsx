import Link from "next/link";
import { ArrowRight, Check, Clock, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCO } from "./carrito-ui";

/**
 * Pantalla de resultado de pago (Tienda Pantalla · "Confirmación"), compartida
 * por /checkout/exito y /checkout/pendiente. Solo presentación: la lógica
 * (leer la URL de MercadoPago, vaciar el carrito) queda en cada página.
 */
export default function ResultadoPago({
  estado, pedido, titulo, texto, nota, detalle, children,
}: {
  estado: "exito" | "pendiente";
  /** N° de pedido visible (primer bloque del external_reference). */
  pedido?: string | null;
  titulo: string;
  texto: string;
  nota: string;
  /** Línea chica extra, p. ej. el Payment ID. */
  detalle?: string | null;
  /** Botones de acción. */
  children: React.ReactNode;
}) {
  const exito = estado === "exito";
  return (
    <main className="min-h-screen bg-tema-fondo text-tema-texto">
      <div className="mx-auto max-w-[1280px] px-5 md:px-10">
        <div className="mx-auto flex max-w-[760px] flex-col gap-6 pb-10 pt-6 md:pb-20 md:pt-10">
          <div className="flex flex-col items-start gap-4 text-left md:items-center md:text-center">
            <div
              className={cn(
                "flex h-[72px] w-[72px] items-center justify-center rounded-full border",
                exito ? "border-tema-ok bg-tema-ok/20 text-tema-ok-texto" : "border-tema-aviso bg-tema-aviso/15 text-tema-aviso-texto"
              )}
              aria-hidden="true"
            >
              {exito ? <Check size={34} strokeWidth={2.4} /> : <Clock size={34} strokeWidth={2} />}
            </div>
            {pedido && (
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em] text-tema-texto-3">
                Pedido {pedido}
              </p>
            )}
            <h1
              className="m-0 text-[40px] uppercase leading-none text-tema-texto md:text-[64px]"
              style={{ fontFamily: "var(--font-titulo)", textWrap: "balance" }}
            >
              {titulo}
            </h1>
            <p className="m-0 max-w-[560px] text-[17px] leading-[1.65] text-tema-texto-2" style={{ textWrap: "pretty" }}>
              {texto}
            </p>
          </div>

          <div
            className={cn(
              "flex items-start gap-3.5 rounded-xl border px-[18px] py-4",
              exito ? "border-tema-azul bg-tema-azul-fondo" : "border-tema-aviso bg-tema-aviso/10"
            )}
          >
            <Info
              size={20}
              strokeWidth={1.9}
              className={cn("mt-px shrink-0", exito ? "text-tema-azul-etiqueta" : "text-tema-aviso-texto")}
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1">
              <p className="m-0 text-sm leading-[1.6] text-[#D9D9D9]">{nota}</p>
              {detalle && <p className="m-0 text-xs text-tema-texto-3">{detalle}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">{children}</div>
        </div>
      </div>
    </main>
  );
}

/** Botón principal (rojo) o secundario (borde) de la pantalla de resultado. */
export function AccionResultado({
  href, children, principal = false,
}: { href: string; children: React.ReactNode; principal?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-[52px] items-center justify-center gap-2.5 rounded-[10px] px-6 no-underline md:flex-1",
        principal
          ? "bg-tema-rojo text-base font-bold text-tema-texto hover:brightness-110"
          : "border border-tema-borde-campo text-sm font-medium text-tema-texto hover:border-tema-azul-texto",
        FOCO
      )}
    >
      {children}
      {principal && <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />}
    </Link>
  );
}
