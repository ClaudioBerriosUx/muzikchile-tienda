"use client";

import Link from "next/link";
import { Music, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useCarrito } from "@/lib/stores/carrito";
import { formatCLP } from "@/lib/constants";

interface Props {
  id: string;
  nombre: string;
  precio: number;
  imagenes: string[];
  categoria?: string;
  artista: string;
  ciudad?: string;
  slug_artista: string;
  colorAccento?: string;
}

export default function ProductCard({
  id,
  nombre,
  precio,
  imagenes,
  categoria,
  artista,
  ciudad,
  slug_artista,
  colorAccento = "#111111",
}: Props) {
  const agregar = useCarrito((s) => s.agregar);
  const imagen = imagenes?.[0];

  const handleAgregar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    agregar({
      id,
      nombre,
      precio,
      imagen: imagen || "",
      artista,
    });
    toast.success("Agregado al carrito");
  };

  return (
    <Link href={`/producto/${id}`} className="block group">
      <div
        className="overflow-hidden rounded-lg border border-[#e8e8e8] hover:shadow-md transition-shadow h-full"
        style={{ backgroundColor: "#ffffff" }}
      >
        {/* Imagen */}
        <div className="relative aspect-square overflow-hidden">
          {imagen ? (
            <img
              src={imagen}
              alt={nombre}
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: "#f8f7f5" }}
            >
              <Music className="w-10 h-10 text-[#cccccc]" />
            </div>
          )}

          {/* Badge categoría */}
          {categoria && (
            <span
              className="absolute top-2 left-2 text-white text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: "#111111", fontFamily: "Barlow, sans-serif" }}
            >
              {categoria}
            </span>
          )}

          {/* Botón agregar al carrito */}
          <button
            onClick={handleAgregar}
            className="absolute bottom-0 left-0 right-0 text-white text-sm py-2.5 translate-y-full group-hover:translate-y-0 transition-transform duration-200"
            style={{ backgroundColor: colorAccento, fontFamily: "Barlow, sans-serif" }}
          >
            Agregar al carrito
          </button>
        </div>

        {/* Info */}
        <div className="p-3">
          <p
            className="text-base font-medium line-clamp-2 text-[#111111]"
            style={{ fontFamily: "Oswald, sans-serif" }}
          >
            {nombre}
          </p>

          <div className="flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3 text-[#999999]" />
            <span
              className="text-xs text-[#666666]"
              style={{ fontFamily: "Barlow, sans-serif" }}
            >
              {artista}{ciudad ? ` · ${ciudad}` : ""}
            </span>
          </div>

          <p
            className="text-lg font-bold mt-2"
            style={{ fontFamily: "DM Sans, sans-serif", color: "#e8003d" }}
          >
            {formatCLP(precio)}
          </p>
        </div>
      </div>
    </Link>
  );
}
