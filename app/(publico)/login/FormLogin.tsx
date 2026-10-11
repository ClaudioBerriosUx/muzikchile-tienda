"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  CampoContrasena,
  Enlace,
  IconoCorreo,
  Titulo,
} from "@/components/acceso/ui";

// Mismas reglas que antes (correo válido, contraseña de 6+); solo cambian los
// textos, que son los del diseño.
const schema = z.object({
  email: z.string().email("Escribe un correo válido, por ejemplo tu@correo.cl"),
  password: z
    .string()
    .min(1, "Escribe tu contraseña para entrar.")
    .min(6, "La contraseña tiene al menos 6 caracteres."),
});

type FormData = z.infer<typeof schema>;

/** Supabase responde así cuando el correo o la contraseña no calzan. */
function esCredencialInvalida(error: { message: string; code?: string }) {
  return error.code === "invalid_credentials" || error.message === "Invalid login credentials";
}

export default function FormLogin() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get("redirectTo");
  const [loading, setLoading] = useState(false);
  /** Error del servidor, mostrado en el formulario (antes era un toast). */
  const [errorAuth, setErrorAuth] = useState<{ credenciales: boolean; mensaje: string } | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // ── Lógica de autenticación: sin cambios respecto de la versión anterior ──
  const onSubmit = async ({ email, password }: FormData) => {
    setLoading(true);
    setErrorAuth(null);
    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorAuth({ credenciales: esCredencialInvalida(error), mensaje: error.message });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrorAuth({ credenciales: false, mensaje: "No se pudo recuperar la sesión" });
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      router.refresh();
      if (redirectTo) {
        router.push(redirectTo);
      } else if (roleData?.role === "admin") {
        router.push("/admin");
      } else if (roleData?.role === "artista") {
        router.push("/panel");
      } else {
        router.push("/");
      }
    } finally {
      setLoading(false);
    }
  };

  const credenciales = errorAuth?.credenciales ?? false;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.22em] text-tema-texto-3">
          <span aria-hidden className="h-0.5 w-6 bg-tema-rojo" />
          Acceso artistas
        </div>
        <Titulo grande>Entra a tu escenario</Titulo>
        <Bajada>Gestiona tu ficha, tu tienda y tus noticias desde un solo lugar.</Bajada>
      </div>

      {errorAuth && (
        <Aviso tipo="error">
          {credenciales ? (
            <>
              <strong>Correo o contraseña incorrectos.</strong> Revisa los datos e inténtalo de nuevo.
            </>
          ) : (
            <>
              <strong>No pudimos iniciar sesión.</strong> {errorAuth.mensaje}
            </>
          )}
        </Aviso>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 md:gap-5">
        <Campo
          id="email"
          etiqueta="Correo"
          type="email"
          autoComplete="email"
          placeholder="tu@correo.cl"
          error={errors.email?.message}
          marcado={credenciales}
          {...register("email")}
        />

        <CampoContrasena
          id="password"
          etiqueta="Contraseña"
          autoComplete="current-password"
          placeholder="Tu contraseña"
          error={errors.password?.message}
          marcado={credenciales}
          {...register("password")}
        />

        <div className="-mt-1.5 flex justify-end">
          <Enlace href="/recuperar" className="text-sm">¿Olvidaste tu contraseña?</Enlace>
        </div>

        <BotonPrimario cargando={loading} textoCargando="Entrando…">Entrar</BotonPrimario>
      </form>

      <div className="mt-1 flex items-start gap-3.5 rounded-xl border border-tema-borde bg-tema-campo px-5 py-[18px]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-tema-azul bg-tema-azul-fondo text-tema-azul-texto">
          <IconoCorreo className="h-[17px] w-[17px]" />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="m-0 text-[15px] font-bold leading-[1.4] text-tema-texto">
            ¿Eres artista y quieres estar en MuzikChile?
          </p>
          <p className="m-0 text-sm leading-[1.6] text-tema-texto-2">
            Escríbenos a{" "}
            <Enlace href={`mailto:${CORREO_CONTACTO}`} className="font-bold">{CORREO_CONTACTO}</Enlace>.
            {" "}El acceso es solo por invitación.
          </p>
        </div>
      </div>
    </div>
  );
}
