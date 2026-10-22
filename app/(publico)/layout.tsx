import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Analitica from "@/components/Analitica";

/**
 * Layout del sitio público. Header y Footer se montan una sola vez acá en vez
 * de importarse a mano en cada página (así estaba antes: <Header/> repetido en
 * 7 archivos y ausente en login, registro y las 3 páginas de resultado de pago).
 *
 * El wrapper es un <div> y no un <main> a propósito: la home, /carrito y
 * /checkout ya traen su propio <main>, y anidarlos sería HTML inválido.
 *
 * /panel y /admin quedan fuera de este grupo: montan HeaderPanel + Sidebar.
 *
 * El wrapper lleva `bg-tema-fondo` porque el header (cápsula de vidrio) deja
 * ver lo que hay detrás, y el <body> es blanco.
 *
 * Google Analytics se monta acá y no en el layout raíz, para que la etiqueta
 * no aparezca en el HTML de /panel ni /admin. Ver components/Analitica.tsx.
 */
export default function PublicoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-tema-fondo">
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
      <Analitica />
    </div>
  );
}
