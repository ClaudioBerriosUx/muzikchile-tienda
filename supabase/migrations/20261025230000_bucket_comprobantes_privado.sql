-- Bucket `comprobantes`: comprobantes de transferencia de las liquidaciones
-- (modelo centralizado), que sube el admin desde /admin/liquidaciones.
--
-- No existía: el admin subía a un bucket inexistente y la subida fallaba. Va
-- PRIVADO porque un comprobante muestra datos bancarios: nada de getPublicUrl.
-- Se abre con URLs firmadas de corta duración (lib/storage.ts →
-- abrirComprobante), que pasan por estas políticas.
--
-- Rutas: comprobantes/{artistas.id}/<timestamp>-<nombre-limpio>. La primera
-- carpeta es el artistas.id, así el artista puede leer los suyos desde
-- /panel/liquidaciones. `liquidaciones.comprobante_url` guarda esa RUTA, no
-- una URL.
--
-- Re-ejecutable: el bucket va con `on conflict` y cada política con
-- `drop policy if exists`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes',
  'comprobantes',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ── Lectura: el admin, y cada artista los de su carpeta ─────────────────────
-- `public.` calificado a propósito: se evalúa desde el schema storage.

drop policy if exists comprobantes_select_admin on storage.objects;
create policy comprobantes_select_admin on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );

drop policy if exists comprobantes_select_own on storage.objects;
create policy comprobantes_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] in (
      select a.id::text from public.artistas a where a.user_id = auth.uid()
    )
  );


-- ── Escritura solo admin ─────────────────────────────────────────────────────

drop policy if exists comprobantes_admin_insert on storage.objects;
create policy comprobantes_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );

drop policy if exists comprobantes_admin_update on storage.objects;
create policy comprobantes_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'comprobantes'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  with check (
    bucket_id = 'comprobantes'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );

drop policy if exists comprobantes_admin_delete on storage.objects;
create policy comprobantes_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'comprobantes'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );
