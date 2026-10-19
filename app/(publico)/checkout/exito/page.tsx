"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCarrito } from "@/lib/stores/carrito";
import ResultadoPago, { AccionResultado } from "@/components/tienda/ResultadoPago";

function ExitoContent() {
  const searchParams = useSearchParams();
  const limpiar = useCarrito((s) => s.limpiar);

  const status             = searchParams.get("status");
  const external_reference = searchParams.get("external_reference");
  const payment_id         = searchParams.get("payment_id");

  useEffect(() => {
    if (status === "approved") {
      limpiar();
    }
  }, [status, limpiar]);

  const numeroOrden = external_reference
    ? external_reference.split("-")[0].toUpperCase()
    : null;

  return (
    <ResultadoPago
      estado="exito"
      pedido={numeroOrden}
      titulo="¡Gracias por apoyar a la escena!"
      texto="Tu pedido quedó confirmado. Cada compra va directo para los artistas."
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
