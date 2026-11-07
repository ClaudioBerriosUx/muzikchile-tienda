-- Freno de ventas del piloto (marcha blanca).
--
-- Durante el piloto se invita a artistas reales, pero no se abren ventas al
-- público hasta tener /terminos, el aviso de retracto en el checkout y el correo
-- de confirmación de compra. La regla vive en lib/ventas.ts:
--
--   ventas_abiertas              'true' abre las ventas. Cualquier otro valor, o
--                                la fila ausente, las deja cerradas.
--   ventas_correos_autorizados   lista JSON de correos que sí pueden comprar con
--                                las ventas cerradas: la compra controlada.
--
-- Solo agrega filas, y app_settings solo la lee un admin o el service role.
-- Compatible con el código actual: se puede aplicar antes del deploy.

INSERT INTO public.app_settings (key, value) VALUES
  ('ventas_abiertas', 'false'),
  ('ventas_correos_autorizados', '[]')
ON CONFLICT (key) DO NOTHING;
