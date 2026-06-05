"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email:    z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type FormData = z.infer<typeof schema>;

function LoginContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get("redirectTo");
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ email, password }: FormData) => {
    setLoading(true);
    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { toast.error(error.message); return; }

      const { data: { user } } = await supabase.auth.getUser();

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
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

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "#f8f7f5" }}
    >
      <div
        className="w-full max-w-md rounded-xl border p-10"
        style={{ backgroundColor: "#ffffff", borderColor: "#e8e8e8", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "24px", fontWeight: "700" }}>
            <span style={{ color: "#111111" }}>MuzikChile</span>
            <span style={{ color: "#e8003d" }}>·</span>
          </span>
        </div>

        <h1 className="mb-6" style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", fontWeight: "600", color: "#111111" }}>
          Accede a tu cuenta
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#444444" }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
              className="w-full rounded-md px-3 py-2.5 text-sm border transition-colors focus:outline-none"
              style={{ fontFamily: "DM Sans, sans-serif", borderColor: errors.email ? "#e8003d" : "#e8e8e8", color: "#111111" }}
              onFocus={(e) => { if (!errors.email) e.currentTarget.style.borderColor = "#e8003d"; }}
              onBlur={(e)  => { if (!errors.email) e.currentTarget.style.borderColor = "#e8e8e8"; }}
            />
            {errors.email && <span style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#e8003d" }}>{errors.email.message}</span>}
          </div>

          {/* Contraseña */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#444444" }}>
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
              className="w-full rounded-md px-3 py-2.5 text-sm border transition-colors focus:outline-none"
              style={{ fontFamily: "DM Sans, sans-serif", borderColor: errors.password ? "#e8003d" : "#e8e8e8", color: "#111111" }}
              onFocus={(e) => { if (!errors.password) e.currentTarget.style.borderColor = "#e8003d"; }}
              onBlur={(e)  => { if (!errors.password) e.currentTarget.style.borderColor = "#e8e8e8"; }}
            />
            {errors.password && <span style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#e8003d" }}>{errors.password.message}</span>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-md font-semibold transition-colors mt-1"
            style={{ fontFamily: "Barlow, sans-serif", backgroundColor: loading ? "#f0a0b0" : "#e8003d", color: "#ffffff", cursor: loading ? "not-allowed" : "pointer" }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#c5002e"; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#e8003d"; }}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="text-center mt-4">
          <a
            href="/recuperar"
            style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#666666" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#e8003d")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
          >
            ¿Olvidaste tu contraseña?
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f7f5" }}>
        <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Cargando...</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
