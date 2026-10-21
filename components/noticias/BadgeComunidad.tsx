import { F } from "@/lib/portada";

/**
 * Etiqueta de origen para las notas publicadas por artistas (y aprobadas en
 * moderación). Las editoriales no llevan etiqueta: son el caso por defecto.
 * Azul y no rojo para no competir con el badge de categoría.
 */
export default function BadgeComunidad({ grande = false }: { grande?: boolean }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full border border-tema-azul bg-tema-azul-fondo text-tema-azul-etiqueta"
      style={{
        fontFamily: F.body,
        fontSize: grande ? "12px" : "11px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      Comunidad
    </span>
  );
}
