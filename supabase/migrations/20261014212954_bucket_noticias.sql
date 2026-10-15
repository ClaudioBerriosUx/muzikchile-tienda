-- Bucket `noticias`: imágenes de las notas editoriales que sube el admin desde
-- /admin/publicaciones (botón "Subir imagen" de PublicacionForm).
--
-- Rutas planas: noticias/<timestamp>-<nombre-limpio>.jpg. No hay carpeta por
-- dueño porque solo escribe el admin.
--
-- Las publicaciones de artistas siguen en productos/{artistas.id}/publicaciones/
-- (ver 20260925191923_storage_politicas_por_dueno): un artista no puede
-- escribir acá.
--
-- Los límites del bucket repiten los del formulario (5 MB; JPG, PNG, WEBP) para
-- que no dependan solo del navegador. El formulario comprime a JPEG antes de
-- subir, así que en la práctica llega image/jpeg.
--
-- Re-ejecutable: el bucket va con `on conflict` y cada política con
-- `drop policy if exists`, por si algo se creó antes desde el dashboard.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'noticias',
  'noticias',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ── Lectura pública ──────────────────────────────────────────────────────────
-- getPublicUrl no pasa por RLS en un bucket público; esta política cubre las
-- lecturas por API (download, list).

drop policy if exists noticias_select_publico on storage.objects;
create policy noticias_select_publico on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'noticias');


-- ── Escritura solo admin ─────────────────────────────────────────────────────
-- `public.` calificado a propósito: se evalúa desde el schema storage.

drop policy if exists noticias_admin_insert on storage.objects;
create policy noticias_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'noticias'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );

drop policy if exists noticias_admin_update on storage.objects;
create policy noticias_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'noticias'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  with check (
    bucket_id = 'noticias'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );

drop policy if exists noticias_admin_delete on storage.objects;
create policy noticias_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'noticias'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );
