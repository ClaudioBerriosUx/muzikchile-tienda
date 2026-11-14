-- Noticia destacada en la portada: el admin fija una nota arriba de "Últimas
-- noticias" (app/(publico)/_portada/UltimasNoticias.tsx) y se queda ahí aunque
-- se publiquen notas nuevas. Sin destacada, la portada sigue mostrando la
-- editorial más reciente.
--
-- Solo agrega: la columna nace en false para todas las filas, y el código
-- actual no la lee ni la escribe.

ALTER TABLE public.publicaciones
  ADD COLUMN destacada boolean NOT NULL DEFAULT false;

-- Una sola destacada a la vez.
CREATE UNIQUE INDEX publicaciones_una_destacada
  ON public.publicaciones ((true))
  WHERE destacada;


-- ── El artista no la escribe ────────────────────────────────────────────────
-- Mismo cuerpo que en 20261108040000, más `destacada`.

CREATE OR REPLACE FUNCTION public.proteger_columnas_publicacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Solo los roles de la API pública; service role y migraciones pasan.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Lo que mande el artista en estas columnas se ignora.
    NEW.comentario_moderacion := NULL;
    NEW.tipo                  := 'noticia';
    NEW.visibilidad           := 'publica';
    NEW.fecha_cierre          := NULL;
    NEW.ciudad                := NULL;
    NEW.genero                := NULL;
    NEW.destacada             := false;
    NEW.created_at            := now();
    NEW.updated_at            := now();
    RETURN NEW;
  END IF;

  IF NEW.comentario_moderacion IS DISTINCT FROM OLD.comentario_moderacion
  OR NEW.tipo                  IS DISTINCT FROM OLD.tipo
  OR NEW.visibilidad           IS DISTINCT FROM OLD.visibilidad
  OR NEW.fecha_cierre          IS DISTINCT FROM OLD.fecha_cierre
  OR NEW.ciudad                IS DISTINCT FROM OLD.ciudad
  OR NEW.genero                IS DISTINCT FROM OLD.genero
  OR NEW.slug                  IS DISTINCT FROM OLD.slug
  OR NEW.destacada             IS DISTINCT FROM OLD.destacada
  OR NEW.created_at            IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Solo un admin puede cambiar comentario_moderacion, tipo, visibilidad, fecha_cierre, ciudad, genero, slug, destacada o created_at'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.proteger_columnas_publicacion() FROM PUBLIC, anon, authenticated;


-- ── Una nota que deja de ser pública deja de estar destacada ────────────────
-- Despublicar, devolver o cambiar visibilidad o tipo, venga de donde venga
-- (admin, service role o migración), desmarca la nota. Borrarla no necesita
-- nada: la marca se va con la fila.
--
-- Por orden alfabético corre después de proteger_columnas_publicacion ("pro" <
-- "pub"): el RAISE de un no-admin no ve este cambio.

CREATE FUNCTION public.publicaciones_quitar_destacada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.destacada AND (
       NEW.estado::text      <> 'publicada'
    OR NEW.visibilidad::text <> 'publica'
    OR NEW.tipo::text        <> 'noticia'
  ) THEN
    NEW.destacada := false;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.publicaciones_quitar_destacada() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER publicaciones_quitar_destacada
  BEFORE INSERT OR UPDATE ON public.publicaciones
  FOR EACH ROW EXECUTE FUNCTION public.publicaciones_quitar_destacada();


-- ── destacar_publicacion(p_id): el admin elige la destacada ─────────────────
-- Desmarca la actual y marca p_id en una sola transacción. p_id null (o sin
-- argumento) = quitar la destacada.
--
-- Solo acepta una nota publicada + publica + noticia de un artista que no sea
-- de prueba: es lo que muestra la portada (traerNoticiaDestacada en
-- lib/noticias.ts). Una de prueba no saldría, y el badge del admin mentiría.
--
-- SECURITY INVOKER: corre con los permisos del admin, que ya puede editar
-- publicaciones (publicaciones_update_admin). El has_role es para responder un
-- 42501 claro a quien no lo es.
--
-- Dos admins destacando a la vez: el segundo choca con el índice único (23505).

CREATE FUNCTION public.destacar_publicacion(p_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_estado      text;
  v_visibilidad text;
  v_tipo        text;
  v_prueba      boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un admin puede destacar una noticia' USING ERRCODE = '42501';
  END IF;

  IF p_id IS NOT NULL THEN
    SELECT p.estado::text, p.visibilidad::text, p.tipo::text, a.es_prueba
      INTO v_estado, v_visibilidad, v_tipo, v_prueba
    FROM public.publicaciones p
    JOIN public.artistas a ON a.id = p.artista_id
    WHERE p.id = p_id
    FOR UPDATE OF p;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Publicación no encontrada' USING ERRCODE = 'P0002';
    END IF;
    IF v_estado <> 'publicada' OR v_visibilidad <> 'publica' OR v_tipo <> 'noticia' THEN
      RAISE EXCEPTION 'Solo se puede destacar una noticia publicada y pública' USING ERRCODE = '22023';
    END IF;
    IF v_prueba THEN
      RAISE EXCEPTION 'No se puede destacar una nota de un artista de prueba: la portada no la muestra' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.publicaciones
     SET destacada = false
   WHERE destacada AND id IS DISTINCT FROM p_id;

  IF p_id IS NOT NULL THEN
    UPDATE public.publicaciones
       SET destacada = true
     WHERE id = p_id AND NOT destacada;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.destacar_publicacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.destacar_publicacion(uuid) TO authenticated;
