interface Props {
  estado: string;
}

const ESTILOS: Record<string, { bg: string; text: string; label: string }> = {
  en_revision: { bg: "#fef9c3", text: "#854d0e", label: "En revisión" },
  aprobado:    { bg: "#dcfce7", text: "#166534", label: "Aprobado" },
  rechazado:   { bg: "#fee2e2", text: "#991b1b", label: "Rechazado" },
  pendiente:   { bg: "#dbeafe", text: "#1e40af", label: "Pendiente" },
  pagado:      { bg: "#dcfce7", text: "#166534", label: "Pagado" },
  enviado:     { bg: "#fed7aa", text: "#9a3412", label: "Enviado" },
  entregado:   { bg: "#dcfce7", text: "#166534", label: "Entregado" },
};

export default function StatusBadge({ estado }: Props) {
  const estilo = ESTILOS[estado] ?? { bg: "#f3f4f6", text: "#374151", label: estado };

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{
        backgroundColor: estilo.bg,
        color: estilo.text,
        fontFamily: "Barlow, sans-serif",
      }}
    >
      {estilo.label}
    </span>
  );
}
