-- Vocabulario cerrado para la categoría de las noticias.
--
-- Hasta ahora `categoria` era texto libre (ver 20260725190514): el vocabulario
-- se estaba definiendo. Queda fijo en cinco valores, con estas etiquetas
-- (`CATEGORIAS_NOTICIA` en lib/publicaciones.ts):
--   lanzamiento → Lanzamientos · video → Videoclips · show → En vivo ·
--   perfil → Perfiles · general → Escena
-- ('video' y 'perfil' son nuevos; editado antes de aplicarse.)
-- 'prensa' sale. Al escribir esto no había ninguna fila con 'prensa' (12
-- noticias: 11 'general', 1 'lanzamiento'), así que no hay datos que mover; el
-- update de abajo es por si alguna entró entre el diagnóstico y el push.
--
-- Solo aplica a tipo = 'noticia': convocatorias y fechas abiertas van a usar la
-- misma columna con su propio vocabulario, todavía sin definir.
--
-- El `is not null` es necesario: sin él, una noticia con categoria NULL pasaría
-- (NULL IN (...) da NULL, y un CHECK solo rechaza false). Ninguna noticia
-- tenía NULL al escribir esto.

update public.publicaciones
  set categoria = 'general'
  where tipo = 'noticia' and categoria = 'prensa';

alter table public.publicaciones
  add constraint publicaciones_categoria_noticia_check
  check (
    tipo <> 'noticia'
    or (categoria is not null and categoria in ('lanzamiento', 'video', 'show', 'perfil', 'general'))
  );
