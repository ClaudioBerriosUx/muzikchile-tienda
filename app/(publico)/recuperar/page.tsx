"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z.string().email("Email inválido"),
});

type FormData = z.infer<typeof schema>;

export default function RecuperarPage() {
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const enviar = async ({ email }: FormData) => {
    setLoading(true);
    try {
      const supabase = createClient();

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // /registro ya sabe crear la contraseña a partir de la sesión del link.
        redirectTo: `${window.location.origin}/registro`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // No se confirma ni se niega que el email exista: eso permitiría
      // enumerar cuentas registradas.
      toast.success("Si el email está registrado, te llegará un enlace");
      setEnviado(email);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar el enlace");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: "#f8f7f5" }}
    >
      <div
        className="w-full max-w-md rounded-xl border p-10"
        style={{
          backgroundColor: "#ffffff",
          borderColor: "#e8e8e8",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "24px", fontWeight: "700" }}>
            <span style={{ color: "#111111" }}>MuzikChile</span>
            <span style={{ color: "#e8003d" }}>·</span>
          </span>
        </div>

        {enviado ? (
          <div className="text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: "#dcfce7" }}
            >
              <MailCheck size={26} style={{ color: "#166534" }} />
            </div>

            <h1
              className="mb-3"
              style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", fontWeight: "600", color: "#111111" }}
            >
              Revisa tu correo
            </h1>

            <p
              style={{ fontFamily: "Barlow, sans-serif", fontSize: "15px", color: "#666666", lineHeight: 1.6 }}
            >
              Si <strong style={{ color: "#111111" }}>{enviado}</strong> está registrado,
              te enviamos un enlace para crear una contraseña nueva. El enlace
              vence en una hora.
            </p>

            <p
              className="mt-4"
              style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#999999" }}
            >
              ¿No llegó? Revisa spam o{" "}
              <button
                type="button"
                onClick={() => setEnviado(null)}
                className="underline cursor-pointer"
                style={{ color: "#e8003d" }}
              >
                intenta con otro email
              </button>
              .
            </p>

            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full h-11 rounded-md border mt-7 transition-colors"
              style={{ fontFamily: "Barlow, sans-serif", borderColor: "#111111", color: "#111111" }}
            >
              Volver al login
            </Link>
          </div>
        ) : (
          <>
            <h1
              className="mb-2"
              style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", fontWeight: "600", color: "#111111" }}
            >
              Recuperar contraseña
            </h1>
            <p
              className="mb-6"
              style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#666666", lineHeight: 1.5 }}
            >
              Ingresa tu email y te enviamos un enlace para crear una contraseña nueva.
            </p>

            <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-5" noValidate>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email"
                  style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#444444" }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register("email")}
                  className="w-full rounded-md px-3 py-2.5 text-sm border transition-colors focus:outline-none"
                  style={{
                    fontFamily: "DM Sans, sans-serif",
                    borderColor: errors.email ? "#e8003d" : "#e8e8e8",
                    color: "#111111",
                  }}
                  onFocus={(e) => { if (!errors.email) e.currentTarget.style.borderColor = "#e8003d"; }}
                  onBlur={(e)  => { if (!errors.email) e.currentTarget.style.borderColor = "#e8e8e8"; }}
                />
                {errors.email && (
                  <span style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#e8003d" }}>
                    {errors.email.message}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-md font-semibold transition-colors mt-1"
                style={{
                  fontFamily: "Barlow, sans-serif",
                  backgroundColor: loading ? "#f0a0b0" : "#e8003d",
                  color: "#ffffff",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#c5002e"; }}
                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#e8003d"; }}
              >
                {loading ? "Enviando..." : "Enviar enlace"}
              </button>
            </form>

            <p className="text-center mt-4">
              <Link
                href="/login"
                style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#666666" }}
              >
                Volver al login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
