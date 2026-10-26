-- Quita admin_full_access_ordenes: duplicado de "admin manage ordenes".
--
-- Las dos son FOR ALL para el admin: una con private.has_role(…, 'admin') y
-- esta con un EXISTS sobre user_roles. Se creó fuera de las migraciones (está
-- en schema_baseline.sql, que es un volcado de la base). Con dos políticas
-- permisivas iguales, cualquier cambio futuro en una queda anulado por la otra.
--
-- El admin sigue con acceso completo por "admin manage ordenes".

drop policy if exists admin_full_access_ordenes on public.ordenes;
