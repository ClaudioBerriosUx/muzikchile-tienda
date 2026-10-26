"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/ui/StatusBadge";

/**
 * Pedidos por despachar: lo que el artista necesita para enviar lo que le
 * compraron (nombre, email y dirección del comprador), solo de sus órdenes
 * pagadas o ya enviadas.
 *
 * La restricción real está en RLS (artista_lee_sus_ordenes_pagadas): el
 * artista no puede leer órdenes pendientes ni canceladas. Ver la política de
 * privacidad: el artista usa estos datos solo para cumplir el pedido.
 *
 * Un checkout es un grupo (grupo_id) con una fila por producto: se muestran
 * juntas, con los datos de despacho una sola vez.
 */
async function traerPedidos(supabase: ReturnType<typeof createClient>, artistaId: string) {
  const { data, error } = await supabase
    .from("ordenes")
    .select("id, grupo_id, estado, created_at, cantidad, comprador_nombre, comprador_email, direccion_envio, ciudad_envio, region_envio, productos(nombre)")
    .eq("artista_id", artistaId)
    .in("estado", ["pagado", "enviado"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

type Linea = Awaited<ReturnType<typeof traerPedidos>>[number];

const texto = { fontFamily: "var(--font-body)" } as const;

export default function DespachoPage() {
  const supabase = createClient();

  const { data: artista } = useQuery({
    queryKey: ["panel-artista-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("artistas").select("id").eq("user_id", user.id).single();
      return data;
    },
  });

  const { data: lineas = [], isLoading } = useQuery({
    queryKey: ["panel-despacho", artista?.id],
    queryFn: () => traerPedidos(supabase, artista!.id),
    enabled: !!artista?.id,
  });

  const pedidos = useMemo(() => {
    const grupos = new Map<string, Linea[]>();
    for (const l of lineas) {
      const clave = l.grupo_id ?? l.id;
      grupos.set(clave, [...(grupos.get(clave) ?? []), l]);
    }
    return [...grupos.entries()];
  }, [lineas]);

  return (
    <div>
      <h1 className="mb-2" style={{ fontFamily: "var(--font-titulo)", fontSize: "28px", color: "#111111" }}>
        Por despachar
      </h1>
      <p className="mb-8 max-w-2xl" style={{ ...texto, fontSize: "14px", color: "#666666" }}>
        Pedidos pagados y los ya enviados, con los datos para despacharlos. Usa estos datos solo para
        enviar el pedido y responder dudas sobre él: no los uses para promociones ni los compartas.
      </p>

      {isLoading ? (
        <p style={{ ...texto, color: "#666666" }}>Cargando…</p>
      ) : pedidos.length === 0 ? (
        <div className="rounded-xl border border-[#e8e8e8] p-10 text-center" style={{ backgroundColor: "#f8f7f5" }}>
          <p style={{ ...texto, color: "#666666" }}>No tienes pedidos por despachar.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {pedidos.map(([clave, items]) => {
            const p = items[0];
            return (
              <li key={clave} className="rounded-xl border border-[#e8e8e8] bg-white p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <p style={{ ...texto, fontSize: "13px", color: "#666666" }}>
                    Pedido <span className="font-mono">{clave.slice(0, 8).toUpperCase()}</span> ·{" "}
                    {new Date(p.created_at).toLocaleDateString("es-CL")}
                  </p>
                  <StatusBadge estado={p.estado} />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <h2 className="mb-2 text-xs uppercase tracking-wide" style={{ ...texto, color: "#999999", fontWeight: 600 }}>
                      Productos
                    </h2>
                    <ul className="flex flex-col gap-1">
                      {items.map((l) => (
                        <li key={l.id} style={{ ...texto, fontSize: "14px", color: "#111111" }}>
                          {l.cantidad} × {l.productos?.nombre ?? "Producto"}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h2 className="mb-2 text-xs uppercase tracking-wide" style={{ ...texto, color: "#999999", fontWeight: 600 }}>
                      Despachar a
                    </h2>
                    <address className="not-italic" style={{ ...texto, fontSize: "14px", color: "#111111", lineHeight: 1.6 }}>
                      {p.comprador_nombre}
                      <br />
                      {p.direccion_envio ?? "—"}
                      <br />
                      {[p.ciudad_envio, p.region_envio].filter(Boolean).join(", ") || "—"}
                      <br />
                      <a href={`mailto:${p.comprador_email}`} className="underline" style={{ color: "#3b82f6" }}>
                        {p.comprador_email}
                      </a>
                    </address>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
