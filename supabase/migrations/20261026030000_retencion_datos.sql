-- Plazos de conservación (política de privacidad, sección 6).
--
--   · Órdenes: 6 años desde la compra; después se anonimizan (sin nombre,
--     email ni dirección; quedan montos, productos y fechas).
--   · Cuenta de artista: mientras esté activa y hasta 1 año después de su baja
--     (`baja_at`, la marca un admin). Pasado ese plazo se borran RUT, datos
--     bancarios, perfil y foto, y el usuario de Auth (eso último lo hace
--     /api/cron/retencion: SQL no borra bien usuarios ni archivos de Storage).
--     El nombre queda, por las órdenes y liquidaciones históricas. Sus
--     productos quedan ocultos (estado 'pausado'), no se borran.
--   · Conexión de MP en 'reconectar' sin cambios en 90 días: se borra.
--   · Comprobantes de liquidación: 6 años. Esta función solo los LISTA; el
--     cron borra el archivo y después limpia comprobante_url.
--
-- aplicar_retencion(true) solo cuenta (lo usa verificar:retencion y el cron
-- para listar); aplicar_retencion(false) aplica. Solo service role.


-- ── Columnas de la baja ──────────────────────────────────────────────────────

alter table public.artistas
  add column if not exists baja_at timestamptz,
  add column if not exists datos_eliminados_at timestamptz;

comment on column public.artistas.baja_at is
  'Baja de la cuenta, marcada por un admin (dar_de_baja_artista). Al año se eliminan los datos personales.';
comment on column public.artistas.datos_eliminados_at is
  'Cuándo aplicar_retencion() eliminó los datos personales de la cuenta dada de baja.';

-- artistas tiene grants por columna: sin esto el admin no las puede leer.
grant select (baja_at, datos_eliminados_at) on public.artistas to authenticated;


-- ── Solo un admin cambia la baja (mismo trigger que comision, es_prueba…) ────

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
  OR NEW.datos_eliminados_at IS DISTINCT FROM OLD.datos_eliminados_at THEN
    RAISE EXCEPTION 'Solo un admin puede cambiar comision, es_founder, founder_hasta, tienda_activa, verificado, cobros_activos, es_prueba o la baja'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;


-- ── Dar de baja / revertir (botón del admin) ─────────────────────────────────
-- Baja: marca baja_at (si ya estaba, la conserva), apaga la tienda y pausa
-- los productos aprobados. Revertir: solo mientras los datos no se hayan
-- eliminado; reaprueba lo que la baja pausó. La tienda no se reactiva sola.

create or replace function public.dar_de_baja_artista(p_artista_id uuid, p_revertir boolean default false)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_baja timestamptz;
  v_eliminados timestamptz;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Solo un admin puede dar de baja una cuenta' using errcode = '42501';
  end if;

  select baja_at, datos_eliminados_at into v_baja, v_eliminados
  from public.artistas where id = p_artista_id for update;
  if not found then
    raise exception 'Artista no encontrado' using errcode = 'P0002';
  end if;

  if p_revertir then
    if v_eliminados is not null then
      raise exception 'Los datos de esta cuenta ya se eliminaron: no se puede revertir la baja' using errcode = '22023';
    end if;
    update public.artistas set baja_at = null where id = p_artista_id;
    update public.productos set estado = 'aprobado' where artista_id = p_artista_id and estado = 'pausado';
    return null;
  end if;

  update public.artistas
     set baja_at = coalesce(baja_at, now()), tienda_activa = false
   where id = p_artista_id
  returning baja_at into v_baja;
  update public.productos set estado = 'pausado' where artista_id = p_artista_id and estado = 'aprobado';
  return v_baja;
end;
$$;

revoke all on function public.dar_de_baja_artista(uuid, boolean) from public, anon;
grant execute on function public.dar_de_baja_artista(uuid, boolean) to authenticated;


-- ── aplicar_retencion ────────────────────────────────────────────────────────

create or replace function public.aplicar_retencion(p_simular boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ordenes   int;
  v_conexiones int;
  v_artistas  jsonb;
  v_comprob   jsonb;
begin
  select count(*) into v_ordenes
  from public.ordenes
  where created_at < now() - interval '6 years'
    and comprador_email <> 'anonimizado@invalid';

  select count(*) into v_conexiones
  from public.mp_conexiones
  where estado = 'reconectar' and updated_at < now() - interval '90 days';

  -- Lo que el cron necesita para borrar el usuario de Auth y las fotos.
  select coalesce(jsonb_agg(jsonb_build_object('artista_id', id, 'user_id', user_id, 'foto_url', foto_url)), '[]'::jsonb)
    into v_artistas
  from public.artistas
  where baja_at < now() - interval '1 year' and datos_eliminados_at is null;

  select coalesce(jsonb_agg(jsonb_build_object('liquidacion_id', id, 'ruta', comprobante_url)), '[]'::jsonb)
    into v_comprob
  from public.liquidaciones
  where comprobante_url is not null
    and coalesce(fecha_transferencia::timestamptz, created_at) < now() - interval '6 years';

  if not p_simular then
    update public.ordenes
       set comprador_nombre    = 'Anonimizado',
           comprador_email     = 'anonimizado@invalid',
           comprador_direccion = '{}'::jsonb,
           direccion_envio     = null,
           ciudad_envio        = null,
           region_envio        = null
     where created_at < now() - interval '6 years'
       and comprador_email <> 'anonimizado@invalid';

    delete from public.mp_conexiones
     where estado = 'reconectar' and updated_at < now() - interval '90 days';

    delete from public.mp_conexiones
     where artista_id in (
       select id from public.artistas
       where baja_at < now() - interval '1 year' and datos_eliminados_at is null
     );

    update public.artistas
       set rut = null, banco = null, cuenta_bancaria = null, tipo_cuenta = null,
           bio = null, bio_completa = null, ciudad = null, region = null, generos = null,
           redes = '{}'::jsonb, foto_url = null,
           instagram_url = null, spotify_url = null, spotify_id = null, youtube_url = null,
           tiktok_url = null, soundcloud_url = null, seo_titulo = null, seo_descripcion = null,
           tienda_activa = false,
           user_id = null,
           datos_eliminados_at = now()
     where baja_at < now() - interval '1 year' and datos_eliminados_at is null;
  end if;

  return jsonb_build_object(
    'simulado', p_simular,
    'ordenes_anonimizadas', v_ordenes,
    'conexiones_borradas', v_conexiones,
    'artistas', v_artistas,
    'comprobantes', v_comprob
  );
end;
$$;

revoke all on function public.aplicar_retencion(boolean) from public, anon, authenticated;
grant execute on function public.aplicar_retencion(boolean) to service_role;
