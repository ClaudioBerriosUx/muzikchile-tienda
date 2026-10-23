-- Lectura pública restringida (segunda mitad de la seguridad del cobro).
--
-- Va separada de 20261022200000_seguridad_cobro porque rompe el código que
-- había antes del deploy (la ficha pública hacía select("*") de artistas y el
-- checkout leía cupones con la anon key). Se aplica DESPUÉS del deploy.
--
--   1. La anon key leía las 32 columnas de `artistas`, incluidos rut, banco,
--      cuenta_bancaria, tipo_cuenta, user_id, comision y auth_provider.
--   2. Cualquiera podía listar todos los cupones activos (y sus códigos).

-- ── 1. Lectura de `artistas` por columna ─────────────────────────────────────
--
-- La política "public read artistas" (USING true) sigue: decide QUÉ FILAS se
-- ven. Los grants deciden QUÉ COLUMNAS. Un select("*") de anon o authenticated
-- ahora falla con 42501: hay que nombrar las columnas.

REVOKE SELECT ON public.artistas FROM anon, authenticated;

GRANT SELECT (
  id, nombre, slug, bio, bio_completa, foto_url, region, ciudad, color_acento,
  redes, generos, spotify_id, spotify_url, instagram_url, youtube_url,
  tiktok_url, soundcloud_url, seo_titulo, seo_descripcion, verificado,
  es_editorial, tiene_tienda, tienda_activa, cobros_activos, created_at
) ON public.artistas TO anon;

-- authenticated además: user_id (todos los .eq("user_id", …) del panel lo
-- necesitan para filtrar), comision y es_founder (listado del admin) y
-- auth_provider. Los datos bancarios NO: van por datos_bancarios().
GRANT SELECT (
  id, nombre, slug, bio, bio_completa, foto_url, region, ciudad, color_acento,
  redes, generos, spotify_id, spotify_url, instagram_url, youtube_url,
  tiktok_url, soundcloud_url, seo_titulo, seo_descripcion, verificado,
  es_editorial, tiene_tienda, tienda_activa, cobros_activos, created_at,
  user_id, comision, es_founder, auth_provider
) ON public.artistas TO authenticated;

-- ── 2. Cupones: sin lectura pública ──────────────────────────────────────────
-- La validación pasó a /api/checkout/cotizar (service role). Las políticas de
-- artista y admin siguen intactas.

DROP POLICY IF EXISTS "public read cupones activos" ON public.cupones;
DROP POLICY IF EXISTS public_read_cupones_activos ON public.cupones;
