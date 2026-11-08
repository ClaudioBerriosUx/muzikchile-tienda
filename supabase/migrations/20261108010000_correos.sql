-- Registro de correos transaccionales (commit 8b).
--
-- Una fila por correo: qué se mandó, a quién y cómo terminó. Sin el cuerpo.
-- La unicidad (tipo, referencia) hace que cada correo salga una sola vez,
-- aunque Mercado Pago repita el aviso o el cron lo reintente.
--
--   tipo         confirmacion_compra (al comprador, art. 12 A), nueva_venta (al
--                artista) y, desde el commit 8c, los de tienda.
--   referencia   confirmacion_compra: grupo_id. nueva_venta: grupo_id:artista_id.
--   estado       pendiente → enviado | fallido. buzon_local: fuera de
--                producción y sin RESEND_API_KEY, el correo se guarda en
--                supabase/.temp/correos/ en vez de enviarse (lo leen las pruebas).
--
-- Retención: 2 años (política de privacidad v1.1); la aplica /api/cron/correos.
-- Lectura: service role y admin (para ver en /admin/ordenes si salió la
-- confirmación). Escritura: solo service role.

CREATE TABLE public.correos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          text NOT NULL CONSTRAINT correos_tipo_check CHECK (tipo IN (
                  'confirmacion_compra', 'nueva_venta',
                  'tienda_solicitud', 'tienda_aprobada', 'tienda_devuelta', 'tienda_suspendida')),
  referencia    text NOT NULL,
  destinatario  text,
  estado        text NOT NULL DEFAULT 'pendiente'
                  CONSTRAINT correos_estado_check CHECK (estado IN ('pendiente', 'enviado', 'fallido', 'buzon_local')),
  intentos      smallint NOT NULL DEFAULT 0,
  resend_id     text,
  ultimo_error  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  enviado_at    timestamptz,
  CONSTRAINT correos_tipo_referencia_key UNIQUE (tipo, referencia)
);

CREATE INDEX correos_pendientes_idx ON public.correos (created_at) WHERE estado IN ('pendiente', 'fallido');

ALTER TABLE public.correos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.correos FROM anon, authenticated;
GRANT SELECT ON public.correos TO authenticated;

CREATE POLICY correos_select_admin ON public.correos
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));
