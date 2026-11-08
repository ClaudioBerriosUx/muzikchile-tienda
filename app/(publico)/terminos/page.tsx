import type { Metadata } from "next";
import Link from "next/link";
import { C, TEMA } from "@/lib/portada";
import { CORREO_CONTACTO } from "@/lib/site";
import { VERSION_TERMINOS_COMPRADORES } from "@/lib/terminos";
import {
  ACTUALIZADO_TERMINOS_COMPRADORES,
  AVISO_PILOTO_COMPRADORES,
  SECCIONES_TERMINOS_COMPRADORES,
} from "@/lib/legal/terminos-compradores";

/* ───────────────────────────────────────────────────────────────────────────
   Términos y condiciones para compradores, versión del programa piloto.

   El texto vive en lib/legal/terminos-compradores.ts: el correo de
   confirmación de compra lleva la misma copia. Esta página solo lo muestra.

   Durante el piloto: sin indexar y fuera del sitemap, pero enlazada desde el
   footer y el checkout, que es donde se acepta.
   ─────────────────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Términos y condiciones — MuzikChile",
  description: "Términos de compra en MuzikChile: quién vende, despacho, retracto, garantía y reclamos.",
  robots: { index: false, follow: true },
};

const enlace = { color: TEMA.azulTexto, textDecoration: "underline" } as const;

/** Reemplaza {correo} y {privacidad} por sus enlaces. */
function conEnlaces(texto: string): React.ReactNode[] {
  return texto.split(/(\{correo\}|\{privacidad\})/).map((parte, i) => {
    if (parte === "{correo}") return <a key={i} href={`mailto:${CORREO_CONTACTO}`} style={enlace}>{CORREO_CONTACTO}</a>;
    if (parte === "{privacidad}") return <Link key={i} href="/privacidad" style={enlace}>Política de privacidad</Link>;
    return parte;
  });
}

export default function TerminosPage() {
  return (
    <main style={{ backgroundColor: TEMA.fondo }} className="min-h-screen">
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
          Términos y condiciones
        </h1>

        <p className="mt-3" style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: TEMA.texto3 }}>
          Para compradores · Versión {VERSION_TERMINOS_COMPRADORES} (piloto) · Última actualización:{" "}
          {ACTUALIZADO_TERMINOS_COMPRADORES}
        </p>

        <div
          role="note"
          className="mt-6 rounded-[10px] border border-tema-borde p-4"
          style={{ ...textoCuerpo, fontSize: "14px", lineHeight: 1.6 }}
        >
          {AVISO_PILOTO_COMPRADORES}
        </div>

        {SECCIONES_TERMINOS_COMPRADORES.map((s) => (
          <section key={s.id} id={s.id} className="mt-10">
            <h2
              style={{
                fontSize: "22px",
                lineHeight: 1.2,
                letterSpacing: "0.01em",
                color: C.blanco,
                textTransform: "uppercase",
              }}
            >
              {s.titulo}
            </h2>
            <div className="mt-3 space-y-4">
              {s.parrafos.map((p, i) => (
                <p key={i} style={textoCuerpo}>{conEnlaces(p)}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

const textoCuerpo: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "16px",
  lineHeight: 1.75,
  color: TEMA.textoClaro,
};
