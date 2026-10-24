-- Reembolsos y contracargos: revertir_pago() (commit 4a del marketplace de MP).
--
-- El webhook la llama cuando MP informa un pago 'refunded' o 'charged_back',
-- venga de donde venga el reembolso: la ruta de admin
-- (/api/admin/mp/reembolsar), el panel de MP del artista o el de MuzikChile.
-- Es la contraparte de confirmar_pago() y sigue el mismo patrón: una sola vez
-- por pago (el lock es la fila de pagos_mp), en una transacción.
--
--   - Órdenes del pago (pagado | enviado | entregado) → 'reembolsado'.
--   - Stock: se devuelve solo lo que no se despachó (órdenes que estaban en
--     'pagado'); lo enviado o entregado no vuelve solo a la bodega.
--   - Cupón: se devuelve el uso (usos_actuales − 1, sin bajar de 0).
--
-- Devuelve: 'procesado' | 'duplicado' (ya revertido) | 'sin_pago' (el pago
-- nunca se confirmó acá) | 'sin_ordenes'.
--
-- Compatible con el código anterior: se puede aplicar antes del deploy.

ALTER TABLE public.pagos_mp
  ADD COLUMN IF NOT EXISTS revertido_at     timestamptz,
  ADD COLUMN IF NOT EXISTS revertido_motivo text;

CREATE OR REPLACE FUNCTION public.revertir_pago(
  p_grupo_id   uuid,
  p_payment_id text,
  p_motivo     text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ordenes integer;
BEGIN
  -- Lock: la fila del pago. Dos avisos simultáneos se serializan acá y el
  -- segundo ya la encuentra revertida.
  UPDATE public.pagos_mp
  SET revertido_at = now(), revertido_motivo = p_motivo
  WHERE mp_payment_id = p_payment_id
    AND grupo_id = p_grupo_id
    AND revertido_at IS NULL;

  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.pagos_mp WHERE mp_payment_id = p_payment_id AND grupo_id = p_grupo_id) THEN
      RETURN 'duplicado';
    END IF;
    RETURN 'sin_pago';
  END IF;

  -- Una sola sentencia, como en confirmar_pago. `antes` guarda el estado
  -- previo de cada orden para decidir qué stock vuelve.
  WITH antes AS (
    SELECT id, estado AS estado_previo
    FROM public.ordenes
    WHERE grupo_id = p_grupo_id
      AND mercadopago_id = p_payment_id
      AND estado IN ('pagado', 'enviado', 'entregado')
  ),
  revertidas AS (
    UPDATE public.ordenes o
    SET estado = 'reembolsado'
    FROM antes a
    WHERE o.id = a.id
    RETURNING o.producto_id, o.cantidad, o.cupon_id, a.estado_previo
  ),
  stock AS (
    UPDATE public.productos p
    SET stock = p.stock + s.cantidad
    FROM (
      SELECT producto_id, sum(cantidad)::integer AS cantidad
      FROM revertidas
      WHERE producto_id IS NOT NULL
        AND estado_previo = 'pagado'
      GROUP BY producto_id
    ) s
    WHERE p.id = s.producto_id
      AND p.tipo = 'fisico'
  ),
  -- Un uso por pago, igual que al confirmar.
  cupon AS (
    UPDATE public.cupones
    SET usos_actuales = GREATEST(0, usos_actuales - 1)
    WHERE id = (SELECT cupon_id FROM revertidas WHERE cupon_id IS NOT NULL LIMIT 1)
  )
  SELECT count(*) INTO v_ordenes FROM revertidas;

  IF v_ordenes = 0 THEN
    RETURN 'sin_ordenes';
  END IF;

  RETURN 'procesado';
END;
$$;

REVOKE ALL ON FUNCTION public.revertir_pago(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revertir_pago(uuid, text, text) TO service_role;
