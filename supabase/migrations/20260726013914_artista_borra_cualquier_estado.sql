-- Autonomía total del artista sobre sus propias publicaciones.
--
-- Cambio de política de producto: el artista puede eliminar cualquier
-- publicación suya, en cualquier estado —incluidas las ya publicadas—, no solo
-- borradores y devueltas.
--
-- Historial de esta política:
--   20260725190514  solo 'borrador'
--   20260726005753  'borrador' y 'devuelta'
--   esta            cualquier estado
--
-- Lo ÚNICO que sigue restringiendo es la propiedad: `artista_id` tiene que
-- pertenecer al artista de la sesión. Un artista jamás puede borrar lo de otro.
--
-- Consecuencia asumida: borrar una publicada rompe su URL pública
-- (/noticias/{slug} pasa a 404) y no hay deshacer. La UI advierte de eso con un
-- texto distinto según el estado antes de confirmar.

drop policy if exists publicaciones_delete_propias on public.publicaciones;

create policy publicaciones_delete_propias
  on public.publicaciones
  for delete
  to authenticated
  using (
    artista_id in (
      select a.id from public.artistas a where a.user_id = auth.uid()
    )
  );
