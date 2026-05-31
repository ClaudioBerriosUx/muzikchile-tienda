"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";

type Settings = Record<string, string>;

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: "17px", fontWeight: "600", color: "#111111" }}>
        {title}
      </h2>
      {badge && (
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ fontFamily: "Barlow, sans-serif", backgroundColor: "#dbeafe", color: "#1e40af" }}>
          {badge}
        </span>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontFamily: "Barlow, sans-serif", fontSize: "13px", color: "#666666", display: "block", marginBottom: "6px" }}>
      {children}
    </label>
  );
}

export default function ConfiguracionPage() {
  const supabase = createClient();
  const [form, setForm] = useState<Settings>({});
  const [guardando, setGuardando] = useState(false);
  const [showMpPublic, setShowMpPublic] = useState(false);
  const [showMpToken, setShowMpToken] = useState(false);
  const [showTbKey, setShowTbKey] = useState(false);

  const { data: rawSettings = [] } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("key, value");
      if (error) throw error;
      return (data ?? []) as { key: string; value: string }[];
    },
  });

  useEffect(() => {
    if (rawSettings.length > 0) {
      setForm(Object.fromEntries(rawSettings.map(({ key, value }) => [key, value ?? ""])));
    }
  }, [rawSettings]);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const guardar = async () => {
    setGuardando(true);
    try {
      for (const [key, value] of Object.entries(form)) {
        const { error } = await supabase
          .from("app_settings")
          .upsert({ key, value }, { onConflict: "key" });
        if (error) throw error;
      }
      toast.success("Configuración guardada");
    } catch {
      toast.error("Error al guardar la configuración");
    } finally {
      setGuardando(false);
    }
  };

  const inputClass = "w-full rounded-md px-3 py-2.5 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none transition-colors";

  function PasswordInput({
    value, onChange, show, onToggle, placeholder,
  }: { value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder?: string }) {
    return (
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputClass} pr-10`}
          style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999]"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-8" style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", fontWeight: "700", color: "#111111" }}>
        Configuración
      </h1>

      <div className="flex flex-col gap-10">
        {/* COMISIONES */}
        <section>
          <SectionHeader title="Comisiones" />
          <div>
            <FieldLabel>Comisión default para nuevos artistas (%)</FieldLabel>
            <input
              type="number"
              min={0} max={100}
              value={form.comision_default ?? "10"}
              onChange={(e) => set("comision_default", e.target.value)}
              className={inputClass}
              style={{ fontFamily: "DM Sans, sans-serif", color: "#111111", maxWidth: "160px" }}
            />
          </div>
        </section>

        {/* MERCADO PAGO */}
        <section className="border-t border-[#e8e8e8] pt-8">
          <SectionHeader title="MercadoPago" />
          <div className="flex flex-col gap-4">
            <div>
              <FieldLabel>Public Key</FieldLabel>
              <PasswordInput
                value={form.mp_public_key ?? ""}
                onChange={(v) => set("mp_public_key", v)}
                show={showMpPublic}
                onToggle={() => setShowMpPublic((s) => !s)}
                placeholder="APP_USR-..."
              />
            </div>
            <div>
              <FieldLabel>Access Token</FieldLabel>
              <PasswordInput
                value={form.mp_access_token ?? ""}
                onChange={(v) => set("mp_access_token", v)}
                show={showMpToken}
                onToggle={() => setShowMpToken((s) => !s)}
                placeholder="APP_USR-..."
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#111111", fontWeight: 600 }}>
                  Modo producción
                </p>
                <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#666666" }}>
                  Desactivado = Sandbox
                </p>
              </div>
              <Switch
                checked={form.mp_modo === "produccion"}
                onCheckedChange={(c) => set("mp_modo", c ? "produccion" : "sandbox")}
              />
            </div>
          </div>
        </section>

        {/* TRANSBANK */}
        <section className="border-t border-[#e8e8e8] pt-8">
          <SectionHeader title="Transbank" badge="Próximamente" />
          <div className="flex flex-col gap-4 opacity-60 pointer-events-none">
            <div>
              <FieldLabel>Código de comercio</FieldLabel>
              <input
                type="text"
                value={form.transbank_commerce_code ?? ""}
                onChange={(e) => set("transbank_commerce_code", e.target.value)}
                className={inputClass}
                style={{ fontFamily: "DM Sans, sans-serif", color: "#111111" }}
                placeholder="597055555532"
              />
            </div>
            <div>
              <FieldLabel>API Key</FieldLabel>
              <PasswordInput
                value={form.transbank_api_key ?? ""}
                onChange={(v) => set("transbank_api_key", v)}
                show={showTbKey}
                onToggle={() => setShowTbKey((s) => !s)}
                placeholder="579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "14px", color: "#111111", fontWeight: 600 }}>
                  Modo producción
                </p>
                <p style={{ fontFamily: "Barlow, sans-serif", fontSize: "12px", color: "#666666" }}>
                  Desactivado = Integración
                </p>
              </div>
              <Switch
                checked={form.transbank_modo === "produccion"}
                onCheckedChange={(c) => set("transbank_modo", c ? "produccion" : "integracion")}
              />
            </div>
          </div>
        </section>

        {/* LOGÍSTICA */}
        <section className="border-t border-[#e8e8e8] pt-8">
          <SectionHeader title="Logística" badge="Próximamente" />
          <div className="opacity-60 pointer-events-none">
            <FieldLabel>Porcentaje de embalaje (%)</FieldLabel>
            <input
              type="number"
              min={0} max={100}
              value={form.logistica_embalaje ?? "5"}
              onChange={(e) => set("logistica_embalaje", e.target.value)}
              className={inputClass}
              style={{ fontFamily: "DM Sans, sans-serif", color: "#111111", maxWidth: "160px" }}
            />
          </div>
        </section>

        {/* Botón guardar */}
        <div className="border-t border-[#e8e8e8] pt-6">
          <button
            onClick={guardar}
            disabled={guardando}
            className="h-11 px-8 rounded-md text-white font-semibold transition-colors"
            style={{
              fontFamily: "Barlow, sans-serif",
              fontSize: "15px",
              backgroundColor: guardando ? "#f0a0b0" : "#e8003d",
              cursor: guardando ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => { if (!guardando) e.currentTarget.style.backgroundColor = "#c5002e"; }}
            onMouseLeave={(e) => { if (!guardando) e.currentTarget.style.backgroundColor = "#e8003d"; }}
          >
            {guardando ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>
      </div>
    </div>
  );
}
