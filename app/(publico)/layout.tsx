import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

/**
 * Layout del sitio público. Header y Footer se montan una sola vez acá en vez
 * de importarse a mano en cada página (así estaba antes: <Header/> repetido en
 * 7 archivos y ausente en login, registro y las 3 páginas de resultado de pago).
 *
 * El wrapper es un <div> y no un <main> a propósito: la home, /carrito y
 * /checkout ya traen su propio <main>, y anidarlos sería HTML inválido.
 *
 * /panel y /admin quedan fuera de este grupo: montan su propio Header + Sidebar.
 */
export default function PublicoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </>
  );
}
