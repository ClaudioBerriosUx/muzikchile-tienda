"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

/**
 * Listado de suscriptores al boletín. Solo lectura + exportación a CSV.
 *
 * No hay altas ni ediciones a propósito: las altas entran por el popup, y
 * dar de baja a alguien a mano todavía no tiene flujo definido (habría que
 * decidir si se marca 'inactivo' o se borra). Cuando lo tenga, el RLS ya
 * permite UPDATE y DELETE al admin.
 *
 * Que esta página cargue algo es, además, la prueba viva de que el RLS está
 * bien puesto: con la anon key la misma consulta devuelve `[]`.
 */

/** Derivado del esquema, no escrito a mano: una columna inventada no compila. */
type Suscriptor = Database["public"]["Tables"]["suscriptores"]["Row"];

export default function SuscriptoresPage() {
  const [busqueda, setBusqueda] = useState("");

  const { data: suscriptores = [], isLoading } = useQuery<Suscriptor[]>({
    queryKey: ["admin-suscriptores"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("suscriptores")
        .select("id, email, estado, origen, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return suscriptores;
    return suscriptores.filter((s) => s.email.includes(q));
  }, [suscriptores, busqueda]);

  const activos = useMemo(
    () => suscriptores.filter((s) => s.estado === "activo").length,
    [suscriptores]
  );

  /**
   * Exporta lo que está a la vista (respeta el filtro), no toda la tabla:
   * si alguien buscó algo, es lo que espera bajar.
   *
   * Cada campo va entre comillas y con las comillas internas escapadas. Un
   * email no debería traer comas, pero un CSV armado a mano que no escapa es
   * el clásico que rompe el día que aparece el primer dato raro.
   */
  function exportarCSV() {
    if (filtrados.length === 0) {
      toast.error("No hay suscriptores que exportar");
      return;
    }

    const escapar = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const filas = [
      ["email", "estado", "origen", "fecha_alta"].join(","),
      ...filtrados.map((s) =>
        [s.email, s.estado, s.origen, s.created_at].map(escapar).join(",")
      ),
    ];

    // BOM inicial: sin él, Excel en Windows abre el CSV en latin-1 y destroza
    // los acentos. El contenido es email, pero el encabezado y los datos
    // futuros no tienen por qué ser ASCII.
    const blob = new Blob(["﻿" + filas.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suscriptores-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    // Sin esto el blob queda retenido en memoria hasta recargar la página.
    URL.revokeObjectURL(url);
  }

  const inputClass =
    "rounded-md px-3 py-2 text-sm border border-[#e8e8e8] focus:border-[#e8003d] focus:outline-none transition-colors";

  return (
    <div className="-m-8 flex" style={{ height: "calc(100vh - 64px)" }}>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e8e8e8] shrink-0 bg-white flex-wrap">
          <h1 style={{ fontFamily: "var(--font-titulo)", fontSize: "20px", color: "#111111" }}>
            Suscriptores
          </h1>

          <input
            type="search"
            placeholder="Buscar email..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className={`${inputClass} w-56`}
            style={{ fontFamily: "var(--font-body)" }}
          />

          <button
            type="button"
            onClick={exportarCSV}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white transition-opacity hover:opacity-90"
            style={{ fontFamily: "var(--font-body)", backgroundColor: "#e8003d" }}
          >
            <Download size={15} />
            Exportar CSV
          </button>

          <span
            className="ml-auto text-sm"
            style={{ fontFamily: "var(--font-body)", color: "#666666" }}
          >
            {activos} activos · {suscriptores.length} en total
          </span>
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: "#f8f7f5", position: "sticky", top: 0 }}>
              <tr>
                {["Email", "Estado", "Origen", "Fecha de alta"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs uppercase tracking-wide"
                    style={{ fontFamily: "var(--font-body)", color: "#666666", fontWeight: 600 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((s) => (
                <tr key={s.id} className="border-b border-[#f0f0f0]">
                  <td className="px-4 py-3" style={{ fontFamily: "var(--font-body)", color: "#111111" }}>
                    {s.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{
                        fontFamily: "var(--font-body)",
                        backgroundColor: s.estado === "activo" ? "#e6f4ea" : "#f0f0f0",
                        color: s.estado === "activo" ? "#1e7e34" : "#666666",
                      }}
                    >
                      {s.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ fontFamily: "var(--font-body)", color: "#666666" }}>
                    {s.origen}
                  </td>
                  <td className="px-4 py-3" style={{ fontFamily: "var(--font-body)", color: "#666666" }}>
                    {new Date(s.created_at).toLocaleDateString("es-CL", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!isLoading && filtrados.length === 0 && (
            <p
              className="text-center py-16"
              style={{ fontFamily: "var(--font-body)", color: "#999999" }}
            >
              {busqueda ? "Ningún email coincide con la búsqueda." : "Todavía no hay suscriptores."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
