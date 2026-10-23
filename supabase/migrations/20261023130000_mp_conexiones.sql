-- Conexiones de Mercado Pago de los artistas (modelo marketplace, commit 2).
--
-- Cada artista autoriza a la aplicación de MuzikChile (OAuth con PKCE) y acá
-- queda su token, cifrado. Con él se crearán sus preferencias cuando el flag
-- app_settings.cobro_modelo pase a 'marketplace'. Mientras siga en
-- 'centralizado', nada de esto toca el cobro.
--
-- Compatible con el código anterior: se puede aplicar antes del deploy.

-- ── 1. Tabla ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mp_conexiones (
  artista_id            uuid PRIMARY KEY REFERENCES public.artistas (id) ON DELETE CASCADE,
  -- Una cuenta de MP cobra para un solo artista.
  mp_user_id            bigint NOT NULL UNIQUE,
  nickname              text,
  email                 text,
  -- AES-256-GCM en el servidor (lib/mp/cifrado.ts, llave MP_TOKENS_KEY). La
  -- base nunca ve el token en claro.
  access_token_cifrado  text NOT NULL,
  refresh_token_cifrado text NOT NULL,
  public_key            text,
  live_mode             boolean NOT NULL,
  scope                 text,
  expires_at            timestamptz NOT NULL,
  -- 'reconectar' = la renovación falló; el artista tiene que autorizar de nuevo.
  estado                text NOT NULL DEFAULT 'conectado'
                        CHECK (estado IN ('conectado', 'reconectar')),
  ultimo_error          text,
  -- Lock de renovación: el refresh_token rota en cada uso, así que dos
  -- renovaciones simultáneas se pisarían. Quien lo toma lo deja en el futuro.
  refrescando_hasta     timestamptz,
  conectado_at          timestamptz NOT NULL DEFAULT now(),
  refrescado_at         timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- RLS sin políticas: solo el service role (Route Handlers). El panel y el admin
-- ven el estado por endpoints que nunca devuelven tokens.
ALTER TABLE public.mp_conexiones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mp_conexiones FROM anon, authenticated;

-- ── 2. artistas.cobros_activos sigue a la conexión ───────────────────────────
-- true solo con una conexión en estado 'conectado'. Es lo que leerá la tienda
-- pública ("Pronto disponible") sin acceso a esta tabla.

CREATE OR REPLACE FUNCTION public.sincronizar_cobros_activos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.artistas SET cobros_activos = false WHERE id = OLD.artista_id;
    RETURN OLD;
  END IF;

  UPDATE public.artistas
  SET cobros_activos = (NEW.estado = 'conectado')
  WHERE id = NEW.artista_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_cobros_activos() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sincronizar_cobros_activos ON public.mp_conexiones;
CREATE TRIGGER sincronizar_cobros_activos
  AFTER INSERT OR UPDATE OF estado OR DELETE ON public.mp_conexiones
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_cobros_activos();

-- ── 3. Lock de renovación ────────────────────────────────────────────────────
-- Atómico y con el reloj de la base: true si este llamador quedó a cargo de
-- renovar el token del artista durante los próximos 2 minutos.

CREATE OR REPLACE FUNCTION public.tomar_lock_renovacion_mp(p_artista_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH tomado AS (
    UPDATE public.mp_conexiones
    SET refrescando_hasta = now() + interval '2 minutes'
    WHERE artista_id = p_artista_id
      AND (refrescando_hasta IS NULL OR refrescando_hasta < now())
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM tomado);
$$;

REVOKE ALL ON FUNCTION public.tomar_lock_renovacion_mp(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tomar_lock_renovacion_mp(uuid) TO service_role;

-- ── 4. Flag del modelo de cobro ──────────────────────────────────────────────
-- 'centralizado' = como hoy (todo entra a la cuenta de MuzikChile).
-- 'marketplace'  = cada artista cobra con su cuenta conectada (commit 3).

INSERT INTO public.app_settings (key, value)
VALUES ('cobro_modelo', 'centralizado')
ON CONFLICT (key) DO NOTHING;
