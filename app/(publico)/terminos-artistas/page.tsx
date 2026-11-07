import type { Metadata } from "next";
import { C, TEMA } from "@/lib/portada";
import { CORREO_CONTACTO } from "@/lib/site";
import { VERSION_TERMINOS_ARTISTAS } from "@/lib/terminos";

/* ───────────────────────────────────────────────────────────────────────────
   Términos para artistas: BORRADOR para revisión legal.

   Se publica sin indexar, sin enlaces desde el sitio y sin aceptación activa.
   Al terminar la revisión: quitar el aviso de borrador y los [PENDIENTE],
   poner la fecha, quitar el noindex y sumar esta ruta al sitemap y al footer.

   Si el texto cambia después de que alguien lo aceptó, sube la versión en
   lib/terminos.ts.
   ─────────────────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Términos para artistas — MuzikChile",
  description: "Borrador de los términos para artistas de MuzikChile, en revisión legal.",
  robots: { index: false, follow: false },
};

export default function TerminosArtistasPage() {
  const correo = (
    <a href={`mailto:${CORREO_CONTACTO}`} style={{ color: TEMA.azulTexto, textDecoration: "underline" }}>
      {CORREO_CONTACTO}
    </a>
  );

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
          Términos para artistas
        </h1>

        <p className="mt-3" style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: TEMA.texto3 }}>
          Versión {VERSION_TERMINOS_ARTISTAS} · <Pendiente>fecha de publicación</Pendiente>
        </p>

        <div
          role="note"
          className="mt-6 rounded-[10px] border border-tema-borde p-4"
          style={{ ...textoCuerpo, fontSize: "14px", lineHeight: 1.6 }}
        >
          <B>Borrador en revisión legal.</B> Este texto todavía no rige y nadie lo ha aceptado.
        </div>

        <Seccion titulo="1. Quiénes somos">
          <P>
            MuzikChile es operado por Claudio Berrios, persona natural,{" "}
            <Pendiente>RUT y domicilio</Pendiente>, contacto {correo}. Estos términos rigen tu cuenta de
            artista y, si la activas, tu tienda.
          </P>
        </Seccion>

        <Seccion titulo="2. Tu cuenta">
          <P>
            Con tu invitación tienes una ficha y puedes publicar noticias. La tienda es opcional y requiere
            activación. Respondes por lo que publiques y debes tener los derechos sobre tu música, imágenes y
            productos. Nos autorizas a mostrar ese contenido en MuzikChile y a difundirlo, junto con tu ficha
            y tus productos, también en las redes sociales de MuzikChile, mientras esté publicado.
          </P>
        </Seccion>

        <Seccion titulo="3. Activar tu tienda">
          <P>
            Debes aceptar estos términos, conectar tu propia cuenta de Mercado Pago, declarar que tiene tu
            identidad verificada, definir despacho o retiro y crear al menos un producto en borrador. Revisamos
            cada solicitud y podemos aprobarla o devolverla con un comentario. Aprobarla no publica tus
            productos: cada uno pasa por revisión.
          </P>
        </Seccion>

        <Seccion titulo="4. Cómo cobras">
          <P>
            Cada venta se cobra directamente en tu cuenta de Mercado Pago. MuzikChile no recibe ni guarda ese
            dinero, salvo su comisión. Las condiciones y cargos de Mercado Pago son entre tú y Mercado Pago.
            Debes mantener la cuenta activa y con saldo suficiente para devoluciones.
          </P>
        </Seccion>

        <Seccion titulo="5. Comisión">
          <P>
            La comisión estándar es 10%. Puede haber condiciones especiales informadas en tu panel, y la
            comisión que aplica a tu tienda se informa ahí. Se calcula sobre lo cobrado por tus productos,
            después de descuentos y sin incluir el despacho, y se descuenta automáticamente en cada pago.
            Cualquier cambio se avisa por correo con 30 días de anticipación y no afecta ventas ya hechas.{" "}
            <Pendiente>qué pasa con la comisión si la venta se devuelve; se confirma con la primera devolución real</Pendiente>
          </P>
        </Seccion>

        <Seccion titulo="6. Tú eres quien vende">
          <P>
            Eres responsable de tus productos, su descripción, precio, stock y garantía legal, y de atender a
            tus compradores. Debes emitir la boleta o factura de cada venta y cumplir tus obligaciones
            tributarias.{" "}
            <Pendiente>abogado confirma quién es el proveedor frente al consumidor y la responsabilidad de MuzikChile</Pendiente>
          </P>
        </Seccion>

        <Seccion titulo="7. Productos">
          <P>
            Por ahora solo se pueden vender productos físicos. Solo puedes vender lo que tienes derecho a
            vender. No se permiten productos falsificados, ilegales, peligrosos o que infrinjan derechos de
            terceros. Podemos rechazar o retirar un producto indicando el motivo.
          </P>
        </Seccion>

        <Seccion titulo="8. Despacho">
          <P>
            Defines el costo, el plazo y si ofreces retiro. Se muestran antes de pagar y lo informado en cada
            compra te obliga. Debes despachar dentro de ese plazo, avisar cualquier problema al comprador y
            responder por el pedido hasta su entrega.{" "}
            <Pendiente>abogado confirma el riesgo durante el transporte</Pendiente>
          </P>
        </Seccion>

        <Seccion titulo="9. Retracto">
          <P>
            El comprador puede retractarse dentro de 10 días desde la recepción, conforme al art. 3 bis de la
            Ley 19.496. Debe devolver el producto sin deterioro imputable a él y con su embalaje original.
            Debes devolver el dinero desde tu cuenta de Mercado Pago lo antes posible y siempre dentro de 45
            días desde el aviso, sin retener gastos. Las exclusiones solo valen en los casos legales y si se
            informaron claramente antes del pago.{" "}
            <Pendiente>abogado confirma exclusiones, plazo de 90 días y quién paga el envío de vuelta</Pendiente>
          </P>
        </Seccion>

        <Seccion titulo="10. Datos de tus compradores">
          <P>
            Recibes nombre, correo y dirección de los pedidos pagados. Úsalos solo para despachar y responder
            sobre ese pedido. No los uses para promociones ni los compartas. Debes protegerlos y eliminarlos
            cuando ya no los necesites. Tus propios datos se tratan según nuestra{" "}
            <a href="/privacidad" style={{ color: TEMA.azulTexto, textDecoration: "underline" }}>
              Política de privacidad
            </a>
            . <Pendiente>abogado confirma el rol del artista bajo la Ley 19.628 y la Ley 21.719</Pendiente>
          </P>
        </Seccion>

        <Seccion titulo="11. Suspensión">
          <P>
            Podemos suspender tu tienda si incumples el despacho, acumulas reclamos reiterados, vendes
            productos prohibidos o infringes estos términos. Te avisaremos por correo con el motivo y 5 días
            hábiles para corregir.
          </P>
          <P>
            En casos graves podemos suspender de inmediato y avisarte después: fraude o sospecha fundada de
            fraude, productos falsificados o ilegales, cobros sin intención de entregar, mal uso de datos de
            compradores, o riesgo actual para compradores. Si tu tienda se suspende, debes cumplir los pedidos
            ya pagados.
          </P>
        </Seccion>

        <Seccion titulo="12. Baja">
          <P>
            Puedes pedir la baja escribiendo a {correo}. Tu tienda se apaga y tus productos se ocultan, pero
            sigues obligado por los pedidos ya pagados. Los plazos de eliminación de datos están en la Política
            de privacidad.
          </P>
        </Seccion>

        <Seccion titulo="13. Cambios">
          <P>
            Si cambiamos estos términos, te avisamos por correo y publicamos la nueva versión con su fecha. Si
            afecta tu tienda, deberás aceptarla para seguir vendiendo. Guardamos la fecha y versión de cada
            aceptación.
          </P>
        </Seccion>

        <Seccion titulo="14. Ley aplicable">
          <P>
            Se rigen por la ley chilena.{" "}
            <Pendiente>abogado define tribunal competente y límite de responsabilidad, si corresponde</Pendiente>
          </P>
        </Seccion>
      </div>
    </main>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2
        style={{
          fontSize: "22px",
          lineHeight: 1.2,
          letterSpacing: "0.01em",
          color: C.blanco,
          textTransform: "uppercase",
        }}
      >
        {titulo}
      </h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

const textoCuerpo: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "16px",
  lineHeight: 1.75,
  color: TEMA.textoClaro,
};

function P({ children }: { children: React.ReactNode }) {
  return <p style={textoCuerpo}>{children}</p>;
}

function B({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: C.blanco }}>{children}</strong>;
}

/** Lo que falta definir, a la vista para el abogado. */
function Pendiente({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: "var(--tema-aviso-texto)" }}>[PENDIENTE: {children}]</strong>;
}
