-- Activación de tienda: la base (commit 2 del plan). Solo agrega: nada de lo que
-- ve el público cambia hasta el commit que exige tienda activa para vender.
--
--   1. artistas.cobro: cómo cobra CADA artista. app_settings.cobro_modelo es
--      global: aprobar a uno con ese flag pasaría a marketplace a todos.
--   2. tiendas (1:1 con artistas): estado de la solicitud, identidad de MP
--      declarada y despacho. Va aparte porque `artistas` tiene lectura pública
--      por filas: otro artista podría leer el comentario de moderación.
--   3. terminos_artistas: aceptaciones, solo se agregan filas. Una versión nueva
--      no borra la evidencia de la anterior.
--   4. Funciones para cada cambio de estado, solo service role: los Route
--      Handlers revisan la sesión y ponen la versión vigente de los términos.
--
-- El artista no puede activarse solo: `estado` no tiene permiso de escritura
-- para authenticated. Un WITH CHECK no alcanza acá: una tienda activa tiene que
-- poder editar su despacho, así que 'activa' tendría que estar permitido, y
-- entonces 'no_activa' → 'activa' también pasaría.
--
-- Todos los artistas actuales quedan en 'no_activa'. artistas.tienda_activa NO se
-- toca acá: hoy no frena ventas, y bajarla saca fichas del sitemap. Se alinea en
-- el commit que la vuelve obligatoria.
--
-- Compatible con el código actual: se puede aplicar antes del deploy.

-- ── 1. artistas.cobro ────────────────────────────────────────────────────────

ALTER TABLE public.artistas
  ADD COLUMN cobro text NOT NULL DEFAULT 'centralizado'
  CONSTRAINT artistas_cobro_check CHECK (cobro IN ('centralizado', 'marketplace'));

-- No es sensible, y la ficha de producto la lee con la anon key.
GRANT SELECT (cobro) ON public.artistas TO anon, authenticated;

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
    NEW.comision            := public.comision_por_defecto();
    NEW.es_founder          := false;
    NEW.founder_hasta       := NULL;
    NEW.tienda_activa       := false;
    NEW.verificado          := false;
    NEW.cobros_activos      := false;
    NEW.es_prueba           := false;
    NEW.baja_at             := NULL;
    NEW.datos_eliminados_at := NULL;
    NEW.cobro               := 'centralizado';
    RETURN NEW;
  END IF;

  IF NEW.comision            IS DISTINCT FROM OLD.comision
  OR NEW.es_founder          IS DISTINCT FROM OLD.es_founder
  OR NEW.founder_hasta       IS DISTINCT FROM OLD.founder_hasta
  OR NEW.tienda_activa       IS DISTINCT FROM OLD.tienda_activa
  OR NEW.verificado          IS DISTINCT FROM OLD.verificado
  OR NEW.cobros_activos      IS DISTINCT FROM OLD.cobros_activos
  OR NEW.es_prueba           IS DISTINCT FROM OLD.es_prueba
  OR NEW.baja_at             IS DISTINCT FROM OLD.baja_at
  OR NEW.datos_eliminados_at IS DISTINCT FROM OLD.datos_eliminados_at
  OR NEW.cobro               IS DISTINCT FROM OLD.cobro THEN
    RAISE EXCEPTION 'Solo un admin puede cambiar comision, es_founder, founder_hasta, tienda_activa, verificado, cobros_activos, es_prueba, cobro o la baja'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. tiendas ───────────────────────────────────────────────────────────────

CREATE TABLE public.tiendas (
  artista_id                uuid PRIMARY KEY REFERENCES public.artistas(id) ON DELETE CASCADE,
  estado                    text NOT NULL DEFAULT 'no_activa'
    CONSTRAINT tiendas_estado_check
    CHECK (estado IN ('no_activa', 'solicitada', 'devuelta', 'activa', 'suspendida')),
  comentario_moderacion     text,
  identidad_mp_declarada    boolean NOT NULL DEFAULT false,
  identidad_mp_declarada_at timestamptz,
  despacho_modo             text
    CONSTRAINT tiendas_despacho_modo_check CHECK (despacho_modo IN ('envio', 'retiro', 'ambos')),
  despacho_costo            integer CONSTRAINT tiendas_despacho_costo_check CHECK (despacho_costo >= 0),
  despacho_plazo_min        smallint,
  despacho_plazo_max        smallint,
  retiro_detalle            text CONSTRAINT tiendas_retiro_detalle_check CHECK (char_length(retiro_detalle) <= 300),
  solicitada_at             timestamptz,
  resuelta_at               timestamptz,
  resuelta_por              uuid,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tiendas_despacho_plazo_check CHECK (
    despacho_plazo_min >= 0 AND despacho_plazo_max >= despacho_plazo_min
  )
);

CREATE INDEX idx_tiendas_estado ON public.tiendas (estado);

ALTER TABLE public.tiendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY tiendas_select_propia ON public.tiendas
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.artistas a
    WHERE a.id = tiendas.artista_id AND a.user_id = auth.uid()
  ));

CREATE POLICY tiendas_select_admin ON public.tiendas
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Solo decide QUÉ FILA. QUÉ COLUMNAS lo deciden los permisos de abajo.
CREATE POLICY tiendas_update_propia ON public.tiendas
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.artistas a
    WHERE a.id = tiendas.artista_id AND a.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.artistas a
    WHERE a.id = tiendas.artista_id AND a.user_id = auth.uid()
  ));

-- Sin INSERT ni DELETE: la fila la crea el trigger y se va con el artista.
-- El REVOKE hace falta: Supabase da todo a anon y authenticated por defecto.
REVOKE ALL ON public.tiendas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tiendas TO authenticated;
GRANT UPDATE (
  identidad_mp_declarada, despacho_modo, despacho_costo,
  despacho_plazo_min, despacho_plazo_max, retiro_detalle
) ON public.tiendas TO authenticated;

-- La fecha de la declaración la pone la base, no el navegador.
CREATE FUNCTION public.tiendas_al_actualizar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.identidad_mp_declarada IS DISTINCT FROM OLD.identidad_mp_declarada THEN
    NEW.identidad_mp_declarada_at := CASE WHEN NEW.identidad_mp_declarada THEN now() END;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tiendas_al_actualizar() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tiendas_al_actualizar
  BEFORE UPDATE ON public.tiendas
  FOR EACH ROW EXECUTE FUNCTION public.tiendas_al_actualizar();

-- Cada artista nace con su fila. SECURITY DEFINER: el alta la hace el artista,
-- que no tiene permiso de INSERT en tiendas.
CREATE FUNCTION public.crear_tienda_de_artista()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.tiendas (artista_id) VALUES (NEW.id) ON CONFLICT (artista_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.crear_tienda_de_artista() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER crear_tienda_de_artista
  AFTER INSERT ON public.artistas
  FOR EACH ROW EXECUTE FUNCTION public.crear_tienda_de_artista();

INSERT INTO public.tiendas (artista_id) SELECT id FROM public.artistas;

-- ── 3. terminos_artistas ─────────────────────────────────────────────────────

CREATE TABLE public.terminos_artistas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artista_id  uuid NOT NULL REFERENCES public.artistas(id) ON DELETE CASCADE,
  version     text NOT NULL,
  aceptado_at timestamptz NOT NULL DEFAULT now(),
  aceptado_por uuid NOT NULL,
  CONSTRAINT terminos_artistas_unica UNIQUE (artista_id, version)
);

ALTER TABLE public.terminos_artistas ENABLE ROW LEVEL SECURITY;

CREATE POLICY terminos_select_propios ON public.terminos_artistas
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.artistas a
    WHERE a.id = terminos_artistas.artista_id AND a.user_id = auth.uid()
  ));

CREATE POLICY terminos_select_admin ON public.terminos_artistas
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON public.terminos_artistas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.terminos_artistas TO authenticated;

-- ── 4. Cambios de estado ─────────────────────────────────────────────────────
-- Solo service role. La versión vigente de los términos vive en el código, y la
-- pone el Route Handler: nunca sale del navegador.
--
--   no_activa | devuelta   → solicitada   solicitar_tienda (artista, checklist)
--   solicitada             → devuelta     devolver_tienda (admin, con comentario)
--   solicitada | suspendida → activa      aprobar_tienda (admin)
--   activa                 → suspendida   suspender_tienda (admin, con motivo)

CREATE FUNCTION public.checklist_tienda(p_artista_id uuid, p_version text)
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
    'identidad', t.identidad_mp_declarada,
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

CREATE FUNCTION public.aceptar_terminos_artista(p_artista_id uuid, p_user_id uuid, p_version text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_aceptado timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.artistas WHERE id = p_artista_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Ese artista no es de este usuario' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.terminos_artistas (artista_id, version, aceptado_por)
  VALUES (p_artista_id, p_version, p_user_id)
  ON CONFLICT (artista_id, version) DO NOTHING;

  -- Aceptar dos veces no mueve la fecha: vale la primera.
  SELECT aceptado_at INTO v_aceptado
  FROM public.terminos_artistas
  WHERE artista_id = p_artista_id AND version = p_version;
  RETURN v_aceptado;
END;
$$;

CREATE FUNCTION public.solicitar_tienda(p_artista_id uuid, p_version text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_estado text;
  v_faltan text;
BEGIN
  SELECT estado INTO v_estado FROM public.tiendas WHERE artista_id = p_artista_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tienda no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_estado NOT IN ('no_activa', 'devuelta') THEN
    RAISE EXCEPTION 'Una tienda en estado % no puede solicitar activación', v_estado USING ERRCODE = '22023';
  END IF;

  SELECT string_agg(item.key, ', ' ORDER BY item.key) INTO v_faltan
  FROM jsonb_each_text(public.checklist_tienda(p_artista_id, p_version)) AS item
  WHERE item.value = 'false';
  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Checklist incompleto: %', v_faltan USING ERRCODE = '22023';
  END IF;

  UPDATE public.tiendas
  SET estado = 'solicitada', solicitada_at = now(), comentario_moderacion = NULL
  WHERE artista_id = p_artista_id;
  RETURN 'solicitada';
END;
$$;

CREATE FUNCTION public.aprobar_tienda(p_artista_id uuid, p_admin uuid, p_version text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_estado text;
  v_faltan text;
BEGIN
  IF NOT public.has_role(p_admin, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un admin puede aprobar una tienda' USING ERRCODE = '42501';
  END IF;

  SELECT estado INTO v_estado FROM public.tiendas WHERE artista_id = p_artista_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tienda no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_estado NOT IN ('solicitada', 'suspendida') THEN
    RAISE EXCEPTION 'Una tienda en estado % no se puede aprobar', v_estado USING ERRCODE = '22023';
  END IF;

  -- Lo que pudo cambiar desde la solicitud: si desconectó MP, no se aprueba. Al
  -- reactivar una suspendida no se exige un borrador: sus productos ya existen.
  SELECT string_agg(item.key, ', ' ORDER BY item.key) INTO v_faltan
  FROM jsonb_each_text(public.checklist_tienda(p_artista_id, p_version)) AS item
  WHERE item.value = 'false' AND (v_estado = 'solicitada' OR item.key <> 'producto');
  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Checklist incompleto: %', v_faltan USING ERRCODE = '22023';
  END IF;

  UPDATE public.tiendas
  SET estado = 'activa', comentario_moderacion = NULL, resuelta_at = now(), resuelta_por = p_admin
  WHERE artista_id = p_artista_id;

  UPDATE public.artistas
  SET tienda_activa = true, cobro = 'marketplace'
  WHERE id = p_artista_id;

  -- Aprobar no publica: los borradores van a la moderación normal, sin que el
  -- artista los reenvíe. Al reactivar no: un borrador nuevo es del artista.
  IF v_estado = 'solicitada' THEN
    UPDATE public.productos SET estado = 'en_revision'
    WHERE artista_id = p_artista_id AND estado = 'borrador';
  END IF;

  RETURN 'activa';
END;
$$;

CREATE FUNCTION public.devolver_tienda(p_artista_id uuid, p_admin uuid, p_comentario text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_estado text;
BEGIN
  IF NOT public.has_role(p_admin, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un admin puede devolver una solicitud' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_comentario), '') IS NULL THEN
    RAISE EXCEPTION 'Devolver una solicitud exige un comentario' USING ERRCODE = '22023';
  END IF;

  SELECT estado INTO v_estado FROM public.tiendas WHERE artista_id = p_artista_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tienda no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_estado <> 'solicitada' THEN
    RAISE EXCEPTION 'Una tienda en estado % no se puede devolver', v_estado USING ERRCODE = '22023';
  END IF;

  UPDATE public.tiendas
  SET estado = 'devuelta', comentario_moderacion = btrim(p_comentario), resuelta_at = now(), resuelta_por = p_admin
  WHERE artista_id = p_artista_id;
  RETURN 'devuelta';
END;
$$;

-- cobro no vuelve a 'centralizado': una tienda suspendida no vende, y al
-- reactivarla no puede terminar cobrando a la cuenta de MuzikChile.
CREATE FUNCTION public.suspender_tienda(p_artista_id uuid, p_admin uuid, p_motivo text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_estado text;
BEGIN
  IF NOT public.has_role(p_admin, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un admin puede suspender una tienda' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_motivo), '') IS NULL THEN
    RAISE EXCEPTION 'Suspender una tienda exige un motivo' USING ERRCODE = '22023';
  END IF;

  SELECT estado INTO v_estado FROM public.tiendas WHERE artista_id = p_artista_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tienda no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_estado <> 'activa' THEN
    RAISE EXCEPTION 'Una tienda en estado % no se puede suspender', v_estado USING ERRCODE = '22023';
  END IF;

  UPDATE public.tiendas
  SET estado = 'suspendida', comentario_moderacion = btrim(p_motivo), resuelta_at = now(), resuelta_por = p_admin
  WHERE artista_id = p_artista_id;
  UPDATE public.artistas SET tienda_activa = false WHERE id = p_artista_id;
  RETURN 'suspendida';
END;
$$;

REVOKE ALL ON FUNCTION public.checklist_tienda(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aceptar_terminos_artista(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.solicitar_tienda(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aprobar_tienda(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.devolver_tienda(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.suspender_tienda(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.checklist_tienda(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.aceptar_terminos_artista(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.solicitar_tienda(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.aprobar_tienda(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.devolver_tienda(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.suspender_tienda(uuid, uuid, text) TO service_role;

-- ── La baja también apaga la tienda ──────────────────────────────────────────
-- Igual que 20261026030000, más la fila de tiendas. Revertir la baja sigue sin
-- reactivar nada: la tienda queda suspendida hasta que un admin la apruebe.

CREATE OR REPLACE FUNCTION public.dar_de_baja_artista(p_artista_id uuid, p_revertir boolean DEFAULT false)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_baja timestamptz;
  v_eliminados timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un admin puede dar de baja una cuenta' USING ERRCODE = '42501';
  END IF;

  SELECT baja_at, datos_eliminados_at INTO v_baja, v_eliminados
  FROM public.artistas WHERE id = p_artista_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Artista no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF p_revertir THEN
    IF v_eliminados IS NOT NULL THEN
      RAISE EXCEPTION 'Los datos de esta cuenta ya se eliminaron: no se puede revertir la baja' USING ERRCODE = '22023';
    END IF;
    UPDATE public.artistas SET baja_at = NULL WHERE id = p_artista_id;
    UPDATE public.productos SET estado = 'aprobado' WHERE artista_id = p_artista_id AND estado = 'pausado';
    RETURN NULL;
  END IF;

  UPDATE public.artistas
     SET baja_at = COALESCE(baja_at, now()), tienda_activa = false
   WHERE id = p_artista_id
  RETURNING baja_at INTO v_baja;
  UPDATE public.productos SET estado = 'pausado' WHERE artista_id = p_artista_id AND estado = 'aprobado';

  UPDATE public.tiendas
     SET estado = 'suspendida', comentario_moderacion = 'Baja de la cuenta', resuelta_at = now(), resuelta_por = auth.uid()
   WHERE artista_id = p_artista_id AND estado = 'activa';
  UPDATE public.tiendas
     SET estado = 'devuelta', comentario_moderacion = 'Baja de la cuenta', resuelta_at = now(), resuelta_por = auth.uid()
   WHERE artista_id = p_artista_id AND estado = 'solicitada';

  RETURN v_baja;
END;
$$;

REVOKE ALL ON FUNCTION public.dar_de_baja_artista(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dar_de_baja_artista(uuid, boolean) TO authenticated;
