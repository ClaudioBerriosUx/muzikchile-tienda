import type { Metadata } from "next";
import { C, TEMA } from "@/lib/portada";
import { CORREO_CONTACTO } from "@/lib/site";

/* ───────────────────────────────────────────────────────────────────────────
   TODO: revisar con detalle legal antes del lanzamiento.

   Esto es una PLANTILLA, no una política revisada por nadie con título de
   abogado. Describe con honestidad lo que el sitio hace HOY (recoge un email
   en el popup del boletín y nada más), que es justo lo que la hace utilizable
   como punto de partida: no promete cosas que el código no cumple.

   Lo que falta y hay que resolver con asesoría, sobre todo porque el público
   es internacional (RGPD si hay visitantes de la UE):

     · Identificar al responsable del tratamiento: razón social, RUT, domicilio.
     · Base legal del tratamiento (consentimiento) y cómo se acredita. Va de la
       mano con el doble opt-in, que todavía no está implementado.
     · Plazo de conservación de los datos.
     · Encargados de tratamiento: Supabase aloja los datos; si más adelante se
       usa un proveedor de envío (Resend, Mailchimp…), hay que nombrarlo.
     · Transferencias internacionales de datos y su salvaguarda.
     · Cookies y analítica: hoy está Google Analytics 4 (sección "Analítica").
       Si llegan visitas de la UE, el RGPD probablemente exige un aviso de
       cookies con consentimiento previo; hoy no lo hay.
     · Ley 19.628 (Chile) y su reforma; RGPD para la UE.

   Cuando se complete, borrar este bloque y el aviso visible de "borrador".
   ─────────────────────────────────────────────────────────────────────────── */

const TITULO = "Política de Privacidad — MuzikChile";
const DESCRIPCION =
  "Qué datos recoge MuzikChile, para qué los usa y cómo pedir la baja.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/privacidad" },
  openGraph: { title: TITULO, description: DESCRIPCION, url: "/privacidad", type: "website" },
};

/** Última revisión del texto. Actualizar al editarlo. */
const ACTUALIZADO = "13 de octubre de 2026";

export default function PrivacidadPage() {
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
          Política de Privacidad
        </h1>

        <p
          className="mt-3"
          style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: TEMA.texto3 }}
        >
          Última actualización: {ACTUALIZADO}
        </p>

        {/* Aviso visible: mientras sea plantilla, que se note. */}
        <div
          className="mt-8 rounded-md border px-4 py-3"
          style={{ borderColor: TEMA.borde, backgroundColor: TEMA.superficie }}
        >
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              lineHeight: 1.6,
              color: TEMA.texto2,
            }}
          >
            <strong style={{ color: C.rojoClaro }}>Borrador.</strong> Este texto
            describe con exactitud lo que el sitio hace hoy, pero todavía no ha
            sido revisado legalmente. Se completará antes del lanzamiento
            público.
          </p>
        </div>

        <Seccion titulo="Qué datos recogemos">
          <P>
            Solo tu <strong style={{ color: C.blanco }}>dirección de correo
            electrónico</strong>, y únicamente si la escribes tú en el formulario
            de suscripción al boletín.
          </P>
          <P>
            No pedimos nombre, teléfono, dirección ni fecha de nacimiento. No
            guardamos tu dirección IP ni el navegador que usas junto con tu
            suscripción. Junto al correo se registra solo la fecha del alta y
            desde qué parte del sitio se hizo.
          </P>
          <P>
            Navegar por MuzikChile sin suscribirte no deja ningún dato personal
            tuyo en nuestros registros. Las visitas sí se miden de forma
            agregada con Google Analytics (ver más abajo).
          </P>
        </Seccion>

        <Seccion titulo="Analítica">
          <P>
            Usamos <strong style={{ color: C.blanco }}>Google Analytics</strong>{" "}
            para medir las visitas de forma agregada: cuántas personas entran,
            qué páginas ven, desde qué país y con qué tipo de dispositivo. Nos
            sirve para saber qué contenido interesa, no para identificarte.
            Google Analytics usa cookies propias en tu navegador.
          </P>
          <P>
            No medimos el panel de artistas, el carrito, el pago ni las
            páginas de acceso.
          </P>
          <P>
            Google trata esos datos según su{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: TEMA.azulTexto, textDecoration: "underline" }}
            >
              política de privacidad
            </a>
            . Si no quieres que te mida, puedes bloquear las cookies de Google
            en tu navegador o instalar el{" "}
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: TEMA.azulTexto, textDecoration: "underline" }}
            >
              complemento de exclusión de Google Analytics
            </a>
            .
          </P>
        </Seccion>

        <Seccion titulo="Para qué los usamos">
          <P>
            Para escribirte sobre lanzamientos, videos, noticias y convocatorias
            de la escena musical chilena. Nada más.
          </P>
          <P>
            <strong style={{ color: C.blanco }}>No vendemos, arrendamos ni
            cedemos tu correo a terceros</strong> con fines comerciales.
          </P>
        </Seccion>

        <Seccion titulo="Dónde se guardan">
          <P>
            En la base de datos del sitio, alojada en Supabase. El acceso a la
            lista de suscriptores está restringido al equipo administrador de
            MuzikChile.
          </P>
        </Seccion>

        <Seccion titulo="Cómo darte de baja">
          <P>
            Puedes pedir la baja cuando quieras, sin dar explicaciones y sin
            costo. Escríbenos a{" "}
            <a
              href={`mailto:${CORREO_CONTACTO}`}
              style={{ color: TEMA.azulTexto, textDecoration: "underline" }}
            >
              {CORREO_CONTACTO}
            </a>{" "}
            y te sacamos de la lista.
          </P>
          <P>
            También puedes pedirnos que te digamos qué datos tuyos tenemos, que
            los corrijamos si están mal, o que los borremos por completo.
          </P>
        </Seccion>

        <Seccion titulo="Cambios a esta política">
          <P>
            Si cambiamos algo, actualizaremos la fecha del encabezado. Si el
            cambio es importante y afecta cómo usamos tu correo, te avisaremos
            por ese mismo medio.
          </P>
        </Seccion>

        <Seccion titulo="Contacto">
          <P>
            Cualquier duda sobre esta política o sobre tus datos:{" "}
            <a
              href={`mailto:${CORREO_CONTACTO}`}
              style={{ color: TEMA.azulTexto, textDecoration: "underline" }}
            >
              {CORREO_CONTACTO}
            </a>
            .
          </P>
        </Seccion>
      </div>
    </main>
  );
}

/* ── Piezas de composición ──────────────────────────────────────────────── */

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

function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "16px",
        lineHeight: 1.75,
        color: TEMA.textoClaro,
      }}
    >
      {children}
    </p>
  );
}
