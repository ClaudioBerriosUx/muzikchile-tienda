import { VERSION_TERMINOS_COMPRADORES } from "@/lib/terminos";

/**
 * Términos y condiciones para compradores. Fuente única del texto: la usan la
 * página /terminos y el correo de confirmación de compra (art. 12 A de la Ley
 * 19.496), que lleva copia íntegra de la versión aceptada.
 *
 * Si el texto cambia, sube VERSION_TERMINOS_COMPRADORES en lib/terminos.ts y
 * ACTUALIZADO acá. Cada orden guarda la versión que aceptó el comprador.
 *
 * Los párrafos son texto plano. {correo} y {privacidad} se reemplazan al
 * mostrarlos: enlaces en la página, texto en el correo.
 *
 * Enfoque (decisión de Claudio, 2026-11-08): retractos, garantías y reclamos
 * van primero al artista vendedor, a su correo de contacto, y el artista
 * reembolsa desde su cuenta de Mercado Pago. MuzikChile es el respaldo si el
 * artista no responde en 5 días hábiles.
 *
 * Dudas para el abogado (también en su documento): si el envío de vuelta en un
 * retracto se puede trasladar al comprador, el plazo de 6 meses de la garantía
 * legal, la responsabilidad de la plataforma como intermediaria (art. 43) y si
 * el paso previo de 5 días hábiles es compatible con el retracto.
 */

export const ACTUALIZADO_TERMINOS_COMPRADORES = "8 de noviembre de 2026";

export interface SeccionTerminos {
  id: string;
  titulo: string;
  parrafos: string[];
}

export const AVISO_PILOTO_COMPRADORES =
  `Programa piloto (marcha blanca) · Versión ${VERSION_TERMINOS_COMPRADORES}. MuzikChile está en marcha blanca con un ` +
  "grupo reducido de artistas. Estos términos rigen las compras hechas durante el piloto. Si cambian, publicamos " +
  "la nueva versión con su fecha; cada compra se rige por la versión vigente al pagar, que va en tu correo de " +
  "confirmación.";

export const SECCIONES_TERMINOS_COMPRADORES: SeccionTerminos[] = [
  {
    id: "quien-vende",
    titulo: "1. Quién te vende",
    parrafos: [
      "MuzikChile es una plataforma operada por Claudio Berrios, persona natural, contacto {correo}.",
      "En MuzikChile cada artista vende sus propios productos. El vendedor y proveedor de cada producto es el " +
        "artista que lo publica: su nombre y su correo de contacto aparecen en la ficha, en el checkout y en tu " +
        "correo de confirmación. El artista responde por el producto, su descripción, el despacho, el retracto y la " +
        "garantía legal, y te atiende directamente.",
      "MuzikChile publica las tiendas y conecta el pago con Mercado Pago. Tu pago va a la cuenta de Mercado Pago " +
        "del artista, y si corresponde un reembolso, el artista lo hace desde esa cuenta. MuzikChile no compra, " +
        "vende ni despacha los productos, pero te respalda si el artista no te responde (punto 7).",
    ],
  },
  {
    id: "precios-y-pago",
    titulo: "2. Precios y pago",
    parrafos: [
      "Los precios están en pesos chilenos y son el precio final de cada producto. Si hay envío, su costo se " +
        "muestra aparte antes de pagar. Los cupones de descuento se aplican según sus condiciones y se informan en " +
        "el resumen de tu pedido.",
      "Pagas con Mercado Pago. MuzikChile no recibe ni guarda los datos de tu tarjeta.",
    ],
  },
  {
    id: "confirmacion",
    titulo: "3. Tu compra y su confirmación",
    parrafos: [
      "Para comprar debes aceptar estos términos. La compra queda hecha cuando Mercado Pago aprueba tu pago. Te " +
        "enviamos entonces un correo de confirmación con el número de pedido, el detalle de lo que compraste, el " +
        "vendedor, la forma de entrega y una copia de estos términos. Guárdalo: el número de pedido sirve para " +
        "cualquier consulta.",
    ],
  },
  {
    id: "despacho",
    titulo: "4. Despacho y retiro",
    parrafos: [
      "Cada artista define si despacha, si ofrece retiro, el costo del envío (fijo por pedido, para todo Chile) y " +
        "el plazo de entrega en días hábiles. Ves esas condiciones en la ficha y en el checkout antes de pagar, y " +
        "quedan en tu correo de confirmación. El artista está obligado a cumplirlas.",
      "El plazo se cuenta desde que se aprueba el pago. Si tu pedido no llega dentro del plazo o llega dañado, " +
        "escribe al artista, a su correo de contacto, con tu número de pedido (punto 7).",
      "Si eliges retiro, el artista coordina contigo el retiro por correo, según las indicaciones que viste antes " +
        "de pagar.",
    ],
  },
  {
    id: "retracto",
    titulo: "5. Derecho de retracto",
    parrafos: [
      "Puedes retractarte de tu compra, sin expresar causa, dentro de 10 días desde que recibes el producto " +
        "(art. 3 bis de la Ley 19.496). Si no recibiste la confirmación escrita de tu compra, el plazo es de 90 días.",
      "Para ejercerlo, escribe al artista que te vendió, a su correo de contacto, dentro del plazo y con tu número " +
        "de pedido. Basta con que tu aviso salga dentro del plazo. Debes devolver el producto sin deterioro " +
        "imputable a ti y con su embalaje original. El costo de enviar el producto de vuelta lo asume el artista, " +
        "que te indica cómo devolverlo.",
      "Recibes de vuelta todo lo que pagaste, incluido el envío, lo antes posible y siempre dentro de 45 días " +
        "desde tu aviso, sin retención de gastos. El artista te reembolsa desde su cuenta de Mercado Pago, al medio " +
        "con que pagaste.",
      "Durante el piloto ningún producto está excluido del derecho de retracto.",
    ],
  },
  {
    id: "garantia",
    titulo: "6. Garantía legal",
    parrafos: [
      "Si el producto tiene fallas o defectos, o no corresponde a lo que compraste, puedes elegir entre su " +
        "reparación gratuita, su cambio o la devolución de lo pagado, dentro de 6 meses desde que lo recibes " +
        "(garantía legal, Ley 19.496). El responsable de la garantía es el artista vendedor: escríbele a su correo " +
        "de contacto con tu número de pedido y una foto del problema.",
    ],
  },
  {
    id: "reclamos",
    titulo: "7. Reclamos y contacto",
    parrafos: [
      "Para retractos, garantías, pedidos que no llegan o cualquier reclamo, escribe primero al artista que te " +
        "vendió, a su correo de contacto (está en la ficha del producto, en el checkout y en tu correo de " +
        "confirmación), con tu número de pedido. El artista debe responderte en un máximo de 5 días hábiles.",
      "Si el artista no te responde en ese plazo, o su respuesta no resuelve tu caso, escríbenos a {correo} con tu " +
        "número de pedido. MuzikChile contacta al artista para que cumpla y puede suspender su tienda. Este paso " +
        "no cambia ni alarga los plazos de tus derechos: el plazo de retracto se cumple con tu primer aviso al " +
        "artista.",
      "En cualquier momento puedes recurrir al Servicio Nacional del Consumidor (SERNAC). Nada de este punto " +
        "limita los derechos que la ley te da.",
    ],
  },
  {
    id: "datos",
    titulo: "8. Tus datos",
    parrafos: [
      "Para cumplir tu pedido, el artista recibe tu nombre, tu correo y, si elegiste envío, tu dirección. Solo " +
        "puede usarlos para despachar y responder sobre ese pedido. El resto del tratamiento de tus datos está en " +
        "nuestra {privacidad}.",
    ],
  },
  {
    id: "ley",
    titulo: "9. Ley aplicable",
    parrafos: [
      "Estos términos se rigen por la ley chilena. Nada en ellos limita los derechos que la Ley 19.496 te " +
        "reconoce como consumidor, que son irrenunciables.",
    ],
  },
];

export interface TextoTerminos {
  version: string;
  actualizado: string;
  aviso: string;
  secciones: SeccionTerminos[];
}

/**
 * El texto de una versión, para copiarlo en la confirmación de la compra que
 * la aceptó. Al subir de versión, la anterior se guarda acá con su texto: una
 * orden siempre se confirma con lo que su comprador aceptó. null si no está.
 */
export function terminosCompradores(version: string | null): TextoTerminos | null {
  if (version !== VERSION_TERMINOS_COMPRADORES) return null;
  return {
    version,
    actualizado: ACTUALIZADO_TERMINOS_COMPRADORES,
    aviso: AVISO_PILOTO_COMPRADORES,
    secciones: SECCIONES_TERMINOS_COMPRADORES,
  };
}
