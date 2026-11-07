-- Datos mínimos de la base de pruebas. NUNCA va en producción.
-- Lo agrega scripts/preparar-base-pruebas.mjs, al final de la carga.
-- Se puede volver a correr: no duplica ni pisa datos de pruebas.
--
-- Un volcado de esquema no trae filas, y estas existen en producción porque se
-- crearon a mano o en migraciones ya incluidas. Los tokens de MP son falsos: los
-- pagos reales no se prueban acá. Los buckets copian la configuración de
-- producción (2026-11-07): límites de tamaño y tipos incluidos.

INSERT INTO public.app_settings (key, value) VALUES
  ('cobro_modelo',       'centralizado'),
  ('marketplace_piloto', '[]'),
  ('comision_default',   '10'),
  ('mp_modo',            'sandbox'),
  ('mp_access_token',    'TEST-falso')
ON CONFLICT (key) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('artistas',     'artistas',     true,  NULL,     NULL),
  ('productos',    'productos',    true,  NULL,     NULL),
  ('noticias',     'noticias',     true,  5242880,  ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('comprobantes', 'comprobantes', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- El autor editorial que usan verificar:rls y /admin/publicaciones.
INSERT INTO public.artistas (nombre, slug, es_editorial, verificado)
VALUES ('MuzikChile', 'muzikchile', true, true)
ON CONFLICT (slug) DO NOTHING;

-- Para probar el formulario de productos. Digital existe en producción, pero el
-- formulario la oculta: por ahora solo se venden productos físicos.
INSERT INTO public.categorias (nombre, slug, orden) VALUES
  ('Merch',   'merch',   1),
  ('Digital', 'digital', 2)
ON CONFLICT (slug) DO NOTHING;

-- A diferencia de producción, acá las ventas quedan abiertas: verificar:cobro
-- crea preferencias. verificar:tienda prueba el freno y deja esto como estaba.
INSERT INTO public.app_settings (key, value) VALUES ('ventas_abiertas', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
