-- Fase editorial: MuzikChile publica noticias propias, no solo los artistas.
--
-- Dos cambios:
--   1. Titulares hasta 200 caracteres (los editoriales son de estilo
--      periodístico, más largos que los 80 pensados para artistas).
--   2. Un perfil de autoría para la casa, marcado con `es_editorial`.


-- ── 1. Titular: 80 → 200 ─────────────────────────────────────────────────────
-- El nombre del constraint se verificó contra la base real provocando la
-- violación a propósito: `publicaciones_titular_check`. Importa acertarle: si
-- el DROP no encuentra nada, el ADD dejaría DOS checks conviviendo y el límite
-- viejo de 80 seguiría aplicando en silencio.

alter table public.publicaciones
  drop constraint if exists publicaciones_titular_check;

alter table public.publicaciones
  add constraint publicaciones_titular_check
  check (char_length(titular) <= 200);


-- ── 2. Perfiles editoriales ──────────────────────────────────────────────────

alter table public.artistas
  add column if not exists es_editorial boolean not null default false;

comment on column public.artistas.es_editorial is
  'true = perfil de la casa (redacción MuzikChile), no un artista real. Sirve para EXCLUIRLO del directorio público de artistas y del sitemap, y para marcar la autoría editorial de las publicaciones. Los perfiles editoriales no tienen user_id: nadie inicia sesión con ellos.';


-- Perfil de autoría editorial.
--
-- Va SIN user_id, y eso es correcto: `artistas.user_id` es nullable y no tiene
-- FK declarada. Se verificó con un insert real contra la base (creado y
-- borrado) que un artista sin usuario no choca con constraints ni triggers.
-- No se inventa un user_id falso ni se crea un usuario de servicio.
--
-- verificado = true para que muestre el badge; tienda_activa = false porque no
-- vende nada.
--
-- El `on conflict (slug) do nothing` hace la migración reejecutable sin fallar
-- si la fila ya existe.

insert into public.artistas (
  nombre,
  slug,
  bio,
  bio_completa,
  es_editorial,
  verificado,
  tienda_activa,
  tiene_tienda,
  comision
)
values (
  'MuzikChile',
  'muzikchile',
  'La redacción de MuzikChile',
  'Noticias, entrevistas y coberturas escritas por el equipo de MuzikChile.',
  true,
  true,
  false,
  false,
  0
)
on conflict (slug) do nothing;
