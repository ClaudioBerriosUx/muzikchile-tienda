/**
 * Pide al servidor revalidar las páginas públicas de una noticia
 * (`/api/revalidar-noticias`). Para el admin, después de un cambio que se ve en
 * el sitio.
 *
 * Nunca lanza: el cambio ya quedó guardado en la base, y si esto falla las
 * páginas igual se ponen al día con el ISR de 5 minutos. Devuelve false para que
 * el llamador avise que puede tardar.
 */
export async function revalidarNoticias(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/revalidar-noticias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) console.error("[revalidar-noticias] respuesta", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[revalidar-noticias] error de red:", err);
    return false;
  }
}

/** Texto del aviso cuando `revalidarNoticias` devuelve false. */
export const AVISO_SIN_REVALIDAR = "Guardado, pero puede tardar hasta 5 minutos en verse en el sitio.";
