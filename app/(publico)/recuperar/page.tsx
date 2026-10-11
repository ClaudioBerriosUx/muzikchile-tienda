"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { CORREO_CONTACTO } from "@/lib/site";
import {
  Aviso,
  Bajada,
  BotonPrimario,
  Campo,
  Enlace,
  IconoCorreo,
  IconoEstado,
  PantallaTarjeta,
  Titulo,
} from "@/components/acceso/ui";

const schema = z.object({
  email: z.string().email("Escribe un correo válido, por ejemplo tu@correo.cl"),
});

type FormData = z.infer<typeof schema>;

/** Supabase permite un correo de recuperación por minuto por dirección. */
const ESPERA_REENVIO = 60;

export default function RecuperarPage() {
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  /** Segundos que faltan para poder reenviar. 0 = habilitado. */
  const [espera, setEspera] = useState(0);
  const [reenviado, setReenviado] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  /** Envía el enlace. Devuelve true si Supabase lo aceptó. */
  const pedirEnlace = async (email: string): Promise<boolean> => {
    setLoading(true);
    setErrorEnvio(null);
    try {
      const supabase = createClient();

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // /registro ya sabe crear la contraseña a partir de la sesión del link.
        redirectTo: `${window.location.origin}/registro`,
      });

      if (error) {
        setErrorEnvio(error.message);
        return false;
      }
      setEspera(ESPERA_REENVIO);
      return true;
    } catch (err) {
      setErrorEnvio(err instanceof Error ? err.message : "Error al enviar el enlace");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const enviar = async ({ email }: FormData) => {
    // No se confirma ni se niega que el email exista: eso permitiría
    // enumerar cuentas registradas.
    if (await pedirEnlace(email)) {
      setReenviado(false);
      setEnviado(email);
    }
  };

  const reenviar = async () => {
    if (!enviado || espera > 0 || loading) return;
    if (await pedirEnlace(enviado)) setReenviado(true);
  };

  return (
    <PantallaTarjeta>
      {enviado ? (
        <>
          <IconoEstado tipo="info">
            <IconoCorreo className="h-[26px] w-[26px]" />
          </IconoEstado>

          <div className="flex flex-col gap-3">
            <Titulo>Revisa tu correo</Titulo>
            <Bajada>
              Si <strong className="font-bold text-tema-texto">{enviado}</strong> está registrado, te
              enviamos un enlace para crear tu nueva contraseña. Puede tardar un par de minutos.
            </Bajada>
          </div>

          <Aviso tipo="info">
            <strong>Abre el enlace en este mismo navegador.</strong> Si lo abres en otro dispositivo o
            navegador, no va a funcionar y tendrás que pedir uno nuevo.
          </Aviso>

          {errorEnvio && <Aviso tipo="error"><strong>No pudimos reenviar el enlace.</strong> {errorEnvio}</Aviso>}

          <div className="flex flex-col gap-2.5 text-sm leading-[1.6] text-tema-texto-3">
            <p className="m-0">
              ¿No llegó? Revisa tu carpeta de spam.
              {reenviado && espera > 0 && <span className="text-tema-texto-2"> Te lo mandamos de nuevo.</span>}
            </p>
            <button
              type="button"
              onClick={reenviar}
              disabled={espera > 0 || loading}
              className="box-border flex h-11 w-full items-center justify-center rounded-[10px] border border-tema-borde-campo text-sm font-bold text-tema-texto hover:bg-tema-hover focus-visible:outline-2 focus-visible:outline-tema-azul-texto disabled:cursor-not-allowed disabled:text-tema-texto-3 disabled:hover:bg-transparent"
            >
              {loading
                ? "Reenviando…"
                : espera > 0
                  ? <>Reenviar el enlace <span className="ml-1 tabular-nums">({espera} s)</span></>
                  : "Reenviar el enlace"}
            </button>
            <p className="m-0">
              <button
                type="button"
                onClick={() => { setEnviado(null); setErrorEnvio(null); }}
                className="font-medium text-tema-azul-texto hover:text-tema-azul-texto-hover hover:underline"
              >
                Usar otro correo
              </button>
              {" · "}
              <Enlace href="/login">Volver al acceso</Enlace>
            </p>
          </div>
        </>
      ) : (
        <>
          <Enlace href="/login" className="flex items-center gap-[7px] self-start text-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-3.5 w-3.5">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="11 6 5 12 11 18" />
            </svg>
            Volver al acceso
          </Enlace>

          <div className="flex flex-col gap-3">
            <Titulo>¿Se te perdió la clave?</Titulo>
            <Bajada>
              Escribe el correo con el que te invitamos a MuzikChile y te mandamos un enlace para crear
              una contraseña nueva.
            </Bajada>
          </div>

          {errorEnvio && <Aviso tipo="error"><strong>No pudimos enviar el enlace.</strong> {errorEnvio}</Aviso>}

          <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4 md:gap-5">
            <Campo
              id="email"
              etiqueta="Correo"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.cl"
              error={errors.email?.message}
              {...register("email")}
            />
            <BotonPrimario cargando={loading} textoCargando="Enviando…">Enviar enlace</BotonPrimario>
          </form>

          <p className="m-0 text-sm leading-[1.6] text-tema-texto-3">
            ¿No tienes acceso todavía? Escríbenos a{" "}
            <Enlace href={`mailto:${CORREO_CONTACTO}`} className="font-bold">{CORREO_CONTACTO}</Enlace>.
          </p>
        </>
      )}
    </PantallaTarjeta>
  );
}
