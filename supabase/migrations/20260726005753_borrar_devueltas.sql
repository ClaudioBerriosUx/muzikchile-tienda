-- El artista también puede descartar publicaciones devueltas.
--
-- La política original solo permitía borrar `borrador`. Se verificó midiendo
-- contra la base con una sesión de artista real: borrador → BORRÓ,
-- devuelta/pendiente/publicada → no borró.
--
-- El problema práctico: una publicación devuelta es contenido que el artista
-- debe corregir o abandonar. Sin poder borrarla, si decide abandonarla le queda
-- en el panel para siempre, sin forma de sacarla.
--
-- `pendiente` y `publicada` siguen sin poder borrarse, y eso es deliberado:
-- lo que está en revisión o ya salió al público debe dejar rastro. Para esos
-- casos existe el admin.

drop policy if exists publicaciones_delete_propias on public.publicaciones;

create policy publicaciones_delete_propias
  on public.publicaciones
  for delete
  to authenticated
  using (
    artista_id in (
      select a.id from public.artistas a where a.user_id = auth.uid()
    )
    and estado in ('borrador', 'devuelta')
  );
