"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function RegistroContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? searchParams.get("token_hash");

  const [estado, setEstado] = useState<"verificando" | "valido" | "invalido">("verificando");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setEstado("invalido");
      return;
    }
    const supabase = createClient();
    supabase.auth
      .verifyOtp({ token_hash: token, type: "magiclink" })
      .then(({ error }) => setEstado(error ? "invalido" : "valido"));
  }, [token]);

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
  const inputStyle = { fontFamily: "DM Sans, sans-serif", borderColor: "#e8e8e8", color: "#111111" };

  if (estado === "verificando") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f7f5" }}>
        <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Verificando invitación...</p>
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
            <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "24px", fontWeight: "700" }}>
              <span style={{ color: "#111111" }}>MuzikChile</span>
              <span style={{ color: "#e8003d" }}>·</span>
            </span>
          </div>
          <p style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", fontWeight: "600", color: "#111111", marginBottom: "12px" }}>
            Enlace inválido o expirado
          </p>
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "14px", color: "#666666", lineHeight: 1.6, marginBottom: "24px" }}>
            Este enlace de invitación ya no es válido. Solicita uno nuevo al administrador o intenta ingresar directamente.
          </p>
          <Link
            href="/login"
            style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#e8003d" }}
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
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "24px", fontWeight: "700" }}>
            <span style={{ color: "#111111" }}>MuzikChile</span>
            <span style={{ color: "#e8003d" }}>·</span>
          </span>
        </div>

        <h1 className="mb-2" style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", fontWeight: "600", color: "#111111" }}>
          Crea tu contraseña
        </h1>
        <p className="mb-6" style={{ fontFamily: "DM Sans, sans-serif", fontSize: "14px", color: "#666666", lineHeight: 1.6 }}>
          Configura una contraseña para acceder a tu panel de artista.
        </p>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#444444" }}>
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
            <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#444444" }}>
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
            <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#e8003d" }}>{errorMsg}</p>
          )}

          <button
            onClick={crearPassword}
            disabled={guardando || !password || !confirm}
            className="w-full h-11 rounded-md font-semibold transition-colors"
            style={{
              fontFamily: "Barlow, sans-serif",
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
        <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Cargando...</p>
      </div>
    }>
      <RegistroContent />
    </Suspense>
  );
}
