/**
 * Verificación de los videos para el Channel: reglas de lib/videos.ts y permisos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CORRERLO
 *
 *   npm run verificar:videos
 *
 * Lee `.env.pruebas`. La base tiene que tener aplicada la migración
 * 20261108050000_videos_channel.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ ESCRIBE EN LA BASE: crea usuarios, artistas y videos con el prefijo
 * `rlsvideo-` y los borra al terminar. Se niega a correr contra producción.
 */

import { createClient } from "@supabase/supabase-js";
import { frenarSiEsProduccion } from "./freno-produccion.mjs";
import {
  aJsonChannel, errorTags, idDeYoutube, normalizarSpotifyArtista, normalizarTags, textoArtista, urlDeYoutube,
} from "../lib/videos.ts";

frenarSiEsProduccion();

const URL_BASE    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ANON_KEY || !SERVICE_KEY) {
  console.error("Faltan variables de entorno. Corre con: npm run verificar:videos");
  process.exit(1);
}

const FAMILIA = "rlsvideo-";
const PREFIJO = `${FAMILIA}${Date.now()}`;
const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(URL_BASE, SERVICE_KEY, opciones);
const anon  = createClient(URL_BASE, ANON_KEY, opciones);

const resultados = [];
function check(caso, ok, detalle) {
  resultados.push({ caso, ok });
  console.log(`  ${ok ? "✓" : "✗"} ${caso}`);
  if (!ok && detalle) console.log(`      ${detalle}`);
}
const fmt = (error) => (error ? `${error.code}: ${error.message}` : "sin error");
const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const idFalso = () => Array.from(crypto.getRandomValues(new Uint8Array(11)), (b) => ALFABETO[b % 64]).join("");

// ── Escenario ────────────────────────────────────────────────────────────────

async function crearUsuario(sufijo, rol, nombre = `Video ${sufijo}`) {
  const email = `${PREFIJO}-${sufijo}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Usuario ${sufijo}: ${error.message}`);
  const userId = data.user.id;
  await admin.from("user_roles").delete().eq("user_id", userId);
  const { error: rolError } = await admin.from("user_roles").insert({ user_id: userId, role: rol });
  if (rolError) throw new Error(`Rol ${sufijo}: ${rolError.message}`);
  let artistaId = null;
  if (rol === "artista") {
    const { data: a, error: e } = await admin.from("artistas")
      .insert({ user_id: userId, nombre, slug: `${PREFIJO}-${sufijo}`, ciudad: "Valparaíso", redes: { spotify: "https://open.spotify.com/intl-es/artist/7xUuAVqoc6B9aITQZaU8HK?si=abc" }, generos: ["Cumbia", "Rock"] })
      .select("id").single();
    if (e) throw new Error(`Artista ${sufijo}: ${e.message}`);
    artistaId = a.id;
  }
  const cliente = createClient(URL_BASE, ANON_KEY, opciones);
  const { error: loginError } = await cliente.auth.signInWithPassword({ email, password });
  if (loginError) throw new Error(`Login ${sufijo}: ${loginError.message}`);
  return { cliente, artistaId, userId, email, password, nombre };
}

const base = (artistaId, extra = {}) => ({
  artista_id: artistaId,
  youtube_id: idFalso(),
  tracktitle: "Canción de prueba",
  ubicacion: "Valparaíso",
  tags: ["Trap", "Hip hop"],
  derechos_declarados: true,
  ...extra,
});

async function limpiar() {
  const { data: arts } = await admin.from("artistas").select("id").like("slug", `${FAMILIA}%`);
  const ids = (arts ?? []).map((a) => a.id);
  if (ids.length) {
    await admin.from("videos_channel").delete().in("artista_id", ids);
    await admin.from("artistas").delete().in("id", ids);
  }
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of users.filter((x) => x.email?.startsWith(FAMILIA))) {
    await admin.from("user_roles").delete().eq("user_id", u.id);
    await admin.auth.admin.deleteUser(u.id);
  }
}

// ── Reglas (lib/videos.ts) ───────────────────────────────────────────────────

function reglas() {
  console.log("\n── Reglas de lib/videos.ts ──");
  const ID = "zbrxKb675To";
  const formas = [
    `https://www.youtube.com/watch?v=${ID}`, `https://youtube.com/watch?v=${ID}&t=42s`, `youtube.com/watch?feature=share&v=${ID}`,
    `https://youtu.be/${ID}?si=xyz`, `https://m.youtube.com/watch?v=${ID}`, `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/shorts/${ID}`, `https://music.youtube.com/watch?v=${ID}`, `  https://www.youtube.com/watch?v=${ID}  `,
  ];
  const malas = [
    `https://notyoutube.com/watch?v=${ID}`, `https://vimeo.com/123456`, `https://www.youtube.com/watch?v=corto`,
    `https://www.youtube.com/@canal`, "no es un link", `ftp://youtube.com/watch?v=${ID}`,
  ];
  check("(l1) Links de YouTube: todas las formas dan el mismo id; otros dominios e ids malos, null",
    formas.every((f) => idDeYoutube(f) === ID) && malas.every((f) => idDeYoutube(f) === null) && urlDeYoutube(ID) === `https://www.youtube.com/watch?v=${ID}`,
    JSON.stringify([...formas, ...malas].map((f) => [f, idDeYoutube(f)])));

  const sp = [
    ["https://open.spotify.com/intl-es/artist/7xUuAVqoc6B9aITQZaU8HK?si=KByhc2wuQCy7", "https://open.spotify.com/intl-es/artist/7xUuAVqoc6B9aITQZaU8HK"],
    ["https://open.spotify.com/artist/7xUuAVqoc6B9aITQZaU8HK/", "https://open.spotify.com/artist/7xUuAVqoc6B9aITQZaU8HK"],
    ["  ", null], [null, null],
    ["https://open.spotify.com/track/7xUuAVqoc6B9aITQZaU8HK", "invalido"],
    ["http://open.spotify.com/artist/7xUuAVqoc6B9aITQZaU8HK", "invalido"],
    ["https://spotify.com/artist/7xUuAVqoc6B9aITQZaU8HK", "invalido"],
  ];
  check("(l2) Spotify: artista con o sin intl, sin ?si=; vacío null; track u otro dominio, inválido",
    sp.every(([e, s]) => normalizarSpotifyArtista(e) === s), JSON.stringify(sp.map(([e]) => normalizarSpotifyArtista(e))));

  const t = normalizarTags(" Trap , trap,  Hip   hop ,, ,Cumbia ");
  const t2 = normalizarTags(["Rock, pop", "ROCK", " Indie "]);
  check("(l3) Tags: trim, espacios internos, sin vacíos ni repetidos sin distinguir mayúsculas",
    JSON.stringify(t) === '["Trap","Hip hop","Cumbia"]' && JSON.stringify(t2) === '["Rock","pop","Indie"]', JSON.stringify([t, t2]));
  check("(l4) Tags: más de 5 o de más de 30 caracteres → error; 5 de 30, bien",
    !!errorTags(["a", "b", "c", "d", "e", "f"]) && !!errorTags(["x".repeat(31)]) && errorTags(["a", "b", "c", "d", "x".repeat(30)]) === null);

  const fila = aJsonChannel({ tracktitle: "Miumiu", artista_nombre: "Tu Gata Favo", colaboracion: "R$ Moneysign",
    artist_link: "https://open.spotify.com/intl-es/artist/7xUuAVqoc6B9aITQZaU8HK", ubicacion: "Santiago de Chile", youtube_id: ID, tags: ["Trap", "Hip hop"] });
  const esperado = {
    tracktitle: "Miumiu", trackLink: "", album: "", albumLink: "", artist: "Tu Gata Favo Ft. R$ Moneysign",
    artistLink: "https://open.spotify.com/intl-es/artist/7xUuAVqoc6B9aITQZaU8HK", ubicacion: "Santiago de Chile",
    labelLink: "", publisher: "", videourl: "https://www.youtube.com/watch?v=zbrxKb675To", videotype: "video/youtube", tags: ["Trap", "Hip hop"],
  };
  check("(l5) aJsonChannel: el formato exacto del Import JSON, con las claves en el mismo orden", JSON.stringify(fila) === JSON.stringify(esperado), JSON.stringify(fila));
  check("(l6) Sin colaboración ni Spotify: artist es el nombre y artistLink va vacío",
    aJsonChannel({ ...fila, tracktitle: "x", artista_nombre: " Solo ", colaboracion: null, artist_link: null, youtube_id: ID, tags: [] }).artist === "Solo"
      && aJsonChannel({ tracktitle: "x", artista_nombre: "Solo", colaboracion: "  ", artist_link: null, ubicacion: "x", youtube_id: ID, tags: [] }).artistLink === ""
      && textoArtista("A", "B") === "A Ft. B");
}

// ── Base: permisos ───────────────────────────────────────────────────────────

async function base_(A, B, ADM) {
  console.log("\n── Permisos de videos_channel ──");
  {
    const { error } = await A.cliente.from("videos_channel").insert(base(A.artistaId));
    const { count } = await admin.from("videos_channel").select("id", { count: "exact", head: true }).eq("artista_id", A.artistaId);
    check("(v1) El artista envía un video propio → permitido", !error && count === 1, fmt(error));
  }
  {
    const { error } = await A.cliente.from("videos_channel").insert(base(A.artistaId)).select("id").single();
    check("(v2) Pedir la fila de vuelta al enviar → rechazado (el artista no lee la tabla)", error?.code === "42501", fmt(error));
  }
  for (const [caso, extra] of [
    ["(v3) id propio", { id: crypto.randomUUID() }],
    ["(v4) created_at propio", { created_at: "2020-01-01T00:00:00Z" }],
  ]) {
    const { error } = await A.cliente.from("videos_channel").insert(base(A.artistaId, extra));
    check(`${caso} al enviar → rechazado (columnas que pone la base)`, error?.code === "42501", fmt(error));
  }
  {
    const { error } = await A.cliente.from("videos_channel").insert(base(B.artistaId));
    check("(v5) A nombre de otro artista → rechazado", error?.code === "42501", fmt(error));
    const { error: e2 } = await anon.from("videos_channel").insert(base(A.artistaId));
    check("(v6) Sin sesión → rechazado", !!e2, fmt(e2));
    const { error: e3 } = await ADM.cliente.from("videos_channel").insert(base(A.artistaId));
    check("(v7) Un admin sin perfil de artista tampoco envía a nombre de otro", e3?.code === "42501", fmt(e3));
  }
  for (const [caso, extra] of [
    ["(v8) sin la casilla de derechos", { derechos_declarados: false }],
    ["(v9) id de YouTube malo", { youtube_id: "corto" }],
    ["(v10) géneros repetidos sin distinguir mayúsculas", { tags: ["Trap", "trap"] }],
    ["(v11) más de 5 géneros", { tags: ["a", "b", "c", "d", "e", "f"] }],
    ["(v12) género de 31 caracteres", { tags: ["x".repeat(31)] }],
    ["(v13) género con espacios sobrantes", { tags: [" Trap"] }],
    ["(v14) género vacío", { tags: [""] }],
    ["(v15) Spotify que no es artista", { artist_link: "https://open.spotify.com/track/7xUuAVqoc6B9aITQZaU8HK" }],
    ["(v16) Spotify con ?si=", { artist_link: "https://open.spotify.com/artist/7xUuAVqoc6B9aITQZaU8HK?si=x" }],
    ["(v17) título vacío", { tracktitle: "  " }],
    ["(v18) ciudad con espacios sobrantes", { ubicacion: " Valparaíso" }],
  ]) {
    const { error } = await A.cliente.from("videos_channel").insert(base(A.artistaId, extra));
    check(`${caso} → rechazado por la base`, error?.code === "23514", fmt(error));
  }
  {
    const { error } = await A.cliente.from("videos_channel").insert(base(A.artistaId, {
      artist_link: "https://open.spotify.com/intl-es/artist/7xUuAVqoc6B9aITQZaU8HK", colaboracion: "R$ Moneysign", tags: [] }));
    check("(v19) Con colaboración, Spotify intl y sin géneros → permitido", !error, fmt(error));
  }
  const { data: deA } = await admin.from("videos_channel").select("id").eq("artista_id", A.artistaId).limit(1).single();
  {
    const { data: propios, error } = await A.cliente.from("videos_channel").select("id").eq("artista_id", A.artistaId);
    const { data: deOtros } = await B.cliente.from("videos_channel").select("id");
    const { error: eAnon } = await anon.from("videos_channel").select("id").limit(1);
    const { data: todos, error: eAdm } = await ADM.cliente.from("videos_channel").select("id, artistas(nombre)").eq("artista_id", A.artistaId);
    check("(v20) Solo el admin lee la lista (con el nombre del artista); el artista no ve ni los suyos; sin sesión, nada",
      !error && (propios ?? []).length === 0 && (deOtros ?? []).length === 0 && !!eAnon && !eAdm && todos?.length === 2 && todos[0].artistas?.nombre === "Los Videos",
      `propios=${propios?.length} B=${deOtros?.length} anon=${fmt(eAnon)} admin=${todos?.length} ${fmt(eAdm)}`);
  }
  {
    const { error } = await A.cliente.from("videos_channel").update({ tracktitle: "Cambiado" }).eq("id", deA.id);
    const { error: e2 } = await ADM.cliente.from("videos_channel").update({ tracktitle: "Cambiado" }).eq("id", deA.id);
    check("(v21) Nadie edita desde el navegador (artista ni admin)", error?.code === "42501" && e2?.code === "42501", `${fmt(error)} · ${fmt(e2)}`);
    await A.cliente.from("videos_channel").delete().eq("id", deA.id);
    await ADM.cliente.from("videos_channel").delete().eq("id", deA.id);
    const { data: sigue } = await admin.from("videos_channel").select("id").eq("id", deA.id).maybeSingle();
    check("(v22) Nadie borra desde el navegador", !!sigue);
  }
  {
    const T = await crearUsuario("t", "artista");
    await admin.from("videos_channel").insert(base(T.artistaId));
    await admin.from("artistas").delete().eq("id", T.artistaId);
    const { count } = await admin.from("videos_channel").select("id", { count: "exact", head: true }).eq("artista_id", T.artistaId);
    check("(v23) Al borrar el artista se borran sus videos", count === 0, `quedan ${count}`);
  }
}

// ── Principal ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Base: ${new URL(URL_BASE).host}`);
  await limpiar();
  try {
    reglas();
    const A = await crearUsuario("a", "artista", "Los Videos");
    const B = await crearUsuario("b", "artista");
    const ADM = await crearUsuario("adm", "admin");
    await base_(A, B, ADM);
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    resultados.push({ caso: "ejecución", ok: false });
  } finally {
    await limpiar();
  }
  const fallidos = resultados.filter((r) => !r.ok);
  console.log(`\nResultado: ${resultados.length - fallidos.length}/${resultados.length} casos OK`);
  if (fallidos.length) {
    for (const f of fallidos) console.log(`  ✗ ${f.caso}`);
    process.exit(1);
  }
}

main();
