import type { Metadata } from "next";
import { C, TEMA } from "@/lib/portada";
import { CORREO_CONTACTO } from "@/lib/site";

/* ───────────────────────────────────────────────────────────────────────────
   Política de privacidad v1.0 (Ley 19.628 modificada por la Ley 21.719).

   Describe lo que el sitio hace HOY. Si cambia algo de lo que se cuenta acá
   (un dato nuevo, un tercero nuevo, un plazo), se actualiza el texto, la
   VERSION y la fecha:
     · plazos  → migración 20261026030000_retencion_datos + /api/cron/retencion
     · cookies → lib/consentimiento.ts (excepción: la señal de tv. de la portada)
     · artista → RLS artista_lee_sus_ordenes_pagadas + /panel/despacho

   Pendiente para la v1.1: RUT y domicilio del responsable; Vercel entre los
   proveedores con DPA (al pasar a Pro). Pendiente de revisión legal: el plazo
   de respuesta ("30 días corridos") y la base de licitud de la señal de la
   portada (interés legítimo).
   ─────────────────────────────────────────────────────────────────────────── */

const TITULO = "Política de privacidad — MuzikChile";
const DESCRIPCION =
  "Qué datos personales trata MuzikChile, para qué, quién los recibe, cuánto tiempo se guardan y cómo ejercer tus derechos.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/privacidad" },
  openGraph: { title: TITULO, description: DESCRIPCION, url: "/privacidad", type: "website" },
};

/** Versión y fecha del texto. Actualizar las dos al editarlo. */
const VERSION = "1.0";
const ACTUALIZADO = "25 de octubre de 2026";

export default function PrivacidadPage() {
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
          Política de privacidad
        </h1>

        <p className="mt-3" style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: TEMA.texto3 }}>
          Versión {VERSION} · Última actualización: {ACTUALIZADO}
        </p>

        <div className="mt-8 space-y-4">
          <P>
            En esta política te contamos qué datos personales tratamos en www.muzikchile.cl, para qué
            los usamos, quién más los recibe, cuánto tiempo los guardamos y cómo ejercer tus derechos.
            Sigue la Ley 19.628 sobre Protección de la Vida Privada, con las modificaciones de la Ley
            21.719.
          </P>
        </div>

        <Seccion titulo="1. Quién es responsable de tus datos">
          <P>
            El responsable del tratamiento es <B>Claudio Berrios</B>, persona natural, que opera
            MuzikChile: una plataforma de música independiente chilena con noticias, una señal de video
            en vivo y una tienda donde artistas venden sus productos.
          </P>
          <P>Para cualquier consulta sobre tus datos, escríbenos a {correo}.</P>
        </Seccion>

        <Seccion titulo="2. Qué datos tratamos">
          <P>
            <B>Si compras en la tienda.</B> No necesitas crear una cuenta. Te pedimos nombre, correo
            electrónico, dirección, ciudad y región de despacho, y opcionalmente un teléfono. Guardamos
            el pedido: productos, montos, cupón usado y estado. El teléfono no lo guardamos: solo se lo
            pasamos a Mercado Pago para el pago. <B>Los datos de tu tarjeta o medio de pago nunca pasan
            por nosotros</B>: los ingresas directamente en Mercado Pago.
          </P>
          <P>
            <B>Si eres artista en MuzikChile.</B> Tu correo y contraseña de acceso (la contraseña se
            guarda cifrada). Tu perfil público: nombre artístico, biografía, ciudad, región, géneros,
            foto y enlaces a tus redes. Tu RUT y tus datos bancarios (banco, tipo y número de cuenta)
            para pagarte. Si conectas tu cuenta de Mercado Pago: su identificador, nombre de usuario y
            correo, más los permisos que nos entrega Mercado Pago, que guardamos cifrados. También
            registramos la fecha de tu invitación y de tus inicios de sesión.
          </P>
          <P>
            <B>Si nos escribes.</B> Tu dirección de correo y lo que nos escribas a {correo}.
          </P>
          <P>
            <B>Si solo navegas.</B> Los datos técnicos que genera cualquier visita (dirección IP,
            navegador y páginas pedidas), que quedan en los registros de nuestros proveedores de
            hosting. Si lo aceptas, también datos de navegación para estadística (ver la sección 9).
          </P>
          <P>
            No tratamos datos sensibles, no elaboramos perfiles y no tomamos decisiones automatizadas
            sobre ti.
          </P>
        </Seccion>

        <Seccion titulo="3. Para qué usamos tus datos y con qué base">
          <Tabla
            columnas={["Para qué", "Datos", "Base de licitud"]}
            filas={[
              ["Procesar tu compra, cobrarla y que el artista te la despache", "Datos del pedido y de despacho", "Ejecución del contrato de compra"],
              ["Cumplir obligaciones tributarias y de protección al consumidor", "Datos del pedido", "Obligación legal"],
              ["Darte acceso a tu cuenta de artista, invitarte y recuperar tu contraseña", "Correo, contraseña, fechas de acceso", "Ejecución del contrato (términos para artistas)"],
              ["Publicar tu perfil y tus productos", "Perfil público", "Ejecución del contrato"],
              ["Pagarte lo que vendes y, si la conectas, cobrar con tu cuenta de Mercado Pago", "RUT, datos bancarios, conexión de Mercado Pago", "Ejecución del contrato"],
              ["Responder tus mensajes", "Lo que nos escribas", "Tu solicitud"],
              ["Mantener el sitio seguro y funcionando", "Datos técnicos y registros", "Interés legítimo"],
              ["Mostrar la señal en vivo de MuzikChile TV en la portada", "Los que recoge YouTube (ver sección 9)", "Interés legítimo"],
              ["Medir visitas", "Datos de navegación", "Tu consentimiento"],
              ["Mostrar videos y publicaciones de YouTube, Spotify e Instagram en las noticias", "Los que recoge cada plataforma", "Tu consentimiento"],
            ]}
          />
          <P>No vendemos tus datos ni los usamos para publicidad.</P>
        </Seccion>

        <Seccion titulo="4. Quién más recibe tus datos">
          <Lista>
            <li>
              <B>El artista que te vende.</B> Para preparar y despachar tu pedido, ve tu nombre, correo y
              dirección de despacho, solo de los pedidos pagados que le corresponden. Si el artista cobra
              con su propia cuenta de Mercado Pago, también ve ahí los datos que entregaste al pagar,
              incluido el teléfono si lo diste. Solo puede usarlos para cumplir tu pedido.
            </li>
            <li>
              <B>Mercado Pago</B>, que procesa el pago. Recibe tus datos de comprador y del pago, y los
              trata según su propia política de privacidad.
            </li>
            <li>
              <B>Proveedores que nos prestan servicios</B> y tratan los datos por encargo nuestro:{" "}
              <B>Supabase</B> (base de datos, cuentas y archivos), <B>Vercel</B> (hosting del sitio y sus
              registros técnicos), <B>Resend</B> (envío de los correos de acceso: invitación y
              recuperación de contraseña) y <B>proveedores de correo electrónico</B>, que reciben y
              guardan lo que nos escribes.
            </li>
            <li>
              <B>Plataformas de contenido</B>, que reciben tu visita cuando se carga su contenido:{" "}
              <B>Google</B> (Analytics), <B>YouTube</B>, <B>Spotify</B> y <B>Meta</B> (Instagram). Cada una
              trata los datos según su propia política.
            </li>
            <li>
              <B>Autoridades</B>, cuando la ley nos obligue.
            </li>
          </Lista>
        </Seccion>

        <Seccion titulo="5. Transferencias internacionales">
          <P>Varios proveedores guardan o procesan datos fuera de Chile:</P>
          <Lista>
            <li>
              en <B>Estados Unidos</B>: Supabase, Vercel, Resend, Google, YouTube, Meta y parte del
              servicio de correo;
            </li>
            <li>
              en <B>Suiza</B>: el proveedor de correo electrónico;
            </li>
            <li>
              en la <B>Unión Europea</B>: Spotify.
            </li>
          </Lista>
          <P>
            Con Supabase y Resend tenemos acuerdos de tratamiento de datos (DPA), que los obligan a
            proteger los datos y a usarlos solo para prestarnos el servicio. Google, YouTube, Spotify y
            Meta actúan según sus propios términos y políticas.
          </P>
        </Seccion>

        <Seccion titulo="6. Cuánto tiempo guardamos tus datos">
          <Lista>
            <li>
              <B>Pedidos:</B> 6 años desde la compra. Después se <B>anonimizan</B>: se borran el nombre, el
              correo y la dirección, y quedan solo los montos y productos para la contabilidad.
            </li>
            <li>
              <B>Cuenta de artista:</B> mientras esté activa, y hasta <B>1 año después de su baja</B>.
              Pasado ese plazo se eliminan el RUT, los datos bancarios, el perfil, la foto y el acceso.
              Los pedidos y pagos históricos siguen el plazo de los pedidos.
            </li>
            <li>
              <B>Conexión con Mercado Pago:</B> hasta que la desconectes. Si queda pendiente de reconectar
              y no lo haces, se elimina a los <B>90 días</B>.
            </li>
            <li>
              <B>Comprobantes de pago a artistas:</B> 6 años.
            </li>
            <li>
              <B>Correos que nos escribes:</B> 2 años.
            </li>
            <li>
              <B>Registros técnicos del hosting:</B> se borran automáticamente en 1 día.
            </li>
            <li>
              <B>Estadística (Google Analytics):</B> 2 meses.
            </li>
            <li>
              <B>Lo guardado en tu navegador:</B> hasta que lo borres (ver la sección 9).
            </li>
          </Lista>
        </Seccion>

        <Seccion titulo="7. Tus derechos y cómo ejercerlos">
          <P>Tienes derecho a:</P>
          <Lista>
            <li><B>acceso</B>: saber qué datos tuyos tratamos;</li>
            <li><B>rectificación</B>: corregirlos si están mal o incompletos;</li>
            <li><B>supresión</B>: pedir que los borremos;</li>
            <li><B>oposición</B>: oponerte a un tratamiento;</li>
            <li><B>portabilidad</B>: recibirlos en un formato estructurado;</li>
            <li><B>bloqueo</B>: suspender temporalmente su tratamiento.</li>
          </Lista>
          <P>
            Para ejercerlos, escríbenos a {correo} con el asunto &quot;Datos personales&quot;. Indica qué
            derecho quieres ejercer y danos algo que nos permita confirmar que eres tú, como el correo
            con que compraste o el de tu cuenta de artista. Es gratis. Te respondemos dentro de{" "}
            <B>30 días corridos</B>.
          </P>
          <P>
            Algunos datos los tenemos que conservar aunque pidas borrarlos, como los de un pedido durante
            el plazo tributario. En ese caso te lo explicamos y los dejamos bloqueados.
          </P>
          <P>
            El consentimiento para estadística y contenido de terceros lo puedes retirar cuando quieras
            desde <B>&quot;Preferencias de cookies&quot;</B>, al pie de cada página.
          </P>
          <P>
            Si no quedas conforme con nuestra respuesta, puedes reclamar ante la{" "}
            <B>Agencia de Protección de Datos Personales</B>.
          </P>
        </Seccion>

        <Seccion titulo="8. Seguridad">
          <P>
            Usamos conexiones cifradas (HTTPS). Las contraseñas y los permisos de Mercado Pago se guardan
            cifrados. Los datos bancarios y los comprobantes de pago solo los ven el artista y el equipo
            administrador. El acceso a la base de datos está limitado por reglas por usuario: un artista
            solo ve sus propios pedidos pagados. Ningún sistema es infalible. Si ocurre un incidente que
            afecte tus datos, te avisaremos según lo que exige la ley.
          </P>
        </Seccion>

        <Seccion id="cookies" titulo="9. Cookies y contenido de terceros">
          <P>
            <B>Necesarias</B>, siempre activas:
          </P>
          <Tabla
            columnas={["Nombre", "Para qué", "Duración"]}
            filas={[
              ["sb-…-auth-token", "Mantener la sesión de artistas y administradores; solo existe si inicias sesión", "Mientras dure la sesión"],
              ["mp_oauth", "Conectar una cuenta de Mercado Pago de forma segura", "10 minutos"],
              ["muzikchile-carrito (almacenamiento del navegador)", "Recordar tu carrito", "Hasta que lo borres"],
              ["muzik_consentimiento (almacenamiento del navegador)", "Recordar lo que elegiste sobre cookies", "Hasta que lo borres"],
            ]}
            codigoPrimeraColumna
          />
          <P>
            <B>Opcionales</B>, solo si las aceptas en el aviso de cookies:
          </P>
          <Lista>
            <li>
              <B>Estadística:</B> Google Analytics (cookies <Codigo>_ga</Codigo> y{" "}
              <Codigo>_ga_…</Codigo>) cuenta visitas y páginas vistas. No se usa en el panel de
              artistas, el carrito, el pago ni las páginas de acceso.
            </li>
            <li>
              <B>Contenido de terceros:</B> los videos y publicaciones de YouTube, Spotify e Instagram que
              aparecen en las noticias. Sin tu permiso, en su lugar verás un aviso con un botón para
              cargarlos.
            </li>
          </Lista>
          <P>
            <B>Excepción, la señal de la portada:</B> el reproductor de MuzikChile TV de la portada se
            carga siempre. Ese reproductor usa YouTube, que puede guardar sus propias cookies. No carga
            Google Analytics ni otras herramientas de medición.
          </P>
          <P>
            Puedes cambiar tu elección cuando quieras desde <B>&quot;Preferencias de cookies&quot;</B>, al
            pie de la página, o borrar las cookies desde tu navegador.
          </P>
        </Seccion>

        <Seccion titulo="10. Menores de edad">
          <P>Para comprar en la tienda debes ser mayor de 18 años.</P>
        </Seccion>

        <Seccion titulo="11. Cambios a esta política">
          <P>
            Si la cambiamos, publicaremos la nueva versión acá con su fecha y número de versión. Si el
            cambio es importante, lo avisaremos en el sitio.
          </P>
        </Seccion>
      </div>
    </main>
  );
}

/* ── Piezas de composición ──────────────────────────────────────────────── */

function Seccion({ id, titulo, children }: { id?: string; titulo: string; children: React.ReactNode }) {
  return (
    // El ancla (#cookies, desde el banner) no queda bajo el header: lo resuelve
    // el scroll-padding-top de <html> (globals.css).
    <section id={id} className="mt-10">
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

function Codigo({ children }: { children: React.ReactNode }) {
  return <code style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "14px", color: C.blanco }}>{children}</code>;
}

function Lista({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-5" style={textoCuerpo}>
      {children}
    </ul>
  );
}

function Tabla({
  columnas,
  filas,
  codigoPrimeraColumna,
}: {
  columnas: string[];
  filas: string[][];
  codigoPrimeraColumna?: boolean;
}) {
  return (
    // En móvil la tabla se desliza dentro de su caja; la página no.
    <div className="overflow-x-auto rounded-md border" style={{ borderColor: TEMA.borde }}>
      <table className="w-full min-w-[520px] text-left" style={{ fontFamily: "var(--font-body)", fontSize: "14px" }}>
        <thead style={{ backgroundColor: TEMA.superficie }}>
          <tr>
            {columnas.map((c) => (
              <th key={c} className="px-3 py-2 font-semibold" style={{ color: C.blanco }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila[0]} className="border-t" style={{ borderColor: TEMA.borde }}>
              {fila.map((celda, i) => (
                <td key={i} className="px-3 py-2 align-top" style={{ color: TEMA.textoClaro, lineHeight: 1.5 }}>
                  {i === 0 && codigoPrimeraColumna ? <Codigo>{celda}</Codigo> : celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
