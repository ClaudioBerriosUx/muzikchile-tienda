-- El artista solo lee sus órdenes PAGADAS (pagado, enviado, entregado y
-- reembolsado), no las pendientes ni las canceladas.
--
-- Antes, "artist read own orders" dejaba leer todas las filas de sus órdenes,
-- con nombre, email y dirección del comprador, también las de checkouts que
-- nunca se pagaron. El artista necesita esos datos solo para despachar lo que
-- se pagó (/panel/despacho), y eso es lo que dice la política de privacidad.
--
-- 'reembolsado' se mantiene: el artista tiene que saber qué pedido se le
-- devolvió (stock, liquidación). El panel no consulta otras filas: ventas,
-- liquidaciones y últimas órdenes ya filtran o muestran estados pagados.
--
-- El admin no cambia ("admin manage ordenes" / admin_full_access_ordenes).

drop policy if exists "artist read own orders" on public.ordenes;
drop policy if exists artista_lee_sus_ordenes_pagadas on public.ordenes;

create policy artista_lee_sus_ordenes_pagadas on public.ordenes
  for select to authenticated
  using (
    estado in ('pagado', 'enviado', 'entregado', 'reembolsado')
    and exists (
      select 1 from public.artistas a
      where a.id = ordenes.artista_id and a.user_id = auth.uid()
    )
  );
