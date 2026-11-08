-- Devoluciones entre comprador y artista (commit 8d).
--
-- MuzikChile no gestiona los reembolsos: el comprador escribe primero al
-- artista, al correo de contacto de su tienda, y el artista reembolsa desde su
-- cuenta de Mercado Pago. MuzikChile queda como respaldo.
--
--   1. tiendas.contacto_email: correo de contacto para compradores (puede ser
--      distinto del de la cuenta). Lo edita el artista y entra al checklist:
--      sin él no se solicita ni se aprueba una tienda.
--   2. ordenes.vendedor_contacto: copia del correo al pagar, como la entrega
--      (lo informado al comprador queda fijo aunque el artista lo cambie).
--   3. ordenes.reembolso_*: motivo del reembolso de emergencia pedido por un
--      admin desde /admin/ordenes, con fecha y quién.
--   4. ordenes.reembolso_parcial_*: lo que MP informa como reembolsado de un
--      pago que sigue aprobado (p. ej. el artista devolvió un ítem desde su
--      panel). No revierte nada: se muestra en /admin/ordenes para revisar.
--
-- Solo agrega: columnas nulas y un ítem del checklist. Hoy ninguna tienda está
-- activa ni solicitada, así que el ítem nuevo no deja a nadie a medias. Se
-- aplica ANTES del deploy del código que las usa.

-- ── 1. Contacto de la tienda ─────────────────────────────────────────────────

ALTER TABLE public.tiendas
  ADD COLUMN contacto_email text
    CONSTRAINT tiendas_contacto_email_check CHECK (
      char_length(contacto_email) <= 254
      AND contacto_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    );

GRANT UPDATE (contacto_email) ON public.tiendas TO authenticated;

CREATE OR REPLACE FUNCTION public.checklist_tienda(p_artista_id uuid, p_version text)
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
    'identidad', t.identidad_mp_declarada AND a.cobros_activos,
    'mp', a.cobros_activos,
    'despacho', COALESCE(
      CASE t.despacho_modo
        WHEN 'envio'  THEN t.despacho_costo IS NOT NULL AND t.despacho_plazo_max IS NOT NULL
        WHEN 'retiro' THEN NULLIF(btrim(t.retiro_detalle), '') IS NOT NULL
        WHEN 'ambos'  THEN t.despacho_costo IS NOT NULL AND t.despacho_plazo_max IS NOT NULL
                           AND NULLIF(btrim(t.retiro_detalle), '') IS NOT NULL
      END, false),
    'contacto', t.contacto_email IS NOT NULL,
    'producto', EXISTS (
      SELECT 1 FROM public.productos p
      WHERE p.artista_id = t.artista_id AND p.estado = 'borrador'
    )
  )
  FROM public.tiendas t
  JOIN public.artistas a ON a.id = t.artista_id
  WHERE t.artista_id = p_artista_id;
$$;

-- ── 2 a 4. Órdenes ───────────────────────────────────────────────────────────

ALTER TABLE public.ordenes
  ADD COLUMN vendedor_contacto text,
  ADD COLUMN reembolso_motivo text
    CONSTRAINT ordenes_reembolso_motivo_check
    CHECK (reembolso_motivo IN ('retracto', 'defectuoso', 'no_despachado', 'otro')),
  ADD COLUMN reembolso_detalle text
    CONSTRAINT ordenes_reembolso_detalle_check CHECK (char_length(reembolso_detalle) <= 500),
  ADD COLUMN reembolso_pedido_at timestamptz,
  ADD COLUMN reembolso_pedido_por uuid,
  ADD COLUMN reembolso_parcial_monto numeric,
  ADD COLUMN reembolso_parcial_at timestamptz,
  ADD CONSTRAINT ordenes_reembolso_check CHECK (
    (reembolso_motivo IS NULL) = (reembolso_pedido_at IS NULL)
    AND (reembolso_motivo <> 'otro' OR NULLIF(btrim(reembolso_detalle), '') IS NOT NULL)
  ),
  ADD CONSTRAINT ordenes_reembolso_parcial_check CHECK (
    (reembolso_parcial_monto IS NULL) = (reembolso_parcial_at IS NULL)
    AND reembolso_parcial_monto > 0
  );
