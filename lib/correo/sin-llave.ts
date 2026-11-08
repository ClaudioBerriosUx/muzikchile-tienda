/**
 * Qué hacer con un correo cuando no hay RESEND_API_KEY. Regla única, sin
 * imports, para que verificar:cobro la pruebe directo.
 *
 *   - "buzon_local": solo con CORREO_BUZON_LOCAL=1, que pone únicamente
 *     `npm run dev:pruebas` (base de pruebas). El correo queda en
 *     supabase/.temp/correos/ y cuenta como salido. Nunca en producción.
 *   - "fallido" en cualquier otro caso (Preview, `npm run dev` contra
 *     producción, producción mal configurada): queda registrado con "Falta
 *     RESEND_API_KEY" y el cron de producción lo reintenta. Así un entorno sin
 *     llave nunca marca como salido un correo de verdad.
 */
export function destinoSinLlave(env: Record<string, string | undefined>): "buzon_local" | "fallido" {
  if (env.VERCEL_ENV === "production") return "fallido";
  return env.CORREO_BUZON_LOCAL === "1" ? "buzon_local" : "fallido";
}

export const ERROR_SIN_LLAVE = "Falta RESEND_API_KEY";
