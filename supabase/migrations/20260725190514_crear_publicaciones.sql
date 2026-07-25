-- Publicaciones autogestionadas por artistas, con moderación.
--
-- La tabla nace lista para los tres tipos ('noticia', 'convocatoria',
-- 'fecha_abierta') aunque en esta fase solo se usa 'noticia'. Las columnas
-- fecha_cierre, ciudad y genero quedan nullable para esos tipos futuros.
--
-- Flujo de estados:
--   borrador  --(artista envía)-->  pendiente
--   pendiente --(admin aprueba)-->  publicada
--   pendiente --(admin devuelve)--> devuelta  --(artista corrige)--> pendiente
--
-- Las transiciones NO se hacen cumplir con un trigger: se hacen cumplir con
-- RLS (ver más abajo). El artista nunca puede escribir estado = 'publicada'.

create table public.publicaciones (
  id                    uuid primary key default gen_random_uuid(),
  artista_id            uuid not null references public.artistas (id) on delete cascade,

  tipo                  text not null default 'noticia'
                          check (tipo in ('noticia', 'convocatoria', 'fecha_abierta')),
  -- Para noticias: 'lanzamiento', 'show', 'prensa', 'general'.
  -- Sin CHECK a propósito: el vocabulario por tipo todavía se está definiendo.
  categoria             text,

  titular               text not null check (char_length(titular) <= 80),
  bajada                text,
  cuerpo                text,
  imagen_url            text,

  -- URL propia, ej: /noticias/mi-titular-a1b2
  slug                  text not null unique,

  estado                text not null default 'pendiente'
                          check (estado in ('borrador', 'pendiente', 'publicada', 'devuelta')),
  -- Feedback del admin al devolver una publicación.
  comentario_moderacion text,

  visibilidad           text not null default 'publica'
                          check (visibilidad in ('publica', 'solo_artistas')),

  -- Solo convocatorias / fechas abiertas (futuro).
  fecha_cierre          timestamptz,
  ciudad                text,
  genero                text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.publicaciones is
  'Publicaciones autogestionadas por artistas. El acceso se controla por RLS; el artista nunca puede publicar sin pasar por moderación.';


-- ── Índices ──────────────────────────────────────────────────────────────────
-- No se crea índice sobre slug: la restricción UNIQUE ya crea uno.

create index publicaciones_artista_id_idx on public.publicaciones (artista_id);
create index publicaciones_estado_idx     on public.publicaciones (estado);
create index publicaciones_tipo_idx       on public.publicaciones (tipo);


-- ── updated_at ───────────────────────────────────────────────────────────────
-- Nombre específico de la tabla a propósito: no se pudo verificar si el
-- proyecto ya tiene una función genérica de updated_at (leer el esquema remoto
-- requiere Docker, no disponible), y un CREATE OR REPLACE sobre un nombre
-- genérico podría pisar una función existente. Si más adelante se estandariza
-- una, esta se puede consolidar.

create function public.publicaciones_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger publicaciones_set_updated_at
  before update on public.publicaciones
  for each row
  execute function public.publicaciones_set_updated_at();


-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Se usa has_role(uuid, app_role), que ya existe en el proyecto, en vez de
-- crear un is_admin() nuevo.
--
-- "Es mi publicación" se resuelve con un subselect a artistas: una fila de
-- publicaciones es del usuario si su artista_id pertenece al artista cuyo
-- user_id es auth.uid().

alter table public.publicaciones enable row level security;


-- SELECT ─────────────────────────────────────────────────────────────────────

-- Cualquiera (incluido anon) ve lo publicado y público.
create policy publicaciones_select_publico
  on public.publicaciones
  for select
  to anon, authenticated
  using (
    estado = 'publicada'
    and visibilidad = 'publica'
  );

-- El artista ve TODAS sus publicaciones, en cualquier estado
-- (necesario para su panel: borradores, pendientes y devueltas).
create policy publicaciones_select_propias
  on public.publicaciones
  for select
  to authenticated
  using (
    artista_id in (
      select a.id from public.artistas a where a.user_id = auth.uid()
    )
  );

-- Lo publicado con visibilidad restringida solo lo ven artistas y admins.
create policy publicaciones_select_solo_artistas
  on public.publicaciones
  for select
  to authenticated
  using (
    estado = 'publicada'
    and visibilidad = 'solo_artistas'
    and (
      has_role(auth.uid(), 'artista'::app_role)
      or has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- El admin ve todo: sin esto no podría moderar lo que está pendiente.
create policy publicaciones_select_admin
  on public.publicaciones
  for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));


-- INSERT ─────────────────────────────────────────────────────────────────────

-- El artista solo puede crear filas a su propio nombre, y solo como borrador o
-- pendiente.
--
-- La restricción de estado NO es decorativa: sin ella un cliente podría
-- insertar directamente con estado = 'publicada' y saltarse la moderación
-- entera. El default de la columna no protege nada, porque el cliente puede
-- mandar la columna explícita.
create policy publicaciones_insert_propias
  on public.publicaciones
  for insert
  to authenticated
  with check (
    artista_id in (
      select a.id from public.artistas a where a.user_id = auth.uid()
    )
    and estado in ('borrador', 'pendiente')
  );


-- UPDATE ─────────────────────────────────────────────────────────────────────

-- El artista solo edita lo suyo, y solo mientras esté en 'borrador' o
-- 'devuelta' (USING mira la fila ANTES del update: no puede tocar algo ya
-- publicado ni algo en revisión).
--
-- El WITH CHECK mira la fila DESPUÉS: limita a qué estado puede moverla. Puede
-- enviar a revisión (borrador/devuelta -> pendiente) pero NUNCA escribir
-- 'publicada'. Sin este WITH CHECK el artista podría autopublicarse con un
-- update, y toda la moderación sería decorativa.
create policy publicaciones_update_propias
  on public.publicaciones
  for update
  to authenticated
  using (
    artista_id in (
      select a.id from public.artistas a where a.user_id = auth.uid()
    )
    and estado in ('borrador', 'devuelta')
  )
  with check (
    artista_id in (
      select a.id from public.artistas a where a.user_id = auth.uid()
    )
    and estado in ('borrador', 'pendiente')
  );

-- El admin modera: puede mover cualquier fila a cualquier estado.
create policy publicaciones_update_admin
  on public.publicaciones
  for update
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));


-- DELETE ─────────────────────────────────────────────────────────────────────

-- El artista solo borra borradores propios: una vez enviada a revisión, deja
-- rastro.
create policy publicaciones_delete_propias
  on public.publicaciones
  for delete
  to authenticated
  using (
    artista_id in (
      select a.id from public.artistas a where a.user_id = auth.uid()
    )
    and estado = 'borrador'
  );

create policy publicaciones_delete_admin
  on public.publicaciones
  for delete
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));
