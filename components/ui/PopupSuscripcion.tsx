"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { esEmailValido, normalizarEmail } from "@/lib/suscriptores";

/* ───────────────────────────────────────────────────────────────────────────
   Aviso de suscripción al boletín.

   Recrea el comportamiento del popup del Channel (15s o 30% de scroll, lo que
   pase primero; cooldown de 7 días al cerrar; nunca más si ya se suscribió)
   pero con tres agujeros del original cerrados:

     1. Validación de email real, no "¿tiene arroba?".
     2. Honeypot contra bots, que finge éxito en vez de delatar la trampa.
     3. Duplicados resueltos por el UNIQUE de Postgres, no por un chequeo
        previo en el cliente.

   ── NO es un modal ────────────────────────────────────────────────────────
   Es una tarjeta flotante en una esquina, sin overlay: la página sigue
   visible y usable. Esa decisión de diseño arrastra tres consecuencias en el
   código que NO son detalles sueltos:

     · No roba el foco al aparecer. Un modal sí debe hacerlo; una tarjeta que
       interrumpe sin bloquear, no — te sacaría del campo o del video que
       estás usando.
     · No captura Escape. Esa tecla le pertenece a lo que sí bloquea (el modal
       de video de la portada). Si la tomáramos, una sola pulsación cerraría
       las dos cosas.
     · No hay "clic fuera": fuera de la tarjeta está la página, y hacer clic
       ahí es navegar, no cerrar. El único cierre es la ✕.

   Sin `aria-modal` ni `role="dialog"` por lo mismo: anunciarla como diálogo
   modal le mentiría a un lector de pantalla sobre el estado de la página.
   Es un `<aside>` con nombre accesible, que es exactamente lo que es.

   ⚠️ DEFENSAS QUE FALTAN — deliberadamente fuera de esta tanda.
   El honeypot detiene bots tontos (los que rellenan todo formulario que
   encuentran), que hoy son la mayoría. No detiene a nadie que mire el HTML.
   Cuando el tráfico lo justifique, en este orden:

     · Rate limiting por IP — hoy nada impide 10.000 altas desde un script.
       Va en un Route Handler (la IP no existe del lado del cliente) o en el
       WAF/firewall. Es la que más falta hace de las tres.
     · Captcha / Cloudflare Turnstile — invisible en el caso normal; es lo que
       corta los bots que sí leen el DOM y esquivan el honeypot.
     · Doble opt-in con token — se manda un correo de confirmación y la fila no
       pasa a 'activo' hasta que se haga clic. Cierra el abuso de suscribir a
       terceros con su email sin permiso, y es lo que exige el RGPD para
       público europeo. Hoy la tabla se llena sin verificar que el buzón sea
       de quien lo escribe.

   Ninguna de las tres se puede expresar como política RLS: todas necesitan
   servidor. Ver también el comentario de la migración
   `20260727030917_crear_suscriptores.sql`.
   ─────────────────────────────────────────────────────────────────────────── */

/** Ya se suscribió: no se le vuelve a mostrar nunca. */
const CLAVE_SUSCRITO = "muzik_suscrito";
/** Timestamp del último cierre: arranca el cooldown. */
const CLAVE_VISTO = "muzik_popup_visto";

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const DEMORA_MS = 15_000;
const UMBRAL_SCROLL = 0.3; // 30% de la página
const CIERRE_TRAS_EXITO_MS = 2_500;

/**
 * Por encima del grano de película (z-15) para que no le tiña el blanco, y por
 * DEBAJO del header sticky (z-50) y del modal de video de la portada (z-100).
 * Ese orden es el que garantiza que un aviso del boletín nunca se ponga
 * delante de la navegación ni de algo que la persona abrió a propósito.
 */
const Z_INDEX = 40;

type Estado = "form" | "enviando" | "exito";

export default function PopupSuscripcion() {
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<Estado>("form");
  const [error, setError] = useState<string | null>(null);
  /** Mensaje ámbar, no rojo: "ya estás suscrito" es una buena noticia. */
  const [aviso, setAviso] = useState<string | null>(null);

  /** El honeypot. Ver el <input> oculto más abajo. */
  const [trampa, setTrampa] = useState("");

  /** Evita que scroll y temporizador lo abran dos veces. */
  const yaDisparado = useRef(false);

  /* ── Cuándo aparece ─────────────────────────────────────────────────────
     Lo primero que ocurra: 15 segundos, o 30% de scroll. */
  useEffect(() => {
    // localStorage no existe en el servidor; este efecto solo corre en cliente.
    if (localStorage.getItem(CLAVE_SUSCRITO)) return;

    const visto = localStorage.getItem(CLAVE_VISTO);
    if (visto) {
      const cuando = Number(visto);
      // Number("") es 0 y Number("basura") es NaN: si el valor está corrupto,
      // se ignora el cooldown en vez de romper el popup para siempre.
      if (Number.isFinite(cuando) && Date.now() - cuando < COOLDOWN_MS) return;
    }

    const disparar = () => {
      if (yaDisparado.current) return;
      yaDisparado.current = true;
      setAbierto(true);
    };

    const temporizador = window.setTimeout(disparar, DEMORA_MS);

    const alHacerScroll = () => {
      const alcanzable = document.documentElement.scrollHeight - window.innerHeight;
      // En una página corta no hay scroll posible: dividir por 0 daría
      // Infinity y abriría la tarjeta al instante. Que gane el temporizador.
      if (alcanzable <= 0) return;
      if (window.scrollY / alcanzable > UMBRAL_SCROLL) disparar();
    };

    window.addEventListener("scroll", alHacerScroll, { passive: true });
    return () => {
      window.clearTimeout(temporizador);
      window.removeEventListener("scroll", alHacerScroll);
    };
  }, []);

  /* ── Cerrar ─────────────────────────────────────────────────────────────
     Cerrar sin suscribirse arranca el cooldown de 7 días. Tras suscribirse se
     usa `cerrarSinCooldown`: manda CLAVE_SUSCRITO, que es para siempre.

     Son dos funciones y no una con un `if (estado !== "exito")` porque ese
     chequeo se leería del estado capturado en el render, no del actual: los
     cierres diferidos con setTimeout arrancan ANTES de que el estado pase a
     "exito", así que la condición sería siempre verdadera y escribiría el
     cooldown igual. Explícito y sin closure de por medio. */
  const cerrarSinCooldown = useCallback(() => setAbierto(false), []);

  const cerrar = useCallback(() => {
    setAbierto(false);
    localStorage.setItem(CLAVE_VISTO, String(Date.now()));
  }, []);

  /* ── Envío ──────────────────────────────────────────────────────────── */
  async function suscribir(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);

    /*
      HONEYPOT — la primera puerta, antes que cualquier otra cosa.

      El campo `trampa` está oculto y fuera del orden de tabulación: una
      persona no puede llenarlo ni queriendo. Un bot que rellena todos los
      <input> del formulario sí.

      Clave: se finge el éxito. Si respondiéramos "error" el bot aprendería
      cuál campo lo delató y lo dejaría vacío en el próximo intento. Así se
      va convencido de haber funcionado, y no se inserta nada.
    */
    if (trampa !== "") {
      setEstado("exito");
      // Sí escribe el cooldown: al bot le da igual, y si por algún motivo raro
      // fuera una persona con un autofill agresivo, no la volvemos a molestar.
      window.setTimeout(cerrar, CIERRE_TRAS_EXITO_MS);
      return;
    }

    if (!esEmailValido(email)) {
      setError("Revisa el correo: no parece una dirección válida.");
      return;
    }

    setEstado("enviando");

    const supabase = createClient();
    const { error: errInsert } = await supabase
      .from("suscriptores")
      .insert({ email: normalizarEmail(email), origen: "popup" });

    if (errInsert) {
      /*
        23505 = unique_violation. NO es un fallo: ese correo ya está en la
        lista, que es exactamente lo que la persona quería. Se avisa en tono
        amable y se cierra como un éxito, incluida la marca de "ya suscrito"
        para no volver a molestarla.
      */
      if (errInsert.code === "23505") {
        localStorage.setItem(CLAVE_SUSCRITO, "1");
        setAviso("Este email ya está suscrito. ¡Gracias por seguirnos!");
        setEstado("form");
        window.setTimeout(cerrarSinCooldown, CIERRE_TRAS_EXITO_MS);
        return;
      }

      // Cualquier otra cosa sí es un fallo real: la persona puede reintentar.
      setError("No pudimos suscribirte. Inténtalo de nuevo en un momento.");
      setEstado("form");
      return;
    }

    localStorage.setItem(CLAVE_SUSCRITO, "1");
    setEstado("exito");
    window.setTimeout(cerrarSinCooldown, CIERRE_TRAS_EXITO_MS);
  }

  if (!abierto) return null;

  return (
    <aside
      /*
        Anclada abajo a la derecha en escritorio. En móvil `left-4 right-4`
        la estira de borde a borde con margen, y `sm:left-auto` la suelta a
        partir de 640px para que vuelva a ser una tarjeta de ancho fijo.

        `w-auto sm:w-[380px]`: sin el `w-auto` explícito, el ancho fijo ganaría
        también en móvil y se saldría de pantalla en un teléfono angosto.
      */
      className="entrada-popup fixed bottom-4 left-4 right-4 sm:bottom-6 sm:right-6 sm:left-auto w-auto sm:w-[380px]"
      style={{ zIndex: Z_INDEX }}
      aria-labelledby="popup-suscripcion-titulo"
    >
      <div
        className="relative"
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "14px",
          padding: "28px 26px 22px",
          // Doble sombra: una amplia y difusa que despega la tarjeta del fondo,
          // y una corta y cerrada que le da el canto. Una sola sombra grande
          // se ve como una mancha; este par se lee como un objeto apoyado.
          boxShadow: "0 18px 48px rgba(0,0,0,0.28), 0 2px 6px rgba(0,0,0,0.12)",
        }}
      >
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar"
          className="absolute top-3 right-3 p-1 rounded transition-colors hover:bg-black/5"
          style={{ color: "#8A8A92" }}
        >
          <X size={18} />
        </button>

        {estado === "exito" ? (
          /* Éxito: reemplaza el formulario y se cierra solo. */
          <div className="py-4">
            <p
              style={{
                fontFamily: "var(--font-titulo)",
                fontSize: "26px",
                lineHeight: 1.15,
                color: "#161616",
                textTransform: "uppercase",
              }}
            >
              ¡Bienvenido a MuzikChile!
            </p>
            <p
              className="mt-2"
              style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#555555" }}
            >
              Te escribimos pronto.
            </p>
          </div>
        ) : (
          <>
            {/* Barrita roja de marca */}
            <div
              style={{
                width: "48px",
                height: "4px",
                borderRadius: "2px",
                backgroundColor: "#B02F3C",
                marginBottom: "18px",
              }}
            />

            <h2
              id="popup-suscripcion-titulo"
              style={{
                // La familia y el peso los pone la regla central de h1–h6 en
                // globals.css (Anton, weight 400). Acá solo el tamaño.
                fontSize: "28px",
                lineHeight: 1.1,
                letterSpacing: "0.01em",
                // Margen derecho para que el titular no choque con la ✕.
                paddingRight: "24px",
                color: "#161616",
                textTransform: "uppercase",
              }}
            >
              No te pierdas ni una
            </h2>

            <p
              className="mt-2.5"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                lineHeight: 1.6,
                color: "#555555",
              }}
            >
              Entérate primero de los lanzamientos, videos y noticias de la escena
              chilena. Directo a tu correo.
            </p>

            <form onSubmit={suscribir} className="mt-5" noValidate>
              {/*
                HONEYPOT.

                `display: none` lo saca del árbol de accesibilidad, así que un
                lector de pantalla tampoco lo anuncia. `tabIndex={-1}` lo saca
                del tabulador y `autoComplete="off"` evita que el gestor de
                contraseñas lo rellene solo — un autofill sería un falso
                positivo que bloquearía a una persona real.

                `aria-hidden` es cinturón y tirantes por si el display cambia.
              */}
              <input
                type="text"
                name="empresa"
                value={trampa}
                onChange={(e) => setTrampa(e.target.value)}
                style={{ display: "none" }}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="tu@email.com"
                aria-label="Correo electrónico"
                aria-invalid={error ? true : undefined}
                className="w-full rounded-md px-3 py-2.5 text-sm border focus:outline-none transition-colors"
                style={{
                  fontFamily: "var(--font-body)",
                  backgroundColor: "#FFFFFF",
                  borderColor: error ? "#B02F3C" : "#DDD8D0",
                  color: "#161616",
                }}
              />

              {error && (
                <p
                  className="mt-2"
                  style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "#B02F3C" }}
                >
                  {error}
                </p>
              )}

              {/* Ámbar, no rojo: no hizo nada mal. */}
              {aviso && (
                <p
                  className="mt-2"
                  style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "#8A6D1F" }}
                >
                  {aviso}
                </p>
              )}

              <button
                type="submit"
                disabled={estado === "enviando"}
                className="w-full mt-3 rounded-md transition-opacity disabled:opacity-60"
                style={{
                  fontFamily: "var(--font-titulo)",
                  fontSize: "17px",
                  letterSpacing: "0.04em",
                  padding: "11px 0",
                  backgroundColor: "#B02F3C",
                  color: "#ffffff",
                  textTransform: "uppercase",
                }}
              >
                {estado === "enviando" ? "Suscribiendo…" : "Suscribirme"}
              </button>
            </form>

            <p
              className="mt-3.5"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "11.5px",
                lineHeight: 1.5,
                color: "#8A8A92",
              }}
            >
              Al suscribirte aceptas nuestra{" "}
              <Link
                href="/privacidad"
                style={{ color: "#2C567F", textDecoration: "underline" }}
              >
                Política de Privacidad
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
