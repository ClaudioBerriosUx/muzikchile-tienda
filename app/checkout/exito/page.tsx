"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { useCarrito } from "@/lib/stores/carrito";

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
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f7f5" }}>
      <div className="text-center max-w-md px-6 py-12">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: "#dcfce7" }}
        >
          <CheckCircle size={40} style={{ color: "#22c55e" }} />
        </div>

        <h1
          className="mb-3"
          style={{ fontFamily: "Oswald, sans-serif", fontSize: "36px", fontWeight: "700", color: "#111111" }}
        >
          ¡Compra exitosa!
        </h1>

        <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "16px", color: "#666666" }}>
          Tu pedido ha sido confirmado.
        </p>

        {numeroOrden && (
          <p className="mt-2" style={{ fontFamily: "DM Sans, sans-serif", fontSize: "13px", color: "#999999" }}>
            Número de orden: <strong>{numeroOrden}</strong>
          </p>
        )}

        {payment_id && (
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "12px", color: "#cccccc", marginTop: "4px" }}>
            Payment ID: {payment_id}
          </p>
        )}

        <p className="mt-4 mb-8" style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#666666" }}>
          Recibirás un email con los detalles de tu compra.
        </p>

        <Link
          href="/"
          className="inline-block px-8 py-3 rounded-md text-white font-semibold"
          style={{ fontFamily: "Barlow, sans-serif", backgroundColor: "#e8003d" }}
        >
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}

export default function ExitoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f7f5" }}>
        <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Confirmando pago...</p>
      </div>
    }>
      <ExitoContent />
    </Suspense>
  );
}
