import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Estado de un pedido para /checkout/exito, leído de la base (lo que dejó el
 * webhook), no de MP: en marketplace el pago es de la cuenta del artista y el
 * token de MuzikChile no lo ve.
 *
 * `?ref=` es el external_reference (UUID aleatorio que solo conoce quien
 * compró). Devuelve solo el estado: ni montos ni datos del comprador.
 */
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref");
  if (!ref || !UUID.test(ref)) return NextResponse.json({ error: "Referencia inválida" }, { status: 400 });

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await supabase.from("ordenes").select("estado").eq("grupo_id", ref);
  if (error) return NextResponse.json({ error: "No pudimos leer el pedido" }, { status: 500 });
  if (!data?.length) return NextResponse.json({ estado: null });

  // Todas las líneas de un pedido cambian juntas (confirmar_pago, rechazo).
  const estados = new Set(data.map((o) => o.estado));
  const estado = estados.has("pagado") ? "pagado" : estados.has("pendiente") ? "pendiente" : "cancelado";
  return NextResponse.json({ estado });
}
