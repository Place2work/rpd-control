-- 11-nov-2026 · Referencias personales del cliente y documentos que ya no se piden.

-- 1) El retiro ya no pide «Certificación de baja del IMSS» ni «Comprobante de registro en Afore».
--    Nadie borra: se desactivan en el catálogo (dejan de mostrarse y de contar como obligatorios).
UPDATE public.tipos_documento SET activo = false
 WHERE nombre IN ('Certificación de baja del IMSS', 'Comprobante de registro en Afore');

-- 2) Dos referencias personales por cliente (van con la persona: sirven para cualquier servicio).
CREATE TABLE IF NOT EXISTS public.referencias_personales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.personas(id),
  orden smallint NOT NULL CHECK (orden IN (1, 2)),
  nombre text NOT NULL CHECK (length(btrim(nombre)) >= 2),
  telefono text,
  parentesco text,
  domicilio text,
  anios_conocerlo smallint CHECK (anios_conocerlo IS NULL OR anios_conocerlo BETWEEN 0 AND 100),
  notas text,
  confirmada_at timestamptz,
  confirmada_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  archivado_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS referencias_personales_orden_vivo
  ON public.referencias_personales (persona_id, orden) WHERE archivado_at IS NULL;
ALTER TABLE public.referencias_personales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referencias_personales FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.referencias_personales FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.referencias_personales TO authenticated;  -- sin DELETE: se archiva
CREATE POLICY referencias_sel ON public.referencias_personales FOR SELECT TO authenticated USING (app.persona_visible(persona_id));
CREATE POLICY referencias_ins ON public.referencias_personales FOR INSERT TO authenticated WITH CHECK (app.persona_visible(persona_id));
CREATE POLICY referencias_upd ON public.referencias_personales FOR UPDATE TO authenticated
  USING (app.persona_visible(persona_id)) WITH CHECK (app.persona_visible(persona_id));
CREATE TRIGGER tg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.referencias_personales
  FOR EACH ROW EXECUTE FUNCTION auditoria.tg_registrar();
