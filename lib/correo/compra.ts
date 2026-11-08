import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { BASE_URL, CORREO_CONTACTO } from "@/lib/site";
import { textoPlazo } from "@/lib/checkout/despacho";
import { terminosCompradores } from "@/lib/legal/terminos-compradores";
import { enviarCorreo, type Armado, type ResultadoEnvio } from "@/lib/correo/enviar";
import { boton, clp, esc, fechaChile, h2, marco, numeroPedido, p, tablaMontos } from "@/lib/correo/plantilla";

/**
 * Correos de una compra pagada:
 *   - confirmacion_compra, al comprador: la confirmación escrita del art. 12 A
 *     de la Ley 19.496, con el detalle, el vendedor de cada producto, la entrega
 *     y copia íntegra de los términos que aceptó. Sin ella, el plazo de retracto
 *     sube de 10 a 90 días.
 *   - nueva_venta, a cada artista del pedido: qué despachar, a quién y en qué
 *     plazo.
 *
 * Los dispara el webhook cuando confirmar_pago devuelve "procesado" (una vez
 * por pago) y el cron /api/cron/correos los reintenta. Todo sale de la base:
 * nada del aviso de Mercado Pago.
 */

const ESTADOS_PAGADOS = new Set(["pagado", "enviado", "entregado"]);

async function cargarPedido(servicio: SupabaseClient<Database>, grupoId: string) {
  const [{ data: lineas, error }, { data: pago }] = await Promise.all([
    servicio
      .from("ordenes")
      // Un solo literal: concatenado, el cliente de Supabase pierde el tipo de las columnas.
      .select("id, artista_id, cantidad, precio_unitario, monto_artista, comision_monto, envio_monto, estado, created_at, comprador_nombre, comprador_email, direccion_envio, ciudad_envio, region_envio, entrega, entrega_plazo_min, entrega_plazo_max, entrega_detalle, terminos_version, terminos_aceptados_at, productos(nombre), artistas(nombre, user_id)")
      .eq("grupo_id", grupoId)
      .order("created_at"),
    servicio
      .from("pagos_mp")
      .select("mp_payment_id, procesado_at, revertido_at")
      .eq("grupo_id", grupoId)
      .order("procesado_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (error) throw new Error(`No se pudo leer el pedido: ${error.message}`);
  return { lineas: lineas ?? [], pago };
}

type Pedido = Awaited<ReturnType<typeof cargarPedido>>;
type Linea = Pedido["lineas"][number];

/** Las líneas de cada artista, en el orden del pedido. */
function porArtista(lineas: Linea[]): Map<string, Linea[]> {
  const grupos = new Map<string, Linea[]>();
  for (const l of lineas) {
    if (!l.artista_id) continue;
    grupos.set(l.artista_id, [...(grupos.get(l.artista_id) ?? []), l]);
  }
  return grupos;
}

const cobrado = (l: Linea) => Number(l.monto_artista) + Number(l.comision_monto);
const nombreProducto = (l: Linea) => l.productos?.nombre ?? "Producto";
const nombreArtista = (ls: Linea[]) => ls[0].artistas?.nombre ?? "El artista";

/** "Envío a …, llega en 2 a 5 días hábiles" o "Retiro: …", en HTML y en texto. */
function entrega(ls: Linea[], para: "comprador" | "artista"): { html: string; texto: string } {
  const l = ls[0];
  const envio = ls.reduce((acc, x) => acc + Number(x.envio_monto), 0);
  if (l.entrega === "retiro") {
    const html = para === "comprador"
      ? `<strong>Retiro.</strong> ${esc(l.entrega_detalle)}. ${esc(nombreArtista(ls))} te escribirá a este correo para coordinarlo.`
      : `<strong>Retiro.</strong> Indicaste: ${esc(l.entrega_detalle)}. Escríbele a ${esc(l.comprador_email)} para coordinarlo.`;
    const texto = para === "comprador"
      ? `Retiro. ${l.entrega_detalle}. ${nombreArtista(ls)} te escribirá a este correo para coordinarlo.`
      : `Retiro. Indicaste: ${l.entrega_detalle}. Escríbele a ${l.comprador_email} para coordinarlo.`;
    return { html, texto };
  }
  const direccion = [l.direccion_envio, l.ciudad_envio, l.region_envio].filter(Boolean).join(", ");
  const plazo = textoPlazo(l.entrega_plazo_min, l.entrega_plazo_max);
  const costo = envio > 0 ? clp(envio) : "sin costo";
  if (para === "comprador") {
    const cuando = plazo ? ` Llega en ${plazo} desde el pago.` : "";
    return {
      html: `<strong>Envío a domicilio</strong> (${esc(costo)}) a ${esc(direccion || "la dirección que indicaste")}.${esc(cuando)}`,
      texto: `Envío a domicilio (${costo}) a ${direccion || "la dirección que indicaste"}.${cuando}`,
    };
  }
  const cuando = plazo ? ` Plazo comprometido: ${plazo} desde el pago.` : "";
  return {
    html: `<strong>Despacha a:</strong> ${esc(l.comprador_nombre)}, ${esc(direccion || "sin dirección registrada")}. ` +
      `Correo: ${esc(l.comprador_email)}. Envío cobrado: ${esc(costo)}.${esc(cuando)}`,
    texto: `Despacha a: ${l.comprador_nombre}, ${direccion || "sin dirección registrada"}. Correo: ${l.comprador_email}. ` +
      `Envío cobrado: ${costo}.${cuando}`,
  };
}

// ── Confirmación al comprador (art. 12 A) ────────────────────────────────────

export function armarConfirmacion(grupoId: string, { lineas, pago }: Pedido): Armado {
  if (!lineas.length) return { ok: false, error: "Pedido sin órdenes" };
  const primera = lineas[0];
  const terminos = terminosCompradores(primera.terminos_version);
  if (!terminos) {
    // Sin el texto aceptado no hay copia íntegra: mejor no mandar una confirmación incompleta.
    return { ok: false, error: `No está el texto de los términos versión ${primera.terminos_version ?? "(sin versión)"}` };
  }

  const num = numeroPedido(grupoId);
  const fecha = fechaChile(pago?.procesado_at ?? primera.created_at);
  const subtotal = lineas.reduce((acc, l) => acc + Number(l.precio_unitario) * l.cantidad, 0);
  const productos = lineas.reduce((acc, l) => acc + cobrado(l), 0);
  const descuento = subtotal - productos;
  const envio = lineas.reduce((acc, l) => acc + Number(l.envio_monto), 0);
  const total = productos + envio;

  const bloquesHtml: string[] = [];
  const bloquesTexto: string[] = [];
  for (const ls of porArtista(lineas).values()) {
    const e = entrega(ls, "comprador");
    bloquesHtml.push(
      h2(`Vendido por ${nombreArtista(ls)}`) +
        tablaMontos(ls.map((l) => [`${l.cantidad} × ${esc(nombreProducto(l))}`, clp(cobrado(l))])) +
        p(e.html)
    );
    bloquesTexto.push(
      `VENDIDO POR ${nombreArtista(ls).toUpperCase()}\n` +
        ls.map((l) => `- ${l.cantidad} × ${nombreProducto(l)}: ${clp(cobrado(l))}`).join("\n") +
        `\n${e.texto}`
    );
  }

  const resumen: [string, string][] = [["Subtotal", clp(subtotal)]];
  if (descuento > 0) resumen.push(["Descuento", `−${clp(descuento)}`]);
  resumen.push(["Envío", envio > 0 ? clp(envio) : "Sin costo"]);

  const aceptados = primera.terminos_aceptados_at ? fechaChile(primera.terminos_aceptados_at) : fecha;
  const terminosHtml = terminos.secciones
    .map((s) => `<p style="margin:12px 0 4px;font-weight:bold;">${esc(s.titulo)}</p>` +
      s.parrafos.map((t) => p(esc(conTexto(t)), true)).join(""))
    .join("");
  const terminosTexto = terminos.secciones
    .map((s) => `${s.titulo.toUpperCase()}\n${s.parrafos.map(conTexto).join("\n")}`)
    .join("\n\n");

  const retracto =
    `Puedes retractarte dentro de 10 días desde que recibes tu pedido, sin expresar causa, y recibes de vuelta todo ` +
    `lo pagado, incluido el envío. Para ejercerlo, para la garantía o para cualquier reclamo, escribe a ${CORREO_CONTACTO} ` +
    `con tu número de pedido. Cada producto lo vende su artista; MuzikChile coordina con él y facilita el reembolso.`;

  const html = marco(`Confirmación de compra · Pedido ${num}`, [
    p(`Hola ${esc(primera.comprador_nombre)},`),
    p(`Tu pago fue aprobado. Esta es la <strong>confirmación de tu compra</strong>: guárdala, el número de pedido sirve para cualquier consulta.`),
    tablaMontos([
      ["Pedido", `<strong>${esc(num)}</strong>`],
      ["Fecha", esc(fecha)],
      ...(pago?.mp_payment_id ? [["Pago Mercado Pago", esc(pago.mp_payment_id)] as [string, string]] : []),
    ], undefined, true),
    ...bloquesHtml,
    h2("Resumen"),
    tablaMontos(resumen, ["Total pagado", clp(total)]),
    h2("Retracto, garantía y reclamos"),
    p(esc(retracto)),
    h2(`Términos y condiciones aceptados`),
    p(`Versión ${esc(terminos.version)}, aceptados el ${esc(aceptados)}. Copia íntegra:`, true),
    p(esc(terminos.aviso), true),
    terminosHtml,
  ].join("\n"));

  const texto = [
    `Hola ${primera.comprador_nombre},`,
    `Tu pago fue aprobado. Esta es la confirmación de tu compra: guárdala, el número de pedido sirve para cualquier consulta.`,
    `Pedido: ${num}\nFecha: ${fecha}${pago?.mp_payment_id ? `\nPago Mercado Pago: ${pago.mp_payment_id}` : ""}`,
    ...bloquesTexto,
    `RESUMEN\n${resumen.map(([a, b]) => `${a}: ${b}`).join("\n")}\nTotal pagado: ${clp(total)}`,
    `RETRACTO, GARANTÍA Y RECLAMOS\n${retracto}`,
    `TÉRMINOS Y CONDICIONES ACEPTADOS\nVersión ${terminos.version}, aceptados el ${aceptados}. Copia íntegra:\n\n${terminos.aviso}\n\n${terminosTexto}`,
    `MuzikChile · ${BASE_URL} · ${CORREO_CONTACTO}`,
  ].join("\n\n");

  return {
    ok: true,
    correo: { para: primera.comprador_email, asunto: `Confirmación de tu compra · Pedido ${num}`, html, texto },
  };
}

/** {correo} y {privacidad} en texto plano, para el correo. */
function conTexto(t: string): string {
  return t.replaceAll("{correo}", CORREO_CONTACTO).replaceAll("{privacidad}", `Política de privacidad (${BASE_URL}/privacidad)`);
}

// ── Nueva venta, al artista ──────────────────────────────────────────────────

export function armarNuevaVenta(grupoId: string, ls: Linea[], correoArtista: string | null, pago: Pedido["pago"]): Armado {
  if (!ls.length) return { ok: false, error: "El artista no tiene líneas en este pedido" };
  if (!correoArtista) return { ok: false, error: "El artista no tiene correo en su cuenta" };

  const num = numeroPedido(grupoId);
  const fecha = fechaChile(pago?.procesado_at ?? ls[0].created_at);
  const productos = ls.reduce((acc, l) => acc + cobrado(l), 0);
  const comision = ls.reduce((acc, l) => acc + Number(l.comision_monto), 0);
  const envio = ls.reduce((acc, l) => acc + Number(l.envio_monto), 0);
  const e = entrega(ls, "artista");
  const montos: [string, string][] = [
    ["Productos", clp(productos)],
    ["Envío", envio > 0 ? clp(envio) : "Sin costo"],
    ["Comisión MuzikChile", `−${clp(comision)}`],
  ];
  const paraTi = productos - comision + envio;
  const aviso = "Usa los datos del comprador solo para despachar y responder sobre este pedido.";
  // MP cobra al vendedor su propia comisión de procesamiento, que no conocemos.
  const PARA_TI = "Para ti, antes de la comisión de Mercado Pago";
  const notaMp = "Mercado Pago descuenta además su comisión de procesamiento, según las condiciones de tu cuenta con ellos.";

  const html = marco(`Nueva venta · Pedido ${num}`, [
    p(`Hola ${esc(nombreArtista(ls))},`),
    p(`Tienes una <strong>venta pagada</strong> (pedido <strong>${esc(num)}</strong>, ${esc(fecha)}). Despáchala dentro del plazo que informaste: lo que vio el comprador al pagar te obliga.`),
    h2("Qué despachar"),
    tablaMontos(ls.map((l) => [`${l.cantidad} × ${esc(nombreProducto(l))}`, clp(cobrado(l))])),
    h2("Entrega"),
    p(e.html),
    h2("Montos"),
    tablaMontos(montos, [PARA_TI, clp(paraTi)]),
    p(esc(notaMp), true),
    boton(`${BASE_URL}/panel/despacho`, "Ver en Por despachar"),
    p(esc(aviso), true),
  ].join("\n"));

  const texto = [
    `Hola ${nombreArtista(ls)},`,
    `Tienes una venta pagada (pedido ${num}, ${fecha}). Despáchala dentro del plazo que informaste: lo que vio el comprador al pagar te obliga.`,
    `QUÉ DESPACHAR\n${ls.map((l) => `- ${l.cantidad} × ${nombreProducto(l)}`).join("\n")}`,
    `ENTREGA\n${e.texto}`,
    `MONTOS\n${montos.map(([a, b]) => `${a}: ${b}`).join("\n")}\n${PARA_TI}: ${clp(paraTi)}\n${notaMp}`,
    `Ver en Por despachar: ${BASE_URL}/panel/despacho`,
    aviso,
  ].join("\n\n");

  return { ok: true, correo: { para: correoArtista, asunto: `Nueva venta · Pedido ${num}`, html, texto } };
}

// ── Envío ────────────────────────────────────────────────────────────────────

export interface ResultadoCorreosCompra {
  confirmacion: ResultadoEnvio | "sin_pago";
  ventas: Record<string, ResultadoEnvio>;
}

/**
 * Manda los correos de un pedido pagado. Idempotente: lo que ya salió no se
 * repite. Un pedido sin pagar o revertido no manda nada. Requiere service role.
 */
export async function enviarCorreosDeCompra(servicio: SupabaseClient<Database>, grupoId: string): Promise<ResultadoCorreosCompra> {
  const pedido = await cargarPedido(servicio, grupoId);
  const pagado = pedido.lineas.length > 0 && pedido.lineas.every((l) => ESTADOS_PAGADOS.has(l.estado)) && !pedido.pago?.revertido_at;
  if (!pagado) return { confirmacion: "sin_pago", ventas: {} };

  const confirmacion = await enviarCorreo(servicio, "confirmacion_compra", grupoId, async () => armarConfirmacion(grupoId, pedido));

  const ventas: Record<string, ResultadoEnvio> = {};
  for (const [artistaId, ls] of porArtista(pedido.lineas)) {
    ventas[artistaId] = await enviarCorreo(servicio, "nueva_venta", `${grupoId}:${artistaId}`, async () => {
      const userId = ls[0].artistas?.user_id;
      let correo: string | null = null;
      if (userId) {
        const { data, error } = await servicio.auth.admin.getUserById(userId);
        if (error) return { ok: false, error: `No se pudo leer la cuenta del artista: ${error.message}` };
        correo = data.user?.email ?? null;
      }
      return armarNuevaVenta(grupoId, ls, correo, pedido.pago);
    });
  }
  return { confirmacion, ventas };
}
