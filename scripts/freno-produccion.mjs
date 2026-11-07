/**
 * Freno de los scripts verificar:* que escriben: no corren contra producción.
 *
 * Las pruebas que escriben van en la base de pruebas (.env.pruebas). No hay
 * opción para saltarse este chequeo. Se llama antes de crear cualquier cliente.
 *
 * Revisa los dos caminos por los que un script llega a la base:
 *   - NEXT_PUBLIC_SUPABASE_URL, a la que le pega directo.
 *   - --api=<url>, cuyo servidor escribe en la base que tenga configurada.
 *     Contra localhost, el servidor tiene que partir con `npm run dev:pruebas`.
 */

const REF_PRODUCCION = "rgskspvuvzwmvmsccoez";
const APIS_PRODUCCION = /(^|\.)muzikchile\.cl$|^muzikchile-tienda\.vercel\.app$/i;

function frenar(motivo) {
  console.error(`\nNo se corre: ${motivo}`);
  console.error("Este script escribe en la base. Usa la base de pruebas (.env.pruebas), con su npm run.");
  process.exit(1);
}

export function frenarSiEsProduccion() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url) frenar("falta NEXT_PUBLIC_SUPABASE_URL.");
  if (url.includes(REF_PRODUCCION)) frenar("NEXT_PUBLIC_SUPABASE_URL es la de producción.");

  const api = process.argv.find((a) => a.startsWith("--api="))?.slice("--api=".length);
  if (api) {
    let host;
    try { host = new URL(api).hostname; } catch { frenar(`--api no es una URL: ${api}`); }
    if (APIS_PRODUCCION.test(host)) frenar(`--api apunta a producción (${host}).`);
  }
}
