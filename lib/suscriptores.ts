/**
 * Validación y normalización de emails del boletín.
 *
 * Vive fuera del componente a propósito: es lógica pura, sin React ni DOM, así
 * que se puede ejercitar sola. El popup original del Channel tenía esta lógica
 * enterrada dentro del handler del formulario, donde no había forma de probarla
 * sin abrir un navegador.
 */

/**
 * A propósito NO es la regex RFC 5322 completa (es monstruosa y acepta cosas
 * que ningún proveedor real entrega). Exige lo que importa en la práctica:
 * parte local sin espacios ni arrobas, una arroba, dominio con al menos un
 * punto y un TLD de 2+ letras.
 *
 * Descarta lo que el `email.includes("@")` del original dejaba pasar:
 * "a@b", "@dominio.cl", "hola @ mail.cl", "juan@.cl", "juan@dominio.".
 *
 * La validación de verdad de un email es mandarle un correo — o sea, el doble
 * opt-in que todavía no está implementado. Esto solo filtra tipeos y basura.
 */
const RE_EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;

/** Tope del RFC 5321: 254 caracteres en total. */
const LARGO_MAX = 254;

export function esEmailValido(email: string): boolean {
  const limpio = email.trim();
  // Sin el tope, la regex puede masticar cadenas absurdamente largas.
  if (limpio.length === 0 || limpio.length > LARGO_MAX) return false;
  return RE_EMAIL.test(limpio);
}

/**
 * Minúsculas y sin espacios: es esta forma la que colisiona contra el UNIQUE
 * de `suscriptores.email`. Sin normalizar, 'Ana@X.cl' y 'ana@x.cl' entrarían
 * como dos filas distintas y la persona recibiría todo por duplicado.
 */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}
