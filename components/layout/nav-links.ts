export interface NavLink {
  label: string;
  href: string;
  /** Abre en pestaña nueva; el subdominio de videos vive fuera de esta app. */
  external?: boolean;
}

/**
 * Navegación principal del sitio público. Header y Footer consumen esta misma
 * lista para que no se desincronicen.
 *
 * Nota: /noticias, /convocatorias, /artistas y /tienda todavía no existen como
 * rutas — se crean en la siguiente tanda. Los links ya apuntan ahí a propósito.
 */
export const NAV_LINKS: NavLink[] = [
  { label: "Videos",        href: "https://tv.muzikchile.cl", external: true },
  { label: "Noticias",      href: "/noticias" },
  { label: "Convocatorias", href: "/convocatorias" },
  { label: "Artistas",      href: "/artistas" },
  { label: "Tienda",        href: "/tienda" },
];

/** Acceso al panel de artista. Ya funciona hoy: el guard de /panel respeta redirectTo. */
export const ACCESO_ARTISTAS_HREF = "/login?redirectTo=/panel";
