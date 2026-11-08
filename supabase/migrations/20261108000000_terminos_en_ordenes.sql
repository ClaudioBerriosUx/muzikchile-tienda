-- Aceptación de los términos para compradores en cada orden (commit 8a).
--
-- crear-preferencia exige que el comprador acepte la versión vigente
-- (VERSION_TERMINOS_COMPRADORES en lib/terminos.ts) y la guarda en cada línea
-- del pedido, con la hora del servidor. La confirmación de compra (art. 12 A,
-- commit 8b) lleva copia de esa versión.
--
-- Las órdenes anteriores quedan sin versión. Las dos columnas van juntas.
--
-- Solo agrega columnas nulas: compatible con el código actual. Se aplica ANTES
-- del deploy del código que las escribe.

ALTER TABLE public.ordenes
  ADD COLUMN terminos_version text,
  ADD COLUMN terminos_aceptados_at timestamptz,
  ADD CONSTRAINT ordenes_terminos_check
    CHECK ((terminos_version IS NULL) = (terminos_aceptados_at IS NULL));
