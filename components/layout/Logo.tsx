import Image from "next/image";
import Link from "next/link";

/**
 * Logo oficial de MuzikChile — el lockup horizontal "MUZIK" con la estrella.
 *
 * Archivo: `public/logo.svg` (export de Illustrator, 432.146 × 167.061).
 *
 * Tres cosas que conviene saber antes de reubicarlo:
 *
 * 1. **Es blanco.** El wordmark está dibujado con `fill="#FFFFFF"`; solo el
 *    remate de la K lleva rojo y azul. Sobre fondo claro desaparece. Header y
 *    Footer son negros, así que ahí funciona — pero NO se puede reusar tal cual
 *    en las páginas de auth, que tienen fondo claro.
 * 2. **Proporción 2.59:1** (ancho:alto). A 40px de alto mide ~104px de ancho.
 * 3. **El 21% superior del viewBox está vacío**: la tinta más alta (la estrella)
 *    empieza en y≈35 de 167. Por eso el logo se ve ópticamente más chico que su
 *    caja, y por eso el alto acá es 40 y no 36.
 *
 * Al ser `.svg`, next/image lo sirve sin pasar por el optimizador (lo hace solo
 * cuando el `src` termina en `.svg`), así que no hace falta `dangerouslyAllowSVG`
 * en `next.config.ts`.
 *
 * `width`/`height` declaran la relación de aspecto que Next exige; el tamaño
 * real lo fija el `style` con `height: alto` + `width: "auto"`. Ese par preserva
 * la proporción y evita el warning de dev por modificar una sola dimensión.
 */

/** Proporción real del archivo: 432.146 / 167.061. */
const RATIO = 432.146 / 167.061;

export default function Logo({
  alto = 40,
  href = "/",
  className = "",
  prioridad = false,
}: {
  /** Altura renderizada en px. El ancho se ajusta solo según `RATIO`. */
  alto?: number;
  href?: string;
  className?: string;
  /** `priority` de next/image: activarlo solo en el logo del header (LCP). */
  prioridad?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="MuzikChile — ir al inicio"
      className={`inline-flex items-center shrink-0 ${className}`}
    >
      <Image
        src="/logo.svg"
        alt="MuzikChile"
        width={Math.round(alto * RATIO)}
        height={alto}
        priority={prioridad}
        style={{ height: alto, width: "auto" }}
      />
    </Link>
  );
}
