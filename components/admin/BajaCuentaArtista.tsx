"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/**
 * Baja de la cuenta de un artista (retención: migración
 * 20261026030000_retencion_datos). Dar de baja apaga la tienda y pausa sus
 * productos al instante; un año después el cron /api/cron/retencion borra RUT,
 * datos bancarios, perfil, foto y el usuario de Auth. Mientras no pase el año,
 * se puede revertir. Todo va por la RPC dar_de_baja_artista (solo admin).
 */
export default function BajaCuentaArtista({ artistaId }: { artistaId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin-artista-baja", artistaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artistas")
        .select("baja_at, datos_eliminados_at")
        .eq("id", artistaId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const ejecutar = async (revertir: boolean) => {
    setEnviando(true);
    const { error } = await supabase.rpc("dar_de_baja_artista", { p_artista_id: artistaId, p_revertir: revertir });
    setEnviando(false);
    setConfirmando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(revertir ? "Baja revertida. La tienda sigue apagada: actívala si corresponde." : "Cuenta dada de baja");
    queryClient.invalidateQueries({ queryKey: ["admin-artista-baja", artistaId] });
    queryClient.invalidateQueries({ queryKey: ["admin-artistas"] });
  };

  if (!data) return null;

  const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
  const borrado = data.baja_at ? new Date(new Date(data.baja_at).setFullYear(new Date(data.baja_at).getFullYear() + 1)).toISOString() : null;
  const texto = { fontFamily: "var(--font-body)", fontSize: "14px", color: "#444444", lineHeight: 1.6 } as const;
  const boton = "h-10 px-5 rounded-md text-sm font-semibold transition-colors disabled:opacity-60";

  return (
    <section className="mt-2 mb-10 p-6 rounded-xl border border-[#f3c2cc] bg-white flex flex-col gap-4">
      <h2 style={{ fontFamily: "var(--font-titulo)", fontSize: "16px", color: "#111111" }}>Baja de la cuenta</h2>

      {data.datos_eliminados_at ? (
        <p style={texto}>
          Cuenta dada de baja el {fecha(data.baja_at!)}. Sus datos personales se eliminaron el{" "}
          {fecha(data.datos_eliminados_at)}. No se puede revertir.
        </p>
      ) : data.baja_at ? (
        <>
          <p style={texto}>
            Dada de baja el <strong>{fecha(data.baja_at)}</strong>. La tienda está apagada y sus productos, pausados.
            El <strong>{fecha(borrado!)}</strong> se borrarán su RUT, datos bancarios, perfil, foto y acceso.
          </p>
          <div>
            <button type="button" disabled={enviando} onClick={() => ejecutar(true)}
              className={`${boton} border border-[#e8e8e8] text-[#111111] hover:bg-[#f8f7f5]`}>
              Revertir la baja
            </button>
          </div>
        </>
      ) : confirmando ? (
        <>
          <p style={texto}>
            ¿Dar de baja esta cuenta? La tienda se apaga y sus productos dejan de mostrarse ahora. En un año se
            borran su RUT, datos bancarios, perfil, foto y acceso (las órdenes y liquidaciones se conservan).
            Hasta entonces se puede revertir.
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={enviando} onClick={() => ejecutar(false)}
              className={`${boton} text-white bg-[#e8003d] hover:bg-[#c5002e]`}>
              {enviando ? "Dando de baja…" : "Sí, dar de baja"}
            </button>
            <button type="button" disabled={enviando} onClick={() => setConfirmando(false)}
              className={`${boton} border border-[#e8e8e8] text-[#111111] hover:bg-[#f8f7f5]`}>
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={texto}>
            Úsalo cuando el artista pida cerrar su cuenta. Apaga la tienda y pausa sus productos; los datos
            personales se borran un año después.
          </p>
          <div>
            <button type="button" onClick={() => setConfirmando(true)}
              className={`${boton} border border-[#e8003d] text-[#e8003d] hover:bg-[#fdf0f3]`}>
              Dar de baja la cuenta
            </button>
          </div>
        </>
      )}
    </section>
  );
}
