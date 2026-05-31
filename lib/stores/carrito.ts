import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ItemCarrito {
  id: string;
  nombre: string;
  precio: number;
  imagen?: string;
  artista?: string;
  cantidad: number;
}

interface CarritoStore {
  items: ItemCarrito[];
  agregar: (producto: Omit<ItemCarrito, "cantidad">) => void;
  remover: (id: string) => void;
  actualizarCantidad: (id: string, cantidad: number) => void;
  limpiar: () => void;
  total: () => number;
  cantidadTotal: () => number;
}

export const useCarrito = create<CarritoStore>()(
  persist(
    (set, get) => ({
      items: [],

      agregar: (producto) => {
        set((state) => {
          const existente = state.items.find((i) => i.id === producto.id);
          if (existente) {
            return {
              items: state.items.map((i) =>
                i.id === producto.id
                  ? { ...i, cantidad: i.cantidad + 1 }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...producto, cantidad: 1 }] };
        });
      },

      remover: (id) => {
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        }));
      },

      actualizarCantidad: (id, cantidad) => {
        if (cantidad <= 0) {
          get().remover(id);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, cantidad } : i
          ),
        }));
      },

      limpiar: () => set({ items: [] }),

      total: () =>
        get().items.reduce((acc, i) => acc + i.precio * i.cantidad, 0),

      cantidadTotal: () =>
        get().items.reduce((acc, i) => acc + i.cantidad, 0),
    }),
    {
      name: "muzikchile-carrito",
    }
  )
);
