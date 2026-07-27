"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function RegistroContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [estado, setEstado] = useState<"verificando" | "valido" | "invalido">("verificando");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        setEstado(error ? "invalido" : "valido");
        return;
      }

      // Caso 3: token_hash en query string
      const token_hash = searchParams.get("token_hash") ?? searchParams.get("token");
      if (token_hash) {
        for (const type of TIPOS_TOKEN) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type });
          if (!error) { setEstado("valido"); return; }
        }
        setEstado("invalido");
        return;
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

  const inputClass = "w-full rounded-md px-3 py-2.5 text-sm border focus:outline-none transition-colors";
  const inputStyle = { fontFamily: "var(--font-body)", borderColor: "#e8e8e8", color: "#111111" };

  if (estado === "verificando") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f7f5" }}>
        <p style={{ fontFamily: "var(--font-body)", color: "#666666" }}>Verificando invitación...</p>
      </div>
    );
  }

  if (estado === "invalido") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#f8f7f5" }}>
        <div
          className="w-full max-w-md rounded-xl border p-10 text-center"
          style={{ backgroundColor: "#ffffff", borderColor: "#e8e8e8", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        >
          <div className="mb-6">
            <span style={{ fontFamily: "var(--font-titulo)", fontSize: "26px", letterSpacing: "0.02em" }}>
              <span style={{ color: "#111111" }}>MuzikChile</span>
              <span style={{ color: "#e8003d" }}>·</span>
            </span>
          </div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "20px", fontWeight: "600", color: "#111111", marginBottom: "12px" }}>
            Enlace inválido o expirado
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#666666", lineHeight: 1.6, marginBottom: "24px" }}>
            Este enlace de invitación ya no es válido. Solicita uno nuevo al administrador o intenta ingresar directamente.
          </p>
          <Link
            href="/login"
            style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#e8003d" }}
          >
            Ir al login →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#f8f7f5" }}>
      <div
        className="w-full max-w-md rounded-xl border p-10"
        style={{ backgroundColor: "#ffffff", borderColor: "#e8e8e8", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
      >
        <div className="text-center mb-8">
          <span style={{ fontFamily: "var(--font-body)", fontSize: "24px", fontWeight: "700" }}>
            <span style={{ color: "#111111" }}>MuzikChile</span>
            <span style={{ color: "#e8003d" }}>·</span>
          </span>
        </div>

        <h1 className="mb-2" style={{ fontFamily: "var(--font-titulo)", fontSize: "20px", color: "#111111" }}>
          Crea tu contraseña
        </h1>
        <p className="mb-6" style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#666666", lineHeight: 1.6 }}>
          Configura una contraseña para acceder a tu panel de artista.
        </p>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#444444" }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className={inputClass}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#e8003d")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e8e8e8")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#444444" }}>
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repite tu contraseña"
              className={inputClass}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#e8003d")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e8e8e8")}
            />
          </div>

          {errorMsg && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#e8003d" }}>{errorMsg}</p>
          )}

          <button
            onClick={crearPassword}
            disabled={guardando || !password || !confirm}
            className="w-full h-11 rounded-md font-semibold transition-colors"
            style={{
              fontFamily: "var(--font-body)",
              backgroundColor: guardando || !password || !confirm ? "#f0a0b0" : "#e8003d",
              color: "#ffffff",
              cursor: guardando ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => { if (!guardando && password && confirm) e.currentTarget.style.backgroundColor = "#c5002e"; }}
            onMouseLeave={(e) => { if (!guardando && password && confirm) e.currentTarget.style.backgroundColor = "#e8003d"; }}
          >
            {guardando ? "Guardando..." : "Crear cuenta"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RegistroPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f7f5" }}>
        <p style={{ fontFamily: "var(--font-body)", color: "#666666" }}>Cargando...</p>
      </div>
    }>
      <RegistroContent />
    </Suspense>
  );
}
