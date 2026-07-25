/**
 * Fallback de carga global. Se muestra mientras un segmento resuelve en el
 * servidor; no lleva Header ni Footer porque el layout que corresponda ya los
 * montó por encima de este boundary.
 */
export default function Loading() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ backgroundColor: "#111111" }}
    >
      <div
        className="w-8 h-8 rounded-full animate-spin"
        style={{
          border: "3px solid rgba(255,255,255,0.15)",
          borderTopColor: "#e8003d",
        }}
      />
      <p
        style={{
          fontFamily: "Barlow, sans-serif",
          fontSize: "14px",
          color: "rgba(255,255,255,0.55)",
        }}
      >
        Cargando…
      </p>
    </div>
  );
}
