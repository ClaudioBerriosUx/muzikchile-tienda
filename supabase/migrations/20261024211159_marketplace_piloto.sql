-- Cobro marketplace en piloto (commit 3b del marketplace de MP).
--
--   1. ordenes.cobro: cómo se cobró la orden. 'centralizado' = entró a la
--      cuenta de MuzikChile y se le liquida al artista; 'marketplace' = el
--      artista la cobró directo con su cuenta de MP (MuzikChile recibió su
--      comisión como marketplace_fee) y NO entra en liquidaciones.
--      ordenes.mp_collector_id: la cuenta de MP que cobró (marketplace), para
--      que el webhook verifique que el pago es de ese vendedor.
--   2. app_settings.marketplace_piloto: lista JSON de artista_id que cobran en
--      modo marketplace aunque cobro_modelo siga en 'centralizado'. La regla
--      vive en lib/cobro.ts. Vacía = todo centralizado, igual que antes.
--
-- Compatible con el código anterior: se puede aplicar antes del deploy (las
-- órdenes existentes y las que inserte el código viejo quedan 'centralizado').

ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS cobro text NOT NULL DEFAULT 'centralizado',
  ADD COLUMN IF NOT EXISTS mp_collector_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ordenes_cobro_check') THEN
    ALTER TABLE public.ordenes
      ADD CONSTRAINT ordenes_cobro_check CHECK (cobro IN ('centralizado', 'marketplace'));
  END IF;
END $$;

INSERT INTO public.app_settings (key, value)
VALUES ('marketplace_piloto', '[]')
ON CONFLICT (key) DO NOTHING;
