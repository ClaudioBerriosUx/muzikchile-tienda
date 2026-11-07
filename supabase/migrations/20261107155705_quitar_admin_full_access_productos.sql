-- Quita admin_full_access_productos: duplicado de "admin manage productos".
--
-- Las dos son FOR ALL para el admin: una con private.has_role(…, 'admin') y
-- esta con un EXISTS sobre user_roles. Se creó fuera de las migraciones (está
-- en schema_baseline.sql, que es un volcado de la base). Con dos políticas
-- permisivas iguales, cualquier cambio futuro en una queda anulado por la otra.
-- Mismo retiro que 20261026020000 en ordenes.
--
-- El admin sigue con acceso completo por "admin manage productos". Si esa no
-- está, no se quita nada: el admin se quedaría sin acceso.
--
-- Para revertir:
--   CREATE POLICY admin_full_access_productos ON public.productos TO authenticated
--   USING (EXISTS (SELECT 1 FROM public.user_roles
--          WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::public.app_role));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'productos'
      AND policyname = 'admin manage productos' AND cmd = 'ALL'
  ) THEN
    RAISE EXCEPTION 'Falta "admin manage productos": no se quita el duplicado';
  END IF;
END $$;

DROP POLICY IF EXISTS admin_full_access_productos ON public.productos;
