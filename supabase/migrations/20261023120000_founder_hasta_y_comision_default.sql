-- Founder con fecha de término y comisión por defecto desde app_settings.
--
--   1. artistas.founder_hasta (date, opcional): vacío = founder de por vida;
--      con fecha, el 0% rige hasta ese día inclusive y después se aplica la
--      comisión del artista. La regla vive en lib/comision.ts.
--   2. El 10% por defecto estaba escrito en el código (trigger, default de la
--      columna, PanelShell, cotizar). Ahora sale de app_settings.comision_default
--      vía comision_por_defecto(). Es la comisión que recibe un artista NUEVO:
--      cambiarla no toca a los que ya existen.
--
-- Compatible con el código anterior: se puede aplicar antes del deploy.

-- ── 1. Comisión por defecto ──────────────────────────────────────────────────

-- SECURITY DEFINER: app_settings solo la lee un admin, pero el alta de un
-- artista la hace él mismo desde el panel (rol authenticated). Devuelve solo
-- este número.
CREATE OR REPLACE FUNCTION public.comision_por_defecto()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT value::numeric
     FROM public.app_settings
     WHERE key = 'comision_default'
       AND value ~ '^\s*\d+(\.\d+)?\s*$'),
    -- Solo si alguien borra la fila o deja basura: la base no puede quedar
    -- sin comisión. El valor real se configura en /admin/configuracion.
    10
  );
$$;

REVOKE ALL ON FUNCTION public.comision_por_defecto() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comision_por_defecto() TO authenticated, service_role;

-- Los inserts con service role (Edge Function invitar-artista, scripts)
-- también la toman.
ALTER TABLE public.artistas
  ALTER COLUMN comision SET DEFAULT public.comision_por_defecto();

-- ── 2. founder_hasta ─────────────────────────────────────────────────────────

ALTER TABLE public.artistas
  ADD COLUMN IF NOT EXISTS founder_hasta date;

-- Lo lee el admin (/admin/artistas). anon no: es dato comercial, como comision.
GRANT SELECT (founder_hasta) ON public.artistas TO authenticated;

-- ── 3. El trigger protege founder_hasta y usa la comisión por defecto ────────

CREATE OR REPLACE FUNCTION public.proteger_columnas_artista()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Solo se restringe a los roles de la API pública. El service role (Route
  -- Handlers, webhook) y las migraciones (postgres) pasan sin chequeo.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- El alta la hace PanelShell o el perfil desde el navegador: lo que mande
    -- en estas columnas se ignora y quedan los valores por defecto.
    NEW.comision       := public.comision_por_defecto();
    NEW.es_founder     := false;
    NEW.founder_hasta  := NULL;
    NEW.tienda_activa  := false;
    NEW.verificado     := false;
    NEW.cobros_activos := false;
    RETURN NEW;
  END IF;

  IF NEW.comision       IS DISTINCT FROM OLD.comision
  OR NEW.es_founder     IS DISTINCT FROM OLD.es_founder
  OR NEW.founder_hasta  IS DISTINCT FROM OLD.founder_hasta
  OR NEW.tienda_activa  IS DISTINCT FROM OLD.tienda_activa
  OR NEW.verificado     IS DISTINCT FROM OLD.verificado
  OR NEW.cobros_activos IS DISTINCT FROM OLD.cobros_activos THEN
    RAISE EXCEPTION 'Solo un admin puede cambiar comision, es_founder, founder_hasta, tienda_activa, verificado o cobros_activos'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
