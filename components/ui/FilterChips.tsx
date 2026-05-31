"use client";

interface Opcion {
  label: string;
  value: string;
}

interface Props {
  opciones: Opcion[];
  valor: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function FilterChips({ opciones, valor, onChange, className }: Props) {
  return (
    <div
      className={`flex gap-2 overflow-x-auto pb-1 ${className ?? ""}`}
      style={{ scrollbarWidth: "none" }}
    >
      {opciones.map((op) => {
        const activo = op.value === valor;
        return (
          <button
            key={op.value}
            onClick={() => onChange(op.value)}
            className="whitespace-nowrap px-3 py-1.5 text-sm rounded border transition-colors"
            style={{
              fontFamily: "Barlow, sans-serif",
              backgroundColor: activo ? "#111111" : "#ffffff",
              borderColor: activo ? "#111111" : "#e8e8e8",
              color: activo ? "#ffffff" : "#555555",
            }}
          >
            {op.label}
          </button>
        );
      })}
    </div>
  );
}
