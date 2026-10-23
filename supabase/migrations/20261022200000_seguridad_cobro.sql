-- Seguridad del cobro (commit 1 del cambio a marketplace de Mercado Pago).
--
-- Cierra tres hoyos que existían en producción al 2026-10-22:
--   1. Un artista podía cambiar su propia comision / es_founder / tienda_activa /
--      verificado (la política "artist update own" deja editar toda la fila) e
--      insertarse ya como founder.
--   2. Cualquiera podía ejecutar incrementar_usos_cupon() y agotar un cupón.
--   3. El webhook descontaba stock y sumaba usos de cupón en cada aviso de MP,
--      no una vez por pago.
--
-- Además crea datos_bancarios(), que usa el código nuevo para leer los datos
-- bancarios. Todo esto es compatible con el código anterior: se puede aplicar
-- antes del deploy. Los grants por columna y el cierre de cupones están en
-- 20261022200100_lectura_publica_restringida, que va DESPUÉS del deploy.

-- ── 1. Columnas protegidas de `artistas` ─────────────────────────────────────

-- La usará el modelo marketplace (artista con Mercado Pago conectado). Se crea
-- ya para que el trigger la proteja desde el primer día.
ALTER TABLE public.artistas
  ADD COLUMN IF NOT EXISTS cobros_activos boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.proteger_columnas_artista()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Solo se restringe a los roles de la API pública. El service role (Route
  -- Handlers, webhook) y las migraciones (postgres) pasan sin chequeo.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- El alta la hace PanelShell o el perfil desde el navegador: lo que mande
    -- en estas columnas se ignora y quedan los valores por defecto.
    NEW.comision       := 10;
    NEW.es_founder     := false;
    NEW.tienda_activa  := false;
    NEW.verificado     := false;
    NEW.cobros_activos := false;
    RETURN NEW;
  END IF;

  IF NEW.comision       IS DISTINCT FROM OLD.comision
  OR NEW.es_founder     IS DISTINCT FROM OLD.es_founder
  OR NEW.tienda_activa  IS DISTINCT FROM OLD.tienda_activa
  OR NEW.verificado     IS DISTINCT FROM OLD.verificado
  OR NEW.cobros_activos IS DISTINCT FROM OLD.cobros_activos THEN
    RAISE EXCEPTION 'Solo un admin puede cambiar comision, es_founder, tienda_activa, verificado o cobros_activos'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proteger_columnas_artista ON public.artistas;
CREATE TRIGGER proteger_columnas_artista
  BEFORE INSERT OR UPDATE ON public.artistas
  FOR EACH ROW EXECUTE FUNCTION public.proteger_columnas_artista();

-- Es función de trigger: PostgREST no la expone, pero no hace falta que nadie
-- la pueda ejecutar.
REVOKE ALL ON FUNCTION public.proteger_columnas_artista() FROM PUBLIC, anon, authenticated;

-- ── 2. Datos bancarios ─────────────────────────────────────────────────────────

-- El dueño ve los suyos, el admin los de todos. Reemplaza la lectura directa
-- de las columnas, que la migración siguiente les quita a anon y authenticated.
-- p_artista_id NULL = todos los que el llamador puede ver.
CREATE OR REPLACE FUNCTION public.datos_bancarios(p_artista_id uuid DEFAULT NULL)
RETURNS TABLE (
  artista_id      uuid,
  banco           text,
  cuenta_bancaria text,
  tipo_cuenta     text,
  rut             text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT a.id, a.banco, a.cuenta_bancaria, a.tipo_cuenta, a.rut
  FROM public.artistas a
  WHERE (p_artista_id IS NULL OR a.id = p_artista_id)
    AND (
      a.user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    );
$$;

REVOKE ALL ON FUNCTION public.datos_bancarios(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.datos_bancarios(uuid) TO authenticated;

-- ── 3. incrementar_usos_cupon: solo el servidor ──────────────────────────────

REVOKE ALL ON FUNCTION public.incrementar_usos_cupon(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.incrementar_usos_cupon(uuid) TO service_role;

-- ── 4. Confirmación idempotente de pagos ─────────────────────────────────────

-- Una fila por pago de MP procesado. La PK es el lock: el segundo aviso del
-- mismo pago choca acá y no hace nada.
CREATE TABLE IF NOT EXISTS public.pagos_mp (
  mp_payment_id text PRIMARY KEY,
  grupo_id      uuid NOT NULL,
  monto         numeric NOT NULL,
  procesado_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS sin políticas: solo el service role la toca.
ALTER TABLE public.pagos_mp ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pagos_mp FROM anon, authenticated;

-- Marca el grupo como pagado, descuenta stock y suma el uso del cupón, todo en
-- una transacción y una sola vez por pago.
--   'procesado'   → primera vez; acá (y solo acá) van los efectos secundarios
--                   como correos.
--   'duplicado'   → ese pago ya se había procesado; no se tocó nada.
--   'sin_ordenes' → pago registrado, pero no había órdenes del grupo en
--                   pendiente/cancelado (grupo desconocido o ya pagado).
CREATE OR REPLACE FUNCTION public.confirmar_pago(
  p_grupo_id   uuid,
  p_payment_id text,
  p_monto      numeric
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ordenes integer;
BEGIN
  INSERT INTO public.pagos_mp (mp_payment_id, grupo_id, monto)
  VALUES (p_payment_id, p_grupo_id, p_monto)
  ON CONFLICT (mp_payment_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN 'duplicado';
  END IF;

  -- Una sola sentencia: los tres UPDATE corren juntos sobre las mismas filas.
  -- 'cancelado' también: un pago rechazado marca el grupo como cancelado, pero
  -- el comprador puede reintentar en la misma preferencia y pagar.
  WITH pagadas AS (
    UPDATE public.ordenes
    SET estado         = 'pagado',
        mercadopago_id = p_payment_id,
        metodo_pago    = 'mercadopago'
    WHERE grupo_id = p_grupo_id
      AND estado IN ('pendiente', 'cancelado')
    RETURNING producto_id, cantidad, cupon_id
  ),
  -- Stock atómico: resta en la misma sentencia, sin leer-y-escribir.
  stock AS (
    UPDATE public.productos p
    SET stock = GREATEST(0, p.stock - s.cantidad)
    FROM (
      SELECT producto_id, sum(cantidad)::integer AS cantidad
      FROM pagadas
      WHERE producto_id IS NOT NULL
      GROUP BY producto_id
    ) s
    WHERE p.id = s.producto_id
      AND p.tipo = 'fisico'
  ),
  -- Un uso por pago, aunque el grupo tenga varias filas con el cupón.
  cupon AS (
    UPDATE public.cupones
    SET usos_actuales = usos_actuales + 1
    WHERE id = (SELECT cupon_id FROM pagadas WHERE cupon_id IS NOT NULL LIMIT 1)
  )
  SELECT count(*) INTO v_ordenes FROM pagadas;

  IF v_ordenes = 0 THEN
    RETURN 'sin_ordenes';
  END IF;

  RETURN 'procesado';
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_pago(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_pago(uuid, text, numeric) TO service_role;
