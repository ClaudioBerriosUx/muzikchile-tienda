/**
 * Check azul de "Artista verificado" que va montado sobre el avatar (abajo a la
 * derecha). `size` es el diámetro del círculo; el aro oscuro lo separa de la foto.
 */
export default function SelloVerificado({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      className={`absolute flex rounded-full border-tema-fondo ${className ?? ""}`}
      style={{ borderWidth: size >= 24 ? 3 : 2, borderStyle: "solid" }}
    >
      <span
        role="img"
        aria-label="Artista verificado"
        title="Artista verificado"
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-tema-azul"
        style={{ width: size, height: size }}
      >
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-tema-texto" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    </span>
  );
}
