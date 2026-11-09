-- Cierra el hueco del WITH CHECK de publicaciones: la política del artista solo
-- limita artista_id y estado, así que al insertar podía escribir
-- comentario_moderacion, tipo (convocatoria, fecha_abierta), visibilidad,
-- fecha_cierre, ciudad y genero, y al editar un borrador o una devuelta, además
-- cambiar el slug (la URL pública).
--
-- Por qué un trigger y no permisos por columna como en tiendas: el admin modera
-- y escribe las editoriales desde el navegador con el mismo rol `authenticated`
-- que el artista (app/admin/publicaciones). Quitar columnas a authenticated
-- rompería la moderación. En tiendas funciona porque el admin escribe por Route
-- Handlers con service role. Es el mismo patrón que proteger_columnas_artista y
-- que publicaciones_fecha_publicacion (que ya protege fecha_publicacion).
--
-- Solo agrega: compatible con el código actual (el formulario del artista manda
-- tipo 'noticia' y visibilidad 'publica', y al editar no manda el slug).

CREATE FUNCTION public.proteger_columnas_publicacion()
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
  OR NEW.created_at            IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Solo un admin puede cambiar comentario_moderacion, tipo, visibilidad, fecha_cierre, ciudad, genero, slug o created_at'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.proteger_columnas_publicacion() FROM PUBLIC, anon, authenticated;

-- BEFORE, y por orden alfabético antes de publicaciones_fecha_publicacion y
-- publicaciones_set_updated_at: el nombre empieza con "proteger".
CREATE TRIGGER proteger_columnas_publicacion
  BEFORE INSERT OR UPDATE ON public.publicaciones
  FOR EACH ROW EXECUTE FUNCTION public.proteger_columnas_publicacion();
