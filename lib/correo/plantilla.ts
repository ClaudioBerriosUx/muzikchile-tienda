import { BASE_URL, CORREO_CONTACTO } from "@/lib/site";

/**
 * Piezas de los correos: escape, montos, fechas y el marco HTML.
 *
 * Todo lo que escribe un usuario (nombres, productos, direcciones, comentarios)
 * pasa por `esc` antes de ir al HTML. Los correos usan tablas y estilos en
 * línea, que es lo que entienden los clientes de correo, y fondo claro.
 */

export function esc(texto: string | number | null | undefined): string {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

/** "7 de noviembre de 2026 a las 14:05", hora de Chile, 24 horas. */
export function fechaChile(iso: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/** El número que ven comprador, artista y admin: los primeros 8 del grupo, en mayúsculas. */
export const numeroPedido = (grupoId: string) => grupoId.slice(0, 8).toUpperCase();

const COLOR = { texto: "#1a1a1a", suave: "#555555", borde: "#e4e4e4", fondo: "#f4f3f1", marca: "#e8003d" };

/** Marco común: logo en texto, contenido y pie con el contacto. */
export function marco(titulo: string, cuerpoHtml: string): string {
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:${COLOR.fondo};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.fondo};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${COLOR.borde};border-radius:10px;">
<tr><td style="padding:24px 28px 8px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;letter-spacing:1px;color:${COLOR.texto};">
MUZIK<span style="color:${COLOR.marca};">CHILE</span>
</td></tr>
<tr><td style="padding:8px 28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${COLOR.texto};">
${cuerpoHtml}
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid ${COLOR.borde};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${COLOR.suave};">
MuzikChile · <a href="${BASE_URL}" style="color:${COLOR.suave};">${esc(BASE_URL.replace(/^https?:\/\//, ""))}</a> · ${esc(CORREO_CONTACTO)}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export const h2 = (texto: string) =>
  `<h2 style="margin:24px 0 8px;font-size:16px;text-transform:uppercase;letter-spacing:0.5px;color:${COLOR.texto};">${esc(texto)}</h2>`;

export const p = (html: string, chico = false) =>
  `<p style="margin:0 0 12px;${chico ? `font-size:13px;color:${COLOR.suave};` : ""}">${html}</p>`;

/**
 * Tabla de dos columnas (concepto · monto), con la última fila en negrita si
 * `total`. `ajustar`: la segunda columna puede partirse (datos, no montos).
 */
export function tablaMontos(filas: [string, string][], total?: [string, string], ajustar = false): string {
  const fila = ([a, b]: [string, string], negrita = false) =>
    `<tr><td style="padding:6px 0;border-bottom:1px solid ${COLOR.borde};${negrita ? "font-weight:bold;" : ""}">${a}</td>` +
    `<td align="right" style="padding:6px 0 6px 12px;border-bottom:1px solid ${COLOR.borde};${ajustar ? "word-break:break-word;" : "white-space:nowrap;"}${negrita ? "font-weight:bold;" : ""}">${b}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">` +
    filas.map((f) => fila(f)).join("") + (total ? fila(total, true) : "") + `</table>`;
}

export const boton = (href: string, texto: string) =>
  `<p style="margin:20px 0;"><a href="${esc(href)}" style="display:inline-block;padding:12px 20px;background:${COLOR.texto};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">${esc(texto)}</a></p>`;
