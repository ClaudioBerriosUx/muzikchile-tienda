export interface NavLink {
  label: string;
  href: string;
  /**
   * Abre en pestaña nueva y con icono ↗, para destinos fuera de esta app.
   *
   * Hoy no lo usa ningún link: "Videos" apuntaba a tv.muzikchile.cl y pasó a ser
   * "Inicio" → `/`. Se mantiene porque Header y Footer ya saben renderizarlo y
   * el sitio sigue teniendo destinos externos candidatos.
   */
  external?: boolean;
}

/**
 * La tienda está oculta de la navegación (Header y Footer), pero /tienda, las
 * fichas de producto y el carrito siguen funcionando para quien entre por URL.
 * Para volver a mostrarla en los menús, pon esto en true.
 */
export const TIENDA_VISIBLE = false;

/**
 * Navegación principal del sitio público. Header y Footer consumen esta misma
 * lista para que no se desincronicen.
 *
 * Solo rutas que existen. "Convocatorias" (/convocatorias) y "Artistas"
 * (/artistas) se sacaron para el lanzamiento porque daban 404; vuelven cuando
 * esas páginas existan.
 */
export const NAV_LINKS: NavLink[] = [
  { label: "Inicio",   href: "/" },
  { label: "Noticias", href: "/noticias" },
  ...(TIENDA_VISIBLE ? [{ label: "Tienda", href: "/tienda" }] : []),
];

/** Acceso al panel de artista. Ya funciona hoy: el guard de /panel respeta redirectTo. */
export const ACCESO_ARTISTAS_HREF = "/login?redirectTo=/panel";
