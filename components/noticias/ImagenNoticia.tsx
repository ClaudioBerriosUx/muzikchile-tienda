"use client";

import { useState } from "react";
import Image from "next/image";
import { Newspaper } from "lucide-react";

/**
 * Imagen de noticia en formato Instagram 4:5 (1080×1350), compartida por la
 * portada y el feed /noticias para que el formato viva en un solo lugar.
 *
 * El contenedor fija la proporción 4:5 y nunca cambia de tamaño: no hay salto
 * de layout, sea cual sea la imagen.
 *
 * - **Vertical o 4:5** → llena el marco recortando al centro (`object-cover`).
 * - **Más ancha que 4:5** → se muestra completa (`object-contain`) sobre una
 *   capa de fondo con la misma imagen en `object-cover`, desenfocada y
 *   oscurecida, para que no queden barras vacías (estilo Instagram). Sin esto,
 *   un afiche 16:9 perdía más de la mitad del ancho: el título de Santiago
 *   Horror quedaba cortado.
 *
 * La proporción solo se conoce al cargar, así que la imagen arranca invisible y
 * aparece con un fundido una vez decidido el modo: así no se ve un cuadro
 * recortado que salta a completo. `next/image` dispara `onLoad` también si la
 * imagen terminó de cargar antes de hidratar (revisa `img.complete`).
 *
 * La capa de fondo usa el mismo `src` y los mismos `sizes`, así que el navegador
 * resuelve la misma URL del optimizador y la descarga una sola vez.
 *
 * Sin imagen se pinta un placeholder del mismo tamaño.
 *
 * El zoom en hover depende de que algún ancestro tenga la clase `group`.
 *
 * ⚠️ Solo para tarjetas. El og:image de /noticias/[slug] sigue usando la imagen
 * original: las redes la muestran horizontal.
 */

/** 4:5 = 0.8. Un margen chico evita tratar como "ancha" una 1080×1340. */
const UMBRAL_ANCHA = 0.82;

type Modo = "cargando" | "cover" | "contain";

export default function ImagenNoticia({
  src,
  alt,
  sizes,
}: {
  src: string | null;
  alt: string;
  /** Ancho real que ocupa la imagen por breakpoint; ver cada grilla. */
  sizes: string;
}) {
  const [modo, setModo] = useState<Modo>("cargando");

  const alCargar = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setModo(h > 0 && w / h > UMBRAL_ANCHA ? "contain" : "cover");
  };

  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: "4 / 5", backgroundColor: "#141414" }}>
      {src ? (
        // El zoom va en este envoltorio para que fondo e imagen escalen juntos.
        <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-105">
          {modo === "contain" && (
            <Image
              src={src}
              alt=""
              aria-hidden
              fill
              sizes={sizes}
              className="object-cover object-center"
              // scale tapa el borde translúcido que deja el blur en los cantos.
              style={{ filter: "blur(24px) brightness(0.5)", transform: "scale(1.15)" }}
            />
          )}
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            onLoad={alCargar}
            className={`object-center transition-opacity duration-300 ${
              modo === "contain" ? "object-contain" : "object-cover"
            }`}
            style={{ opacity: modo === "cargando" ? 0 : 1 }}
          />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <Newspaper size={36} style={{ color: "#2a2a2a" }} />
        </div>
      )}
    </div>
  );
}
