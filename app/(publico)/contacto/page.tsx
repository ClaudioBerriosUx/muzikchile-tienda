import type { Metadata } from "next";
import { C } from "@/lib/portada";
import { CORREO_CONTACTO } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contacto — MuzikChile",
  description: "Cómo escribirle al equipo de MuzikChile.",
};

export default function ContactoPage() {
  return (
    <main style={{ backgroundColor: C.negro }} className="min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-20">
        <h1
          style={{
            // Familia y peso los pone la regla central de h1–h6 (Anton 400).
            fontSize: "clamp(30px, 5vw, 44px)",
            lineHeight: 1.1,
            letterSpacing: "0.01em",
            color: C.blanco,
            textTransform: "uppercase",
          }}
        >
          Contacto
        </h1>

        <p
          className="mt-6"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "16px",
            lineHeight: 1.75,
            color: C.grisClaro,
          }}
        >
          Pedidos, prensa, artistas que quieren sumarse o cualquier otra
          consulta: escríbenos y te respondemos a la brevedad.
        </p>

        <a
          href={`mailto:${CORREO_CONTACTO}`}
          className="inline-block mt-8 rounded-md border px-5 py-3 underline-offset-4 hover:underline"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "18px",
            borderColor: C.borde,
            backgroundColor: C.negroSuave,
            color: C.grisClaro,
          }}
        >
          {CORREO_CONTACTO}
        </a>
      </div>
    </main>
  );
}
