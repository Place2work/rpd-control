-- Quien da de alta a una persona la ve de inmediato.
-- app.persona_visible() es STABLE y no ve la fila que el mismo INSERT acaba de crear,
-- así que el INSERT ... RETURNING de un vendedor fallaba. Se agrega una política (las
-- políticas permisivas se suman con OR) en lugar de reemplazar la existente.
CREATE POLICY personas_sel_propias ON public.personas FOR SELECT TO authenticated
  USING (app.rol() IS NOT NULL AND owner_id = auth.uid());
