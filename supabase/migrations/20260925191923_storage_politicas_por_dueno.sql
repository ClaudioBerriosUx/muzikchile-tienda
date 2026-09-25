-- Políticas de storage.objects acotadas al dueño de la carpeta.
--
-- Hallazgo del baseline (2026-09-25): `artistas_update` y `productos_update`
-- dejaban a cualquier `authenticated` sobrescribir cualquier archivo de su
-- bucket, e INSERT estaba igual de abierto. Como las políticas permisivas se
-- suman con OR, las `*_update_own` no restringían nada.
--
-- Además, en `productos` las `*_own` NUNCA coincidían: comparaban la primera
-- carpeta con `auth.uid()`, pero las rutas de ese bucket empiezan con
-- `artistas.id`, que es un uuid distinto de `user_id`. Por eso `remove()` de un
-- artista devolvía éxito sin borrar nada (ver lib/storage.ts).
--
-- Convención de rutas que estas políticas asumen (verificada en el código):
--   artistas/{user_id}/foto.jpg                     ← panel/perfil
--   productos/{artistas.id}/<archivo>.jpg           ← panel/productos
--   productos/{artistas.id}/publicaciones/<a>.jpg   ← panel/publicaciones
-- El admin escribe en cualquier carpeta vía has_role; en particular
-- `artistas/{artistas.id}/foto.*` (admin/artistas/[id]/editar) y la carpeta del
-- perfil editorial, que no tiene user_id y por lo tanto no tiene dueño.
--
-- SELECT no se toca: los dos buckets siguen con lectura pública.
--
-- `public.` va calificado a propósito: estas políticas se evalúan desde el
-- schema storage y no conviene depender del search_path.


-- ── Bucket artistas: la carpeta es el user_id ────────────────────────────────

drop policy if exists artistas_update on storage.objects;
drop policy if exists artistas_upload on storage.objects;

-- artistas_update_own y artistas_delete_own se mantienen: ya comparan
-- auth.uid() con la primera carpeta, que es lo correcto en este bucket.

create policy artistas_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'artistas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy artistas_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'artistas'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );

create policy artistas_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'artistas'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );

create policy artistas_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'artistas'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );


-- ── Bucket productos: la carpeta es el artistas.id ───────────────────────────
-- "Es mío" = la primera carpeta es el id de un artista cuyo user_id soy yo.
-- El subselect a artistas pasa por su RLS, que tiene lectura pública.

drop policy if exists productos_update on storage.objects;
drop policy if exists productos_upload on storage.objects;
drop policy if exists productos_update_own on storage.objects;
drop policy if exists productos_delete_own on storage.objects;

create policy productos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'productos'
    and (storage.foldername(name))[1] in (
      select a.id::text from public.artistas a where a.user_id = auth.uid()
    )
  );

create policy productos_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'productos'
    and (storage.foldername(name))[1] in (
      select a.id::text from public.artistas a where a.user_id = auth.uid()
    )
  );

create policy productos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'productos'
    and (storage.foldername(name))[1] in (
      select a.id::text from public.artistas a where a.user_id = auth.uid()
    )
  );

create policy productos_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'productos'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );

create policy productos_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'productos'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );

create policy productos_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'productos'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );
