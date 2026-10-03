import Image from "next/image";
import { Newspaper } from "lucide-react";

/**
 * Imagen de noticia en formato Instagram 4:5 (1080×1350), compartida por la
 * portada y el feed /noticias para que el formato viva en un solo lugar.
 *
 * El contenedor fija la proporción y la imagen la llena recortando al centro
 * (`object-cover` + `object-center`): una foto horizontal pierde los costados.
 * Sin imagen se pinta un placeholder del mismo tamaño, así la tarjeta no
 * colapsa ni desalinea la grilla.
 *
 * El zoom en hover depende de que algún ancestro tenga la clase `group`.
 *
 * ⚠️ Solo para tarjetas. El og:image de /noticias/[slug] sigue usando la imagen
 * original: las redes la muestran horizontal.
 */
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
  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: "4 / 5", backgroundColor: "#141414" }}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <Newspaper size={36} style={{ color: "#2a2a2a" }} />
        </div>
      )}
    </div>
  );
}
