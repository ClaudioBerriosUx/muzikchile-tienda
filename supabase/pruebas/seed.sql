-- Datos mínimos de la base de pruebas. NUNCA va en producción.
-- Lo agrega scripts/preparar-base-pruebas.mjs, al final de la carga.
--
-- Un volcado de esquema no trae filas, y estas existen en producción porque se
-- crearon a mano. Los tokens de MP son falsos: los pagos reales no se prueban acá.

INSERT INTO public.app_settings (key, value) VALUES
  ('cobro_modelo',       'centralizado'),
  ('marketplace_piloto', '[]'),
  ('comision_default',   '10'),
  ('mp_modo',            'sandbox'),
  ('mp_access_token',    'TEST-falso')
ON CONFLICT (key) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES
  ('artistas',     'artistas',     true),
  ('productos',    'productos',    true),
  ('noticias',     'noticias',     true),
  ('comprobantes', 'comprobantes', false)
ON CONFLICT (id) DO NOTHING;

-- El autor editorial que usan verificar:rls y /admin/publicaciones.
INSERT INTO public.artistas (nombre, slug, es_editorial, verificado)
VALUES ('MuzikChile', 'muzikchile', true, true)
ON CONFLICT (slug) DO NOTHING;
