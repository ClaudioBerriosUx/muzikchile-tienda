/**
 * Versión vigente de los Términos para artistas. Es la que se guarda al aceptar
 * (`terminos_artistas`) y la que exigen `solicitar_tienda` y `aprobar_tienda`.
 * Si el texto cambia, sube esta versión: los artistas tendrán que aceptarlo.
 */
export const VERSION_TERMINOS_ARTISTAS = "0.9";

/**
 * Versión vigente de los Términos para compradores (lib/legal/terminos-compradores.ts).
 * Es la que exige crear-preferencia y la que se guarda en cada orden
 * (ordenes.terminos_version). Si el texto cambia, súbela.
 */
export const VERSION_TERMINOS_COMPRADORES = "0.9";
