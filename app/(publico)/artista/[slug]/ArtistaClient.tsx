"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MapPin, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { etiquetaCategoria } from "@/lib/publicaciones";
import { fechaCorta, type NoticiaLista } from "@/lib/noticias";
import TarjetaProducto from "@/components/tienda/TarjetaProducto";
import SelloVerificado from "@/components/tienda/SelloVerificado";
import ImagenNoticia from "@/components/noticias/ImagenNoticia";

interface RedesSociales {
  instagram?: string;
  spotify?: string;
  youtube?: string;
  tiktok?: string;
  facebook?: string;
  soundcloud?: string;
  [key: string]: string | undefined;
}

interface Artista {
  id: string;
  nombre: string;
  slug: string;
  ciudad?: string;
  region?: string;
  color_acento?: string;
  foto_url?: string;
  bio?: string;
  bio_completa?: string;
  redes?: RedesSociales;
  verificado?: boolean;
  generos?: string[] | null;
}

interface Producto {
  id: string;
  nombre: string;
  precio: number;
  imagenes: string[];
  tipo: string;
  artista_id: string;
  categorias?: { nombre: string; slug: string };
}

function buildSocialUrl(red: string, value: string): string {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  const cleaned = value.replace(/^@/, "");
  const bases: Record<string, string> = {
    instagram: "https://instagram.com/",
    tiktok: "https://tiktok.com/@",
  };
  return bases[red] ? bases[red] + cleaned : value;
}

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tema-azul-texto";
const TITULO = { fontFamily: "var(--font-titulo)" } as const;

/** Bio más larga que esto se recorta a 3 líneas con "Leer más". */
const BIO_LARGA = 220;

// ── Redes ────────────────────────────────────────────────────────────────────

const NOMBRE_RED: Record<string, string> = {
  instagram: "Instagram", spotify: "Spotify", youtube: "YouTube",
  tiktok: "TikTok", facebook: "Facebook", soundcloud: "SoundCloud",
};

function IconoRed({ red }: { red: string }) {
  const p = {
    width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true,
  };
  switch (red) {
    case "instagram":
      return <svg {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.8" /><circle cx="17" cy="7" r="0.9" fill="currentColor" /></svg>;
    case "spotify":
      return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M7.5 9.6c3-.8 6.4-.5 9 1" /><path d="M8 12.8c2.5-.7 5.2-.4 7.4.9" /><path d="M8.6 15.8c2-.5 4-.3 5.8.7" /></svg>;
    case "youtube":
      return <svg {...p}><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><polygon points="10 9.2 15 12 10 14.8" fill="currentColor" /></svg>;
    case "tiktok":
      return <svg {...p}><path d="M14 4v10.2a3.6 3.6 0 1 1-3.6-3.6" /><path d="M14 4c.4 2.4 1.9 3.9 4.2 4.1" /></svg>;
    case "soundcloud":
      return <svg {...p}><path d="M3 14v3M6 12v5M9 10v7" /><path d="M12 17V8.6a5 5 0 0 1 9 2.9c0 2.9-1.8 5.5-4.5 5.5H12z" /></svg>;
    case "facebook":
      return <svg {...p}><path d="M14.5 8H16V4.5h-2.2C11.6 4.5 10.5 6 10.5 8.2V10H8v3.5h2.5v6h3.5v-6h2.4l.6-3.5h-3V8.6c0-.4.2-.6.5-.6z" /></svg>;
    default:
      return <span className="text-[11px] font-bold uppercase">{red.slice(0, 2)}</span>;
  }
}

// ── Pestañas ─────────────────────────────────────────────────────────────────

type Tab = "productos" | "noticias" | "sobre";
const TABS: Tab[] = ["productos", "noticias", "sobre"];

/** Color del pill de categoría de una noticia, como en el diseño. */
function claseCategoria(categoria: string | null): string {
  if (categoria === "lanzamiento") return "bg-tema-azul";
  if (categoria === "show") return "bg-tema-rojo";
  return "bg-tema-hover border border-tema-borde-campo";
}

function EstadoVacio({ icono, titulo, texto, children }: {
  icono: React.ReactNode; titulo: string; texto: string; children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-xl border border-dashed border-tema-borde-campo bg-[#1B1B1B] px-5 py-10 text-center md:px-6 md:py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-tema-borde-campo text-tema-texto-2">{icono}</div>
      <h2 className="m-0 text-[28px] uppercase leading-[1.05] text-tema-texto md:text-[34px]" style={{ ...TITULO, textWrap: "balance" }}>
        {titulo}
      </h2>
      <p className="m-0 max-w-[460px] text-base leading-[1.65] text-tema-texto-2" style={{ textWrap: "pretty" }}>{texto}</p>
      {children}
    </div>
  );
}

export default function ArtistaClient({ slug, noticias }: { slug: string; noticias: NoticiaLista[] }) {
  const supabase = createClient();
  const [tabActivo, setTabActivo] = useState<Tab>("productos");
  const [bioAbierta, setBioAbierta] = useState(false);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const { data: artista, isLoading } = useQuery({
    queryKey: ["artista", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artistas")
        .select("id, nombre, slug, ciudad, region, color_acento, foto_url, bio, bio_completa, redes, verificado, generos")
        .eq("slug", slug)
        .single();
      if (error) throw error;
      return data as Artista;
    },
    enabled: !!slug,
  });

  const { data: productos = [] } = useQuery({
    queryKey: ["artista-productos", artista?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("*, categorias(nombre)")
        .eq("artista_id", artista!.id)
        .eq("estado", "aprobado");
      if (error) throw error;
      return (data ?? []) as unknown as Producto[];
    },
    enabled: !!artista?.id,
  });

  if (isLoading) {
    return (
      <main className="min-h-screen bg-tema-fondo">
        <div className="h-[140px] animate-pulse border-b border-tema-borde bg-tema-superficie md:h-[300px]" />
        <div className="mx-auto max-w-[1280px] px-5 md:px-10">
          <div className="-mt-12 h-24 w-24 animate-pulse rounded-full border-4 border-tema-fondo bg-tema-hover md:-mt-[72px] md:h-[152px] md:w-[152px]" />
          <div className="mt-6 h-12 w-2/3 animate-pulse rounded bg-tema-superficie" />
        </div>
      </main>
    );
  }

  if (!artista) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-tema-fondo">
        <p className="text-2xl text-tema-texto">Artista no encontrado</p>
      </main>
    );
  }

  const acento  = artista.color_acento ?? "var(--tema-rojo)";
  const inicial = artista.nombre?.[0]?.toUpperCase() ?? "A";
  const generos = artista.generos?.filter(Boolean) ?? [];
  const redes   = Object.entries(artista.redes ?? {}).filter(([, v]) => !!v) as [string, string][];
  const bio     = artista.bio?.trim() ?? "";
  const bioLarga = bio.length > BIO_LARGA;
  const sobre   = artista.bio_completa?.trim() || bio;
  const origen  = [artista.ciudad, artista.region].filter(Boolean).join(", ");
  const datos   = [
    origen && { k: "Origen", v: origen },
    generos.length > 0 && { k: generos.length > 1 ? "Géneros" : "Género", v: generos.join(" · ") },
  ].filter(Boolean) as { k: string; v: string }[];

  const conteo: Record<Tab, number | null> = { productos: productos.length, noticias: noticias.length, sobre: null };
  const etiquetaTab: Record<Tab, string> = { productos: "Productos", noticias: "Noticias", sobre: "Sobre el artista" };

  /** Flechas izquierda/derecha entre pestañas (patrón WAI-ARIA tabs). */
  const onKeyTabs = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = TABS.indexOf(tabActivo);
    const sig = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    setTabActivo(sig);
    tabsRef.current[TABS.indexOf(sig)]?.focus();
  };

  return (
    <main className="min-h-screen bg-tema-fondo text-tema-texto">
      {/* Portada: no hay columna de foto de portada; se usa el color de acento del artista. */}
      <div
        className="relative h-[140px] md:h-[300px]"
        style={{ background: `radial-gradient(120% 140% at 15% 0%, ${acento} 0%, transparent 60%), linear-gradient(135deg, #242424, #161616)` }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to top, #161616 2%, rgba(22,22,22,0.35) 58%, rgba(22,22,22,0.1) 100%)" }} />
      </div>

      <div className="mx-auto max-w-[1280px] px-5 md:px-10">
        {/* Cabecera */}
        <div className="relative -mt-12 grid grid-cols-1 items-end gap-[18px] md:-mt-[72px] md:grid-cols-[152px_minmax(0,1fr)] md:gap-8">
          <div className="relative h-24 w-24 md:h-[152px] md:w-[152px]">
            <div className="h-full w-full overflow-hidden rounded-full border-4 border-tema-fondo bg-tema-superficie">
              {artista.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={artista.foto_url} alt={artista.nombre} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl text-tema-texto md:text-6xl" style={{ ...TITULO, backgroundColor: acento }}>
                  {inicial}
                </div>
              )}
            </div>
            {artista.verificado && <SelloVerificado size={30} className="bottom-0 right-0 md:bottom-1 md:right-1" />}
          </div>

          <div className="flex min-w-0 flex-col gap-3 pb-1">
            <h1 className="m-0 text-[44px] uppercase leading-[0.95] text-tema-texto md:text-[72px]" style={{ ...TITULO, textWrap: "balance" }}>
              {artista.nombre}
            </h1>
            <div className="flex flex-wrap items-center gap-2.5">
              {artista.verificado && (
                <span className="flex items-center gap-1.5 rounded-md bg-tema-azul px-[9px] py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-tema-texto">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  Artista verificado
                </span>
              )}
              {origen && (
                <span className="flex items-center gap-1.5 text-sm text-tema-texto-claro">
                  <MapPin size={14} strokeWidth={2} aria-hidden="true" />
                  {origen}
                </span>
              )}
              {generos.slice(0, 2).map((g) => (
                <span key={g} className="rounded-md border border-tema-borde-campo px-[9px] py-[3px] text-[10px] font-bold uppercase tracking-[0.12em] text-tema-texto-claro">
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bio + redes */}
        {(bio || redes.length > 0) && (
          <div className="grid grid-cols-1 items-start gap-[18px] pt-6 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:gap-8">
            {bio ? (
              <div className="flex min-w-0 flex-col gap-3">
                <p
                  id="bio-artista"
                  className={cn("m-0 text-base leading-[1.75] text-tema-texto-claro", bioLarga && !bioAbierta && "line-clamp-3")}
                  style={{ textWrap: "pretty" }}
                >
                  {bio}
                </p>
                {bioLarga && (
                  <button
                    type="button"
                    onClick={() => setBioAbierta((v) => !v)}
                    aria-expanded={bioAbierta}
                    aria-controls="bio-artista"
                    className={cn("cursor-pointer self-start border-0 bg-transparent py-1.5 text-sm font-bold text-tema-azul-texto hover:text-tema-azul-texto-hover", FOCO)}
                  >
                    {bioAbierta ? "Leer menos" : "Leer más"}
                  </button>
                )}
              </div>
            ) : <div />}

            {redes.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em] text-tema-texto-3">Escúchalo y síguelo</p>
                <div className="flex flex-wrap gap-2">
                  {redes.map(([red, valor]) => {
                    const nombre = NOMBRE_RED[red] ?? red;
                    return (
                      <a
                        key={red}
                        href={buildSocialUrl(red, valor)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${nombre} de ${artista.nombre} (abre en otra pestaña)`}
                        title={nombre}
                        className={cn("flex h-11 w-11 items-center justify-center rounded-[10px] border border-tema-borde-campo bg-tema-campo text-tema-texto hover:border-tema-azul-texto hover:text-tema-azul-etiqueta", FOCO)}
                      >
                        <IconoRed red={red} />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pestañas */}
        <div
          role="tablist"
          aria-label={`Contenido de ${artista.nombre}`}
          onKeyDown={onKeyTabs}
          className="mt-8 flex gap-[22px] overflow-x-auto border-b border-tema-borde md:mt-12 md:gap-9 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((t, i) => {
            const activo = t === tabActivo;
            return (
              <button
                key={t}
                ref={(el) => { tabsRef.current[i] = el; }}
                type="button"
                role="tab"
                id={`tab-${t}`}
                aria-selected={activo}
                aria-controls={`panel-${t}`}
                aria-label={conteo[t] !== null ? `${etiquetaTab[t]} (${conteo[t]})` : etiquetaTab[t]}
                tabIndex={activo ? 0 : -1}
                onClick={() => setTabActivo(t)}
                className={cn(
                  "-mb-px flex shrink-0 cursor-pointer items-center gap-[9px] border-0 border-b-[3px] bg-transparent px-1 py-3.5 text-[15px] font-bold",
                  activo ? "border-tema-rojo text-tema-texto" : "border-transparent text-tema-texto-2 hover:text-tema-texto",
                  FOCO
                )}
              >
                {t === "sobre" ? (
                  <span>Sobre<span className="hidden sm:inline"> el artista</span></span>
                ) : etiquetaTab[t]}
                {conteo[t] !== null && (
                  <span className="flex h-5 min-w-[22px] items-center justify-center rounded-[10px] border border-tema-borde-campo bg-tema-hover px-1.5 text-[11px] font-normal text-tema-texto-claro">
                    {conteo[t]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id={`panel-${tabActivo}`} aria-labelledby={`tab-${tabActivo}`} className="pb-12 pt-7 md:pb-20">
          {tabActivo === "productos" && (
            productos.length === 0 ? (
              <EstadoVacio
                icono={<ShoppingBag size={28} strokeWidth={1.6} aria-hidden="true" />}
                titulo={`${artista.nombre} aún no abre su tienda`}
                texto={noticias.length > 0
                  ? "Mientras tanto, entérate de sus próximos shows y lanzamientos en las noticias."
                  : "Mientras tanto, escucha su música en sus redes."}
              >
                {noticias.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTabActivo("noticias")}
                    className={cn("flex h-12 cursor-pointer items-center gap-2.5 rounded-[10px] border-0 bg-tema-azul px-[22px] text-[15px] font-bold text-tema-texto hover:brightness-110", FOCO)}
                  >
                    Ver noticias de {artista.nombre}
                  </button>
                )}
              </EstadoVacio>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
                {productos.map((p) => (
                  <TarjetaProducto
                    key={p.id}
                    id={p.id}
                    nombre={p.nombre}
                    precio={p.precio}
                    imagen={p.imagenes?.[0]}
                    tipo={p.tipo}
                    categoria={p.categorias?.nombre}
                    artista={artista.nombre}
                    ciudad={artista.ciudad}
                  />
                ))}
              </div>
            )
          )}

          {tabActivo === "noticias" && (
            noticias.length === 0 ? (
              <EstadoVacio
                icono={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h13v14H6a2 2 0 0 1-2-2z" /><path d="M17 9h3v8a2 2 0 0 1-2 2" /><line x1="7.5" y1="9" x2="13.5" y2="9" /><line x1="7.5" y1="12.5" x2="13.5" y2="12.5" /></svg>}
                titulo="Todavía no hay noticias"
                texto={`Cuando ${artista.nombre} publique lanzamientos o fechas, van a aparecer acá.`}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6">
                {noticias.map((n) => (
                  <Link
                    key={n.id}
                    href={`/noticias/${n.slug}`}
                    className={cn("group grid grid-cols-[110px_minmax(0,1fr)] overflow-hidden rounded-xl border border-tema-borde bg-tema-campo text-inherit no-underline hover:border-tema-borde-campo md:grid-cols-[160px_minmax(0,1fr)]", FOCO)}
                  >
                    <ImagenNoticia src={n.imagen_url} alt="" sizes="(min-width: 768px) 160px, 110px" />
                    <div className="flex min-w-0 flex-col justify-center gap-2.5 px-[18px] py-4">
                      <div className="flex flex-wrap items-center gap-[9px]">
                        {n.categoria && (
                          <span className={cn("rounded-[5px] px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.14em] text-tema-texto", claseCategoria(n.categoria))}>
                            {etiquetaCategoria(n.categoria)}
                          </span>
                        )}
                        <span className="text-xs text-tema-texto-3">{fechaCorta(n.fecha_publicacion)}</span>
                      </div>
                      <h3 className="m-0 text-lg uppercase leading-[1.08] text-tema-texto group-hover:text-tema-azul-texto-hover md:text-2xl" style={{ ...TITULO, textWrap: "balance" }}>
                        {n.titular}
                      </h3>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}

          {tabActivo === "sobre" && (
            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-6">
              <div className="flex flex-col gap-3.5">
                <h2 className="m-0 text-[28px] uppercase leading-none text-tema-texto md:text-[34px]" style={TITULO}>
                  Sobre {artista.nombre}
                </h2>
                <p className="m-0 whitespace-pre-line text-base leading-[1.75] text-tema-texto-claro" style={{ textWrap: "pretty" }}>
                  {sobre || "Sin información adicional."}
                </p>
              </div>
              {datos.length > 0 && (
                <dl className="m-0 rounded-xl border border-tema-borde bg-tema-campo px-5 py-1.5">
                  {datos.map((d, i) => (
                    <div key={d.k} className={cn("flex justify-between gap-4 py-3.5 text-sm", i < datos.length - 1 && "border-b border-tema-borde")}>
                      <dt className="text-tema-texto-3">{d.k}</dt>
                      <dd className="m-0 text-right font-medium text-tema-texto">{d.v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
