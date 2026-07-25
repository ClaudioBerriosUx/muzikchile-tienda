/**
 * Fallback de carga para las áreas privadas (/panel y /admin).
 *
 * Se renderiza DENTRO del layout del segmento: cuando aparece, el Header y el
 * Sidebar ya están montados y esto solo ocupa el área de contenido. Por eso va
 * en claro y no a pantalla completa — el fondo oscuro del loader anterior
 * chocaba con el `#ffffff` del `<main>` del panel.
 *
 * Nota: este archivo existe porque `app/loading.tsx` en la RAÍZ provocaba soft
 * 404. Un boundary de Suspense en la raíz hace que Next mande el shell por
 * streaming; una vez enviado con status 200, `notFound()` ya no puede cambiarlo
 * y las páginas inexistentes respondían 200 en vez de 404. Acotarlo a /panel y
 * /admin deja a las rutas públicas de contenido con su 404 correcto.
 */
export default function CargandoPanel() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <div
        className="w-8 h-8 rounded-full animate-spin"
        style={{
          border: "3px solid #e8e8e8",
          borderTopColor: "#e8003d",
        }}
      />
      <p
        style={{
          fontFamily: "Barlow, sans-serif",
          fontSize: "14px",
          color: "#666666",
        }}
      >
        Cargando…
      </p>
    </div>
  );
}
