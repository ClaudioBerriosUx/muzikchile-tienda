"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CORREO_CONTACTO } from "@/lib/site";
import {
  Aviso,
  Bajada,
  BotonPrimario,
  CampoContrasena,
  Enlace,
  EnlaceBoton,
  IconoCheck,
  IconoEstado,
  IconoReloj,
  PantallaTarjeta,
  Titulo,
} from "@/components/acceso/ui";
import { cn } from "@/lib/utils";

/**
 * De dónde viene el enlace, solo para elegir los textos. No interviene en la
 * verificación: se lee de la URL tal como llega.
 * - Invitación: el implicit flow trae `type=invite` en el hash.
 * - Recuperación: `type=recovery` (hash o query), o `?code=` del PKCE, que
 *   solo usa /recuperar.
 */
function origenEnlace(): "invitacion" | "recuperacion" {
  if (typeof window === "undefined") return "invitacion";
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const tipo = hash.get("type") ?? query.get("type");
  if (tipo === "recovery" || query.has("code")) return "recuperacion";
  return "invitacion";
}

function RegistroContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [estado, setEstado] = useState<"verificando" | "valido" | "invalido">("verificando");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  // Se lee en el primer render, antes de que el cliente de Supabase limpie el
  // hash de la URL al canjear la sesión. En el servidor da "invitacion", pero
  // ese primer render muestra "Verificando…", que no usa `origen`.
  const [origen] = useState(origenEnlace);
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    /**
     * Tipos de token que puede traer el enlace, en orden de intento.
     * - magiclink: login sin contraseña
     * - invite:    invitación de admin desde /admin/artistas
     * - recovery:  recuperación de contraseña desde /recuperar
     *
     * Se prueban en cadena porque el enlace no dice de qué tipo es. Un
     * verifyOtp fallido no consume el token, que es lo que ya asumía la
     * versión anterior al encadenar magiclink → invite.
     */
    const TIPOS_TOKEN = ["magiclink", "invite", "recovery"] as const;

    async function verificarEnlace() {
      // Caso 1: implicit flow — access_token llega en el hash (#)
      const hash = window.location.hash;
      if (hash && hash.length > 1) {
        const params = new URLSearchParams(hash.slice(1));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token") ?? "";
        if (access_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          setEstado(error ? "invalido" : "valido");
          return;
        }
      }

      // Caso 2: PKCE flow — ?code= (es lo que manda resetPasswordForEmail
      // cuando el cliente usa PKCE, que es el default de createBrowserClient)
      //
      // El cliente del navegador es singleton y nace con detectSessionInUrl:
      // al inicializarse (acá o antes, en el Header) ya canjea el ?code= solo
      // y borra el code verifier. Un exchangeCodeForSession manual después
      // falla con "code verifier not found" aunque la sesión ya exista — por
      // eso /recuperar terminaba siempre en "enlace inválido". getSession()
      // espera esa inicialización; el canje manual queda de respaldo.
      const code = searchParams.get("code");
      if (code) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) { setEstado("valido"); return; }

        // Sin sesión: el enlace se abrió en otro navegador (el verifier vive
        // en el que pidió el correo) o ya expiró.
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        setEstado(error ? "invalido" : "valido");
        return;
      }

      // Caso 3: token_hash en query string (es lo que mandan las plantillas de
      // invitación y recuperación). Si el enlace trae `type`, se usa ese; si
      // no, se prueban todos.
      const tipoUrl = TIPOS_TOKEN.find((t) => t === searchParams.get("type"));
      const token_hash = searchParams.get("token_hash") ?? searchParams.get("token");
      if (token_hash) {
        for (const type of tipoUrl ? [tipoUrl] : TIPOS_TOKEN) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type });
          if (!error) {
            // El token ya se usó: se saca de la URL para que recargar no lo
            // intente de nuevo. `type` se queda para el caso 4.
            router.replace(`/registro?type=${type}`);
            setEstado("valido");
            return;
          }
        }
        setEstado("invalido");
        return;
      }

      // Caso 4: recarga después del caso 3. Queda solo `?type=` y la sesión
      // que dejó el verifyOtp.
      if (tipoUrl) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) { setEstado("valido"); return; }
      }

      setEstado("invalido");
    }

    verificarEnlace();
  }, []);

  const crearPassword = async () => {
    setErrorMsg("");
    if (password.length < 8) { setErrorMsg("Mínimo 8 caracteres"); return; }
    if (password !== confirm) { setErrorMsg("Las contraseñas no coinciden"); return; }
    setGuardando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMsg(error.message);
      setGuardando(false);
    } else {
      router.push("/panel/perfil");
    }
  };

  // ── Presentación ─────────────────────────────────────────────────────────
  const largoOk = password.length >= 8;
  const coinciden = password.length > 0 && password === confirm;
  const noCoinciden = confirm.length > 0 && password !== confirm;
  const listo = largoOk && coinciden;

  if (estado === "verificando") {
    return (
      <PantallaTarjeta>
        <div role="status" className="flex items-center gap-3 text-tema-texto-2">
          <span className="inline-block h-[18px] w-[18px] animate-spin rounded-full border-[2.5px] border-tema-texto/30 border-t-tema-texto" />
          Verificando el enlace…
        </div>
      </PantallaTarjeta>
    );
  }

  if (estado === "invalido") {
    return (
      <PantallaTarjeta>
        <IconoEstado tipo="error">
          <IconoReloj className="h-[26px] w-[26px]" />
        </IconoEstado>
        <div className="flex flex-col gap-3">
          <Titulo>Este enlace ya no sirve</Titulo>
          <Bajada>
            Los enlaces vencen a las 24 horas y se pueden usar una sola vez. Pide uno nuevo y te lo
            mandamos al tiro.
          </Bajada>
        </div>
        <div className="flex flex-col items-stretch gap-3.5">
          <EnlaceBoton href="/recuperar">Pedir un enlace nuevo</EnlaceBoton>
          <Enlace href="/login" className="self-center text-sm">Volver al acceso</Enlace>
        </div>
        <p className="m-0 border-t border-tema-borde pt-[18px] text-sm leading-[1.6] text-tema-texto-3">
          ¿Sigue sin funcionar? Escríbenos a{" "}
          <Enlace href={`mailto:${CORREO_CONTACTO}`} className="font-bold">{CORREO_CONTACTO}</Enlace> y te
          ayudamos.
        </p>
      </PantallaTarjeta>
    );
  }

  return (
    <PantallaTarjeta>
      <div className="flex flex-col gap-3">
        {origen === "invitacion" ? (
          <>
            <div className="flex items-center gap-2 self-start rounded-md bg-tema-azul px-[11px] py-[5px] text-[11px] font-bold uppercase tracking-[0.16em] text-tema-texto">
              <IconoCheck className="h-[11px] w-[11px]" />
              Invitación aceptada
            </div>
            <Titulo>Bienvenido/a a MuzikChile</Titulo>
            <Bajada>
              Te invitamos porque tu música tiene lugar acá. Crea tu contraseña y entra a tu panel para
              armar tu ficha, tu tienda y tus noticias.
            </Bajada>
          </>
        ) : (
          <>
            <Titulo>Crea una contraseña nueva</Titulo>
            <Bajada>
              Elige una contraseña nueva para tu acceso. Con ella vas a entrar a tu panel la próxima vez.
            </Bajada>
          </>
        )}
      </div>

      {errorMsg && <Aviso tipo="error"><strong>No pudimos guardar la contraseña.</strong> {errorMsg}</Aviso>}

      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); crearPassword(); }}
        className="flex flex-col gap-4 md:gap-5"
      >
        <CampoContrasena
          id="password"
          etiqueta="Contraseña nueva"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="requisitos"
          mostrar={mostrar}
          onMostrarChange={setMostrar}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm" className="text-sm font-medium text-tema-texto">Repite la contraseña</label>
          <input
            id="confirm"
            type={mostrar ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Escríbela otra vez"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={noCoinciden || undefined}
            className={cn(
              "box-border h-[50px] w-full rounded-[10px] border bg-tema-campo px-4 text-base text-tema-texto placeholder:text-tema-texto-3 outline-none transition-[border-color,box-shadow] focus:border-tema-azul-texto focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--tema-azul)_60%,transparent)]",
              noCoinciden ? "border-tema-rojo" : "border-tema-borde-campo"
            )}
          />
        </div>

        <div id="requisitos" className="flex flex-col gap-2.5 rounded-[10px] border border-tema-borde bg-tema-campo px-4 py-3.5">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-tema-texto-3">Requisitos</p>
          <Requisito ok={largoOk}>
            Mínimo 8 caracteres
            <span className="ml-auto tabular-nums text-tema-texto-3">{Math.min(password.length, 99)}/8</span>
          </Requisito>
          <Requisito ok={coinciden} error={noCoinciden}>Las dos contraseñas coinciden</Requisito>
        </div>

        <BotonPrimario disabled={!listo} cargando={guardando} textoCargando="Guardando…">
          Guardar contraseña y entrar
        </BotonPrimario>
      </form>
    </PantallaTarjeta>
  );
}

function Requisito({ ok, error = false, children }: { ok: boolean; error?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 text-sm",
        ok ? "text-tema-texto" : error ? "text-tema-rojo-texto" : "text-tema-texto-2"
      )}
    >
      <span
        className={cn(
          "box-border flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]",
          ok ? "border-tema-ok bg-tema-ok" : error ? "border-tema-rojo" : "border-tema-texto-3/60"
        )}
      >
        <IconoCheck className={cn("h-2.5 w-2.5 text-tema-texto", ok ? "opacity-100" : "opacity-0")} />
      </span>
      {children}
      <span className="sr-only">{ok ? "(cumplido)" : "(pendiente)"}</span>
    </div>
  );
}

export default function RegistroPage() {
  return (
    <Suspense fallback={<PantallaTarjeta><div className="text-tema-texto-2">Cargando…</div></PantallaTarjeta>}>
      <RegistroContent />
    </Suspense>
  );
}
