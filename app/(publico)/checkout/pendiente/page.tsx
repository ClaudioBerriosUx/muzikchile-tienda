import Link from "next/link";

export default function PendientePage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f7f5" }}>
      <div className="text-center max-w-md px-6 py-12">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl"
          style={{ backgroundColor: "#fef9c3" }}
        >
          ⏳
        </div>

        <h1
          className="mb-3"
          style={{ fontFamily: "Oswald, sans-serif", fontSize: "36px", fontWeight: "700", color: "#111111" }}
        >
          Pago en revisión
        </h1>

        <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "16px", color: "#666666" }}>
          Recibirás un email cuando se confirme tu pago.
        </p>
        <p className="mt-1 mb-8" style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#999999" }}>
          Este proceso puede tardar algunos minutos.
        </p>

        <Link
          href="/"
          className="inline-block px-8 py-3 rounded-md border font-semibold"
          style={{ fontFamily: "Barlow, sans-serif", borderColor: "#111111", color: "#111111" }}
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
