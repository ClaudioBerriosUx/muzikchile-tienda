-- Artistas de prueba (commit 3a del marketplace de MP).
--
-- artistas.es_prueba marca un perfil que existe solo para probar (hoy, Valentina
-- Ruz: la cuenta conectada a un vendedor de prueba de MP). Un artista de prueba
-- no aparece en /tienda, en las noticias, en el sitemap ni en las métricas del
-- admin; su ficha y sus productos se abren solo por URL directa, con noindex.
-- Los filtros viven en el código (lib/noticias.ts, /tienda, sitemap, /admin):
-- esto no es una regla de acceso, solo de visibilidad.
--
-- Solo un admin la cambia (trigger proteger_columnas_artista).
--
-- Compatible con el código anterior: se puede aplicar antes del deploy.

ALTER TABLE public.artistas
  ADD COLUMN IF NOT EXISTS es_prueba boolean NOT NULL DEFAULT false;

-- La columna no es sensible, y los filtros públicos (anon) la necesitan:
-- artistas tiene grants por columna, así que sin esto fallan con 42501.
GRANT SELECT (es_prueba) ON public.artistas TO anon, authenticated;

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
    NEW.es_prueba      := false;
    RETURN NEW;
  END IF;

  IF NEW.comision       IS DISTINCT FROM OLD.comision
  OR NEW.es_founder     IS DISTINCT FROM OLD.es_founder
  OR NEW.founder_hasta  IS DISTINCT FROM OLD.founder_hasta
  OR NEW.tienda_activa  IS DISTINCT FROM OLD.tienda_activa
  OR NEW.verificado     IS DISTINCT FROM OLD.verificado
  OR NEW.cobros_activos IS DISTINCT FROM OLD.cobros_activos
  OR NEW.es_prueba      IS DISTINCT FROM OLD.es_prueba THEN
    RAISE EXCEPTION 'Solo un admin puede cambiar comision, es_founder, founder_hasta, tienda_activa, verificado, cobros_activos o es_prueba'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
