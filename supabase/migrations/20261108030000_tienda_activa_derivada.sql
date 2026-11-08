-- Commit 9: vender exige tienda activa. artistas.tienda_activa deja de ser un
-- flag aparte y pasa a ser siempre tiendas.estado = 'activa'.
--
--   1. Un trigger en artistas la calcula en cada INSERT y UPDATE: lo que se
--      escriba en la columna se ignora. Corre después de
--      proteger_columnas_artista (orden alfabético), así que un artista que
--      intenta cambiarla sigue recibiendo el 42501.
--   2. Un trigger en tiendas la actualiza cuando cambia el estado (aprobar,
--      suspender, la baja).
--   3. Se alinean las filas actuales.
--
-- EFECTO EN PRODUCCIÓN (paso 3): hoy ninguna tienda está 'activa', así que los
-- artistas con tienda_activa = true la pierden. Salen del sitemap los que no
-- estén verificados, y sus productos dejan de listarse en /tienda y en su ficha
-- (decisión del 2026-11-08: no se marcan verificados). Antes de aplicar:
--
--   SELECT a.nombre, a.tienda_activa, a.verificado, t.estado
--   FROM public.artistas a JOIN public.tiendas t ON t.artista_id = a.id
--   WHERE a.tienda_activa IS DISTINCT FROM (t.estado = 'activa');
--
-- Se puede aplicar antes del deploy: el código actual no depende de que
-- tienda_activa sea editable.

-- ── 1. Calculada en artistas ─────────────────────────────────────────────────

CREATE FUNCTION public.tienda_activa_de_tiendas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- En el INSERT la fila de tiendas todavía no existe (la crea el trigger
  -- AFTER INSERT): queda en false.
  NEW.tienda_activa := EXISTS (
    SELECT 1 FROM public.tiendas t
    WHERE t.artista_id = NEW.id AND t.estado = 'activa'
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tienda_activa_de_tiendas() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tienda_activa_de_tiendas
  BEFORE INSERT OR UPDATE ON public.artistas
  FOR EACH ROW EXECUTE FUNCTION public.tienda_activa_de_tiendas();

-- ── 2. Al cambiar el estado de la tienda ─────────────────────────────────────

CREATE FUNCTION public.tiendas_sincronizar_activa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- El valor lo pone el trigger de artistas; este UPDATE solo lo dispara.
  UPDATE public.artistas
     SET tienda_activa = (NEW.estado = 'activa')
   WHERE id = NEW.artista_id
     AND tienda_activa IS DISTINCT FROM (NEW.estado = 'activa');
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tiendas_sincronizar_activa() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tiendas_sincronizar_activa
  AFTER UPDATE OF estado ON public.tiendas
  FOR EACH ROW
  WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
  EXECUTE FUNCTION public.tiendas_sincronizar_activa();

-- ── 3. Alinear lo que hay ────────────────────────────────────────────────────

UPDATE public.artistas a
   SET tienda_activa = (t.estado = 'activa')
  FROM public.tiendas t
 WHERE t.artista_id = a.id
   AND a.tienda_activa IS DISTINCT FROM (t.estado = 'activa');
