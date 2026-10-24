"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCarrito } from "@/lib/stores/carrito";
import ResultadoPago, { AccionResultado } from "@/components/tienda/ResultadoPago";

type EstadoPedido = "pagado" | "pendiente" | "cancelado" | null;

/** Intentos de lectura mientras el webhook todavía no confirma el pago. */
const INTENTOS = 6;
const ESPERA_MS = 3000;

/**
 * Estado del pedido según la base (/api/checkout/estado), que es lo que dejó
 * el webhook tras consultar el pago en MP. El `status` de la URL lo pone MP en
 * la redirección y no se verifica: solo sirve para vaciar el carrito.
 */
function useEstadoPedido(ref: string | null): EstadoPedido | "cargando" {
  const [estado, setEstado] = useState<EstadoPedido | "cargando">(ref ? "cargando" : null);

  useEffect(() => {
    if (!ref) return;
    let vigente = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const leer = async (intento: number) => {
      const r = await fetch(`/api/checkout/estado?ref=${encodeURIComponent(ref)}`).then((res) => res.json()).catch(() => null);
      if (!vigente) return;
      const e: EstadoPedido = r?.estado ?? null;
      setEstado(e);
      if (e === "pendiente" && intento + 1 < INTENTOS) timer = setTimeout(() => leer(intento + 1), ESPERA_MS);
    };
    leer(0);
    return () => { vigente = false; clearTimeout(timer); };
  }, [ref]);

  return estado;
}

function ExitoContent() {
  const searchParams = useSearchParams();
  const limpiar = useCarrito((s) => s.limpiar);

  const status             = searchParams.get("status");
  const external_reference = searchParams.get("external_reference");
  const payment_id         = searchParams.get("payment_id");
  const estado = useEstadoPedido(external_reference);

  useEffect(() => {
    if (status === "approved") {
      limpiar();
    }
  }, [status, limpiar]);

  const numeroOrden = external_reference
    ? external_reference.split("-")[0].toUpperCase()
    : null;

  // Pagado, o sin dato (pedido viejo, error de red): el texto de siempre.
  const confirmando = estado === "cargando" || estado === "pendiente";
  const textos = estado === "cancelado"
    ? {
        titulo: "El pago no se completó",
        texto: "Mercado Pago no confirmó el pago de este pedido. No se te cobró: puedes intentarlo de nuevo desde la tienda.",
      }
    : confirmando
      ? {
          titulo: "Estamos confirmando tu pago",
          texto: "Mercado Pago ya nos avisó. En unos segundos tu pedido queda registrado; si tarda, te llega igual la confirmación por correo.",
        }
      : {
          titulo: "¡Gracias por apoyar a la escena!",
          texto: "Tu pedido quedó confirmado. Cada compra va directo para los artistas.",
        };

  return (
    <ResultadoPago
      estado={estado === "pagado" || estado === null ? "exito" : "pendiente"}
      pedido={numeroOrden}
      titulo={textos.titulo}
      texto={textos.texto}
      nota="MercadoPago te envía el comprobante del pago a tu correo. Guarda el número de pedido por si necesitas escribirnos."
      detalle={payment_id ? `Payment ID: ${payment_id}` : null}
    >
      <AccionResultado href="/tienda" principal>Seguir en la tienda</AccionResultado>
      <AccionResultado href="/noticias">Leer las noticias de la escena</AccionResultado>
    </ResultadoPago>
  );
}

export default function ExitoPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-tema-fondo">
        <p className="text-tema-texto-2">Confirmando pago...</p>
      </main>
    }>
      <ExitoContent />
    </Suspense>
  );
}
