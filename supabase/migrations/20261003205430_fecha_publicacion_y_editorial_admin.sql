-- Noticias editoriales escritas desde el admin + fecha de publicación editable.
--
-- Tres cambios:
--   1. Columna `fecha_publicacion`: la fecha que se muestra y por la que se
--      ordena, distinta de `created_at` (cuándo se creó la fila).
--   2. Política INSERT para el admin. Hasta ahora el admin solo podía UPDATE y
--      DELETE: no podía crear una publicación, así que no podía escribir
--      noticias editoriales.
--   3. Trigger que reserva `fecha_publicacion` al admin y la fija sola al
--      publicar. El RLS no restringe columnas sueltas, y los permisos por
--      columna no sirven acá: el admin entra con el mismo rol `authenticated`
--      que los artistas.


-- ── 1. fecha_publicacion ─────────────────────────────────────────────────────

alter table public.publicaciones
  add column if not exists fecha_publicacion timestamptz not null default now();

-- Las existentes toman su created_at. Para las 8 migradas del Channel,
-- created_at ya es la fecha de publicación original (así las cargó el script
-- de migración), así que no cambian de fecha visible.
update public.publicaciones
  set fecha_publicacion = created_at;

comment on column public.publicaciones.fecha_publicacion is
  'Fecha que se muestra y por la que se ordena. Solo el admin la edita (trigger publicaciones_fecha_publicacion). Al pasar a publicada sin tocarla, toma now().';

create index if not exists publicaciones_fecha_publicacion_idx
  on public.publicaciones (fecha_publicacion desc);


-- ── 2. El admin puede crear publicaciones ────────────────────────────────────
-- Sin restricción de estado: el admin publica editoriales directo, sin pasar
-- por moderación. Es el mismo alcance que ya tiene `publicaciones_update_admin`.

drop policy if exists publicaciones_insert_admin on public.publicaciones;

create policy publicaciones_insert_admin
  on public.publicaciones
  for insert
  to authenticated
  with check (has_role(auth.uid(), 'admin'::app_role));


-- ── 3. Reglas de fecha_publicacion ───────────────────────────────────────────
--
-- Quién es "admin": `has_role(auth.uid(), 'admin')`. Las reglas de artista solo
-- aplican con sesión (`auth.uid() is not null`): la service role (scripts de
-- migración, tests montando escenario) no tiene uid y pasa intacta.
--
-- Artista:
--   INSERT → la fecha se fuerza a now(), mande lo que mande.
--   UPDATE que cambia la fecha → error explícito (42501), no se ignora en
--   silencio: un cambio descartado sin aviso es justo el tipo de bug que este
--   proyecto ya pagó varias veces.
--
-- Todos:
--   Pasar a 'publicada' sin tocar la fecha → now(). Una noticia de artista
--   aprobada en moderación, o un borrador editorial publicado días después,
--   sale con la fecha real de publicación. Si el admin cambió la fecha en el
--   mismo update, se respeta la suya.
--
-- Admin:
--   No se aceptan fechas futuras: no hay programación de publicaciones (con ISR
--   de 5 minutos una "programada" saldría a destiempo). Un minuto de margen
--   absorbe el desfase de reloj del navegador.

create or replace function public.publicaciones_fecha_publicacion()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  es_artista boolean := auth.uid() is not null
                        and not has_role(auth.uid(), 'admin'::app_role);
begin
  if tg_op = 'INSERT' then
    if es_artista then
      new.fecha_publicacion := now();
    end if;

  else -- UPDATE
    if es_artista and new.fecha_publicacion is distinct from old.fecha_publicacion then
      raise exception 'Solo el admin puede cambiar fecha_publicacion'
        using errcode = '42501';
    end if;

    if new.estado = 'publicada'
       and old.estado is distinct from 'publicada'
       and new.fecha_publicacion is not distinct from old.fecha_publicacion then
      new.fecha_publicacion := now();
    end if;
  end if;

  if new.fecha_publicacion > now() + interval '1 minute' then
    raise exception 'fecha_publicacion no puede ser futura'
      using errcode = '22007';
  end if;

  return new;
end;
$$;

drop trigger if exists publicaciones_fecha_publicacion on public.publicaciones;

create trigger publicaciones_fecha_publicacion
  before insert or update on public.publicaciones
  for each row
  execute function public.publicaciones_fecha_publicacion();
