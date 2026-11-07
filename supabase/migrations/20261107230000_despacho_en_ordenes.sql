-- Despacho en el cobro (commit 7).
--
-- El checkout cobra el envío que define cada tienda y la orden guarda una copia
-- de lo que vio el comprador: según los términos para artistas (punto 8), lo
-- informado en cada compra obliga al artista aunque después cambie su tienda.
--
--   entrega            'envio' o 'retiro'; NULL en las órdenes anteriores.
--   envio_monto        costo del envío del pedido de ese artista. Va en una sola
--                      de sus líneas (las demás, 0) y no paga comisión.
--   entrega_plazo_*    plazo informado, en días hábiles (solo envío).
--   entrega_detalle    indicaciones de retiro informadas (solo retiro).
--
-- Lo cobrado por una línea pasa a ser monto_artista + comision_monto +
-- envio_monto; el webhook compara esa suma con el pago.
--
-- Solo agrega columnas con default: compatible con el código actual. Se aplica
-- ANTES del deploy del código que las escribe.

ALTER TABLE public.ordenes
  ADD COLUMN entrega text
    CONSTRAINT ordenes_entrega_check CHECK (entrega IN ('envio', 'retiro')),
  ADD COLUMN envio_monto numeric NOT NULL DEFAULT 0
    CONSTRAINT ordenes_envio_monto_check CHECK (envio_monto >= 0),
  ADD COLUMN entrega_plazo_min smallint,
  ADD COLUMN entrega_plazo_max smallint,
  ADD COLUMN entrega_detalle text
    CONSTRAINT ordenes_entrega_detalle_check CHECK (char_length(entrega_detalle) <= 300);
