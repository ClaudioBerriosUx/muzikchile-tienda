-- El artista ya no puede aprobar sus propios productos, y existe `borrador`.
--
-- Antes, "artist insert own products" y "artist update own products" solo
-- revisaban que el producto fuera suyo. Desde el navegador, un artista podía
-- insertar con estado 'aprobado', pasar uno suyo a 'aprobado' o cambiarle el
-- precio a uno aprobado sin volver a revisión: la moderación era evitable.
--
--   1. productos.estado pasa a tener CHECK, con el estado nuevo 'borrador'.
--   2. El artista solo puede dejar un producto en 'borrador' o 'en_revision'.
--      'aprobado', 'rechazado' y 'pausado' los pone el admin o una función.
--   3. Un producto 'pausado' (baja de la cuenta) no lo edita el artista: si no,
--      podría sacarlo de la pausa mandándolo a revisión.
--
-- Editar un producto aprobado lo sigue mandando a 'en_revision', como hace hoy
-- /panel/productos/[id]/editar. Compatible con el código actual: se puede
-- aplicar antes o después del deploy.
--
-- Solo cubre los roles de la API. El service role y las funciones SECURITY
-- DEFINER (confirmar_pago, revertir_pago, dar_de_baja_artista) no pasan por RLS.

-- ── Chequeo previo ───────────────────────────────────────────────────────────
-- Las políticas permisivas se suman con OR: una que no conozcamos podría
-- mantener abierto el agujero aunque estas queden bien. Si aparece una, no se
-- aplica nada.
DO $$
DECLARE
  v_desconocidas text;
BEGIN
  SELECT string_agg(policyname, ', ') INTO v_desconocidas
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'productos'
    AND policyname NOT IN (
      'admin manage productos',
      'admin_full_access_productos',
      'artist delete own products',
      'artist insert own products',
      'artist read own products',
      'artist update own products',
      'public read aprobados'
    );

  IF v_desconocidas IS NOT NULL THEN
    RAISE EXCEPTION 'productos tiene políticas que esta migración no conoce: %', v_desconocidas;
  END IF;
END $$;

-- ── 1. Estados válidos ───────────────────────────────────────────────────────
-- Si una fila tiene otro valor, el ALTER falla y no se aplica nada.
ALTER TABLE public.productos
  ADD CONSTRAINT productos_estado_check
  CHECK (estado IN ('borrador', 'en_revision', 'aprobado', 'rechazado', 'pausado'));

-- ── 2 y 3. Políticas del artista ─────────────────────────────────────────────
-- ALTER POLICY en vez de DROP + CREATE: no hay un instante sin política, y si
-- una no existe con ese nombre, la migración falla.
ALTER POLICY "artist insert own products" ON public.productos
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.artistas a
      WHERE a.id = productos.artista_id AND a.user_id = auth.uid()
    )
    AND estado IN ('borrador', 'en_revision')
  );

ALTER POLICY "artist update own products" ON public.productos
  USING (
    EXISTS (
      SELECT 1 FROM public.artistas a
      WHERE a.id = productos.artista_id AND a.user_id = auth.uid()
    )
    AND estado <> 'pausado'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.artistas a
      WHERE a.id = productos.artista_id AND a.user_id = auth.uid()
    )
    AND estado IN ('borrador', 'en_revision')
  );
