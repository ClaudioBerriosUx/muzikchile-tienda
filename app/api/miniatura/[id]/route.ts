import { NextRequest, NextResponse } from "next/server";

/**
 * Miniatura de un video de YouTube servida desde nuestro dominio.
 *
 * Antes el navegador la pedía directo a img.youtube.com, y así Google recibía
 * la visita (IP incluida) sin consentimiento. Ahora la pide el servidor; el
 * CDN de Vercel la guarda (s-maxage), así que YouTube casi no recibe pedidos y
 * nunca ve al visitante.
 *
 * `?hq=1` pide hqdefault (la que siempre existe). Sin él se intenta
 * maxresdefault y, si el video no la tiene, se cae a hqdefault acá mismo.
 */

const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;
const CACHE = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400";

async function traer(id: string, calidad: "maxresdefault" | "hqdefault") {
  const res = await fetch(`https://img.youtube.com/vi/${id}/${calidad}.jpg`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) return null;
  return res;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_YOUTUBE.test(id)) return new NextResponse(null, { status: 400 });

  try {
    const soloHq = req.nextUrl.searchParams.get("hq") === "1";
    const res = (!soloHq && (await traer(id, "maxresdefault"))) || (await traer(id, "hqdefault"));
    if (!res) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, s-maxage=3600" } });

    return new NextResponse(res.body, {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": CACHE,
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
