import Link from "next/link";
import { XCircle } from "lucide-react";

export default function ErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f7f5" }}>
      <div className="text-center max-w-md px-6 py-12">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: "#fee2e2" }}
        >
          <XCircle size={40} style={{ color: "#e8003d" }} />
        </div>

        <h1
          className="mb-3"
          style={{ fontFamily: "Oswald, sans-serif", fontSize: "36px", fontWeight: "700", color: "#111111" }}
        >
          Algo salió mal
        </h1>

        <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "16px", color: "#666666" }}>
          No se pudo procesar tu pago.
        </p>
        <p className="mt-1 mb-8" style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#999999" }}>
          No se realizó ningún cargo a tu cuenta.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/checkout"
            className="inline-block px-8 py-3 rounded-md text-white font-semibold"
            style={{ fontFamily: "Barlow, sans-serif", backgroundColor: "#e8003d" }}
          >
            Volver al carrito
          </Link>
          <Link
            href="/"
            className="inline-block px-8 py-3 rounded-md border font-semibold"
            style={{ fontFamily: "Barlow, sans-serif", borderColor: "#111111", color: "#111111" }}
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
