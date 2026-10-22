/**
 * Cifras reales del Channel para la bienvenida de la portada: artistas
 * distintos, ciudades distintas y videos activos.
 *
 * Solo servidor: la consulta corre al renderizar la portada y se cachea con
 * `revalidate`, igual que la página (ISR de 5 min). Si algo falla, devuelve
 * `null` y la portada NO muestra cifras: nunca un número inventado.
 *
 * Los videos viven en el Supabase del CHANNEL (otro proyecto); se leen por REST
 * con su anon key pública, como en `VideosDestacados`.
 */

const CHANNEL_URL = process.env.NEXT_PUBLIC_CHANNEL_SUPABASE_URL;
const CHANNEL_KEY = process.env.NEXT_PUBLIC_CHANNEL_SUPABASE_ANON_KEY;

/** Igual que `revalidate` de la portada. */
const REVALIDAR = 300;

export interface CifrasChannel {
  artistas: number;
  ciudades: number;
  videos: number;
}

// ── Ubicaciones ──────────────────────────────────────────────────────────────

/** Sin tildes, minúsculas, espacios colapsados: "Viña del mar" = "Viña del Mar". */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let previo = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const actual = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, previo + (a[i - 1] === b[j - 1] ? 0 : 1));
      previo = actual;
    }
  }
  return fila[b.length];
}

/**
 * Cuenta ciudades distintas a partir de `videos.ubicacion`, que es texto libre
 * y viene sucio ("Santiafo de Chile", "antiago de Chile", "Viña del mar").
 *
 *   1. Se normaliza (tildes, mayúsculas, espacios).
 *   2. Se descartan vacíos y regiones ("Región Metropolitana"): no son ciudades.
 *   3. Errores de tipeo: de la más usada a la menos, cada ubicación se une a
 *      una ya contada si está a ≤2 letras de distancia (y no es un nombre
 *      corto, donde 2 letras ya cambian la ciudad).
 *
 * No descarta lugares del extranjero ni valores raros que no se pueden
 * distinguir con una regla: eso se arregla en los datos del Channel.
 */
export function contarCiudades(ubicaciones: (string | null)[]): number {
  const frecuencia = new Map<string, number>();
  for (const u of ubicaciones) {
    const n = normalizar(u ?? "");
    if (!n || n.startsWith("region ")) continue;
    frecuencia.set(n, (frecuencia.get(n) ?? 0) + 1);
  }

  const canonicas: string[] = [];
  const porFrecuencia = [...frecuencia.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  for (const n of porFrecuencia) {
    const esVariante = canonicas.some((c) => Math.min(c.length, n.length) >= 6 && distancia(c, n) <= 2);
    if (!esVariante) canonicas.push(n);
  }
  return canonicas.length;
}

// ── Consulta ─────────────────────────────────────────────────────────────────

export async function traerCifrasChannel(): Promise<CifrasChannel | null> {
  if (!CHANNEL_URL || !CHANNEL_KEY) return null;

  try {
    const params = new URLSearchParams({ select: "artist,ubicacion", estado: "eq.active" });
    const res = await fetch(`${CHANNEL_URL}/rest/v1/videos?${params}`, {
      headers: { apikey: CHANNEL_KEY, Authorization: `Bearer ${CHANNEL_KEY}` },
      next: { revalidate: REVALIDAR },
    });
    if (!res.ok) return null;

    const filas: { artist: string | null; ubicacion: string | null }[] = await res.json();
    if (!Array.isArray(filas) || filas.length === 0) return null;

    const artistas = new Set(filas.map((f) => normalizar(f.artist ?? "")).filter(Boolean));
    return {
      artistas: artistas.size,
      ciudades: contarCiudades(filas.map((f) => f.ubicacion)),
      videos: filas.length,
    };
  } catch {
    return null;
  }
}

/**
 * "240+" como el diseño: hacia abajo a la decena, para que la cifra nunca
 * prometa de más. Bajo 10 va exacta.
 */
export function formatearCifra(n: number): string {
  if (n < 10) return String(n);
  return `${Math.floor(n / 10) * 10}+`;
}
