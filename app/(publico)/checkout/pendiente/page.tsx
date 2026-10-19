"use client";

export const dynamic = 'force-dynamic';

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ResultadoPago, { AccionResultado } from "@/components/tienda/ResultadoPago";

/**
 * MercadoPago vuelve acá con el pago en estado pendiente (efectivo,
 * transferencia). El webhook pasa la orden a `pagado` cuando se acredita.
 * El carrito NO se vacía: el pago todavía puede no concretarse.
 */
function PendienteContent() {
  const searchParams = useSearchParams();
  // Solo lectura, para mostrar el mismo N° de pedido que /checkout/exito.
  const external_reference = searchParams.get("external_reference");
  const numeroOrden = external_reference
    ? external_reference.split("-")[0].toUpperCase()
    : null;

  return (
    <ResultadoPago
      estado="pendiente"
      pedido={numeroOrden}
      titulo="Tu pago está pendiente"
      texto="MercadoPago todavía no confirma tu pago. Si pagaste en efectivo o por transferencia, la acreditación puede tardar."
      nota="No necesitas hacer nada más: cuando MercadoPago acredite el pago, tu pedido queda confirmado. El estado del pago lo puedes revisar en tu cuenta de MercadoPago."
    >
      <AccionResultado href="/tienda" principal>Volver a la tienda</AccionResultado>
      <AccionResultado href="/noticias">Leer las noticias de la escena</AccionResultado>
    </ResultadoPago>
  );
}

export default function PendientePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-tema-fondo" />}>
      <PendienteContent />
    </Suspense>
  );
}
