"use client";

import { COLORES_ACENTO } from "@/lib/constants";

interface Props {
  valor: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ valor, onChange }: Props) {
  return (
    <div className="grid grid-cols-8 gap-2">
      {COLORES_ACENTO.map((color) => {
        const esBlanco = color === "#ffffff";
        const seleccionado = valor === color;

        return (
          <button
            key={color}
            onClick={() => onChange(color)}
            className="w-7 h-7 rounded-full border-2 transition-all"
            style={{
              backgroundColor: color,
              borderColor: esBlanco ? "#d1d5db" : "transparent",
              outline: seleccionado ? "2px solid #111111" : "none",
              outlineOffset: seleccionado ? "2px" : "0",
            }}
            title={color}
          />
        );
      })}
    </div>
  );
}
