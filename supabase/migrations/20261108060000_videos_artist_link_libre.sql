-- El link de Spotify de los videos para el Channel pasa a ser texto libre
-- (decisión de Claudio, 2026-11-08). El CHECK de 20261108050000 exigía una
-- página de artista exacta (https://open.spotify.com/[intl-xx/]artist/<22>) y
-- rechazaba links reales: sin https://, los cortos de "Compartir"
-- (spotify.link/…), etc. El formulario ahora solo saca espacios sobrantes y el
-- ?si=… de un link completo (limpiarSpotify en lib/videos.ts).
--
-- Solo relaja una restricción: compatible con el código anterior y el nuevo.

ALTER TABLE public.videos_channel DROP CONSTRAINT IF EXISTS videos_channel_artist_link_check;
