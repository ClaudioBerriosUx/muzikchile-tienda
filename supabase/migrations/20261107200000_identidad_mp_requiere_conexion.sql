-- La identidad de Mercado Pago se declara sobre una cuenta conectada.
--
-- Antes se podía declarar sin haber conectado nada, y la declaración seguía
-- valiendo después de desconectar, aunque la cuenta siguiente fuera otra.
--
--   1. Declararla exige artistas.cobros_activos (conexión en estado 'conectado'),
--      para cualquier rol. Quitarla siempre se puede.
--   2. Borrar la conexión borra la declaración: se declara cuenta por cuenta. Una
--      conexión en 'reconectar' la conserva, porque sigue siendo la misma cuenta.
--   3. El checklist solo la cuenta con la conexión activa.
--
-- No toca filas: la declaración sin conexión que quede guardada ya no cuenta en
-- el checklist, y se limpia aparte. Compatible con el código actual.

CREATE OR REPLACE FUNCTION public.tiendas_al_actualizar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.identidad_mp_declarada IS DISTINCT FROM OLD.identidad_mp_declarada THEN
    IF NEW.identidad_mp_declarada AND NOT EXISTS (
      SELECT 1 FROM public.artistas a
      WHERE a.id = NEW.artista_id AND a.cobros_activos
    ) THEN
      RAISE EXCEPTION 'Conecta tu cuenta de Mercado Pago antes de declarar tu identidad' USING ERRCODE = '22023';
    END IF;
    NEW.identidad_mp_declarada_at := CASE WHEN NEW.identidad_mp_declarada THEN now() END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sincronizar_cobros_activos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.artistas SET cobros_activos = false WHERE id = OLD.artista_id;
    UPDATE public.tiendas SET identidad_mp_declarada = false WHERE artista_id = OLD.artista_id;
    RETURN OLD;
  END IF;

  UPDATE public.artistas
  SET cobros_activos = (NEW.estado = 'conectado')
  WHERE id = NEW.artista_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.checklist_tienda(p_artista_id uuid, p_version text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'terminos', EXISTS (
      SELECT 1 FROM public.terminos_artistas ta
      WHERE ta.artista_id = t.artista_id AND ta.version = p_version
    ),
    'identidad', t.identidad_mp_declarada AND a.cobros_activos,
    'mp', a.cobros_activos,
    'despacho', COALESCE(
      CASE t.despacho_modo
        WHEN 'envio'  THEN t.despacho_costo IS NOT NULL AND t.despacho_plazo_max IS NOT NULL
        WHEN 'retiro' THEN NULLIF(btrim(t.retiro_detalle), '') IS NOT NULL
        WHEN 'ambos'  THEN t.despacho_costo IS NOT NULL AND t.despacho_plazo_max IS NOT NULL
                           AND NULLIF(btrim(t.retiro_detalle), '') IS NOT NULL
      END, false),
    'producto', EXISTS (
      SELECT 1 FROM public.productos p
      WHERE p.artista_id = t.artista_id AND p.estado = 'borrador'
    )
  )
  FROM public.tiendas t
  JOIN public.artistas a ON a.id = t.artista_id
  WHERE t.artista_id = p_artista_id;
$$;
