-- Videos que los artistas envían para el Channel (tv.muzikchile.cl).
--
-- Versión simple (2026-11-08): el artista envía desde /panel/videos; el admin
-- ve la lista en /admin/videos y copia el JSON de cada fila para el Import JSON
-- del Channel (lib/videos.ts). Sin estados ni revisión en la tienda.
--
-- Permisos: el artista solo inserta envíos propios (y solo estas columnas);
-- solo el admin lee. Nadie edita ni borra desde la API pública.
--
-- Solo agrega.

-- Géneros libres: hasta 5, de 1 a 30 caracteres, sin espacios sobrantes ni
-- repetidos sin distinguir mayúsculas. La normalización la hace lib/videos.ts.
CREATE FUNCTION public.tags_video_validos(p_tags text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_tags IS NOT NULL
     AND cardinality(p_tags) <= 5
     AND NOT EXISTS (
       SELECT 1 FROM unnest(p_tags) AS t
       WHERE t IS NULL OR t <> btrim(t) OR char_length(t) NOT BETWEEN 1 AND 30
     )
     AND (SELECT count(DISTINCT lower(t)) FROM unnest(p_tags) AS t) = cardinality(p_tags);
$$;

CREATE TABLE public.videos_channel (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artista_id          uuid NOT NULL REFERENCES public.artistas(id) ON DELETE CASCADE,
  youtube_id          text NOT NULL CONSTRAINT videos_channel_youtube_id_check
                        CHECK (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  tracktitle          text NOT NULL CONSTRAINT videos_channel_tracktitle_check
                        CHECK (tracktitle = btrim(tracktitle) AND char_length(tracktitle) BETWEEN 1 AND 200),
  -- artist del JSON = artistas.nombre, o "nombre Ft. colaboracion".
  colaboracion        text CONSTRAINT videos_channel_colaboracion_check
                        CHECK (colaboracion = btrim(colaboracion) AND char_length(colaboracion) BETWEEN 1 AND 200),
  -- Página de artista de Spotify, sin query (?si=…).
  artist_link         text CONSTRAINT videos_channel_artist_link_check
                        CHECK (artist_link ~ '^https://open\.spotify\.com/(intl-[a-z]{2}(-[a-zA-Z]{2})?/)?artist/[A-Za-z0-9]{22}$'),
  ubicacion           text NOT NULL CONSTRAINT videos_channel_ubicacion_check
                        CHECK (ubicacion = btrim(ubicacion) AND char_length(ubicacion) BETWEEN 1 AND 100),
  tags                text[] NOT NULL DEFAULT '{}' CONSTRAINT videos_channel_tags_check
                        CHECK (public.tags_video_validos(tags)),
  -- La casilla "Es un videoclip oficial de mi proyecto y tengo los derechos".
  derechos_declarados boolean NOT NULL CONSTRAINT videos_channel_derechos_check CHECK (derechos_declarados),
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.videos_channel IS 'Videos que los artistas envían para el Channel (tv.muzikchile.cl). JSON del Import en lib/videos.ts.';

CREATE INDEX videos_channel_created_at ON public.videos_channel (created_at DESC);
CREATE INDEX videos_channel_artista ON public.videos_channel (artista_id);

ALTER TABLE public.videos_channel ENABLE ROW LEVEL SECURITY;

CREATE POLICY videos_insert_propios ON public.videos_channel
  FOR INSERT TO authenticated
  WITH CHECK (artista_id IN (SELECT a.id FROM public.artistas a WHERE a.user_id = auth.uid()));

CREATE POLICY videos_select_admin ON public.videos_channel
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- El REVOKE hace falta: Supabase da todo a anon y authenticated por defecto.
-- id y created_at los pone la base.
REVOKE ALL ON public.videos_channel FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.videos_channel TO authenticated;
GRANT INSERT (
  artista_id, youtube_id, tracktitle, colaboracion, artist_link, ubicacion, tags, derechos_declarados
) ON public.videos_channel TO authenticated;
