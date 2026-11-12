-- 12-nov-2026 · Trámite oficial asistido de la constancia de semanas (IMSS).
-- La persona del equipo pide la constancia en el portal del IMSS con el correo de la empresa; el IMSS responde a
-- ese buzón (Resend) y /api/correo/entrante (proceso del sistema, firma de Resend) liga la respuesta al caso.

-- 1) Solicitudes hechas desde el caso.
CREATE TABLE IF NOT EXISTS public.solicitudes_constancia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id uuid NOT NULL REFERENCES public.casos(id),
  persona_id uuid NOT NULL REFERENCES public.personas(id),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmar', 'recibida', 'cancelada')),
  liga_confirmacion text CHECK (liga_confirmacion IS NULL OR liga_confirmacion ~ '^https://([a-z0-9-]+\.)*imss\.gob\.mx(/|$)'),
  documento_id uuid REFERENCES public.documentos(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  archivado_at timestamptz
);
CREATE INDEX IF NOT EXISTS solicitudes_constancia_caso ON public.solicitudes_constancia (caso_id, created_at DESC);
CREATE INDEX IF NOT EXISTS solicitudes_constancia_vivas ON public.solicitudes_constancia (persona_id) WHERE estado IN ('pendiente', 'confirmar') AND archivado_at IS NULL;
ALTER TABLE public.solicitudes_constancia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_constancia FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.solicitudes_constancia FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.solicitudes_constancia TO authenticated;  -- sin DELETE
CREATE POLICY solicitudes_constancia_sel ON public.solicitudes_constancia FOR SELECT TO authenticated USING (app.caso_operable(caso_id));
CREATE POLICY solicitudes_constancia_ins ON public.solicitudes_constancia FOR INSERT TO authenticated
  WITH CHECK (app.caso_operable(caso_id) AND estado = 'pendiente' AND liga_confirmacion IS NULL AND documento_id IS NULL);
CREATE POLICY solicitudes_constancia_upd ON public.solicitudes_constancia FOR UPDATE TO authenticated
  USING (app.caso_operable(caso_id)) WITH CHECK (app.caso_operable(caso_id));
CREATE TRIGGER tg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.solicitudes_constancia
  FOR EACH ROW EXECUTE FUNCTION auditoria.tg_registrar();

-- 2) Correos recibidos en el buzón de constancias. Solo los escribe el sistema; el Director y el analista los ven
--    y asignan los que no se pudieron ligar a un cliente.
CREATE TABLE IF NOT EXISTS public.correos_entrantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id text NOT NULL UNIQUE,
  remitente text NOT NULL,
  asunto text,
  recibido_at timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL CHECK (tipo IN ('constancia', 'confirmacion', 'otro')),
  estado text NOT NULL CHECK (estado IN ('ligado', 'sin_caso', 'descartado')),
  detalle text,
  liga text CHECK (liga IS NULL OR liga ~ '^https://([a-z0-9-]+\.)*imss\.gob\.mx(/|$)'),
  caso_id uuid REFERENCES public.casos(id),
  solicitud_id uuid REFERENCES public.solicitudes_constancia(id),
  documento_id uuid REFERENCES public.documentos(id),
  asignado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archivado_at timestamptz
);
CREATE INDEX IF NOT EXISTS correos_entrantes_sin_caso ON public.correos_entrantes (recibido_at DESC) WHERE estado = 'sin_caso' AND archivado_at IS NULL;
ALTER TABLE public.correos_entrantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correos_entrantes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.correos_entrantes FROM anon, authenticated;
GRANT SELECT ON public.correos_entrantes TO authenticated;
GRANT UPDATE (estado, caso_id, solicitud_id, documento_id, asignado_por, archivado_at, updated_at) ON public.correos_entrantes TO authenticated;
CREATE POLICY correos_entrantes_sel ON public.correos_entrantes FOR SELECT TO authenticated USING (app.es('director', 'asesor'));
CREATE POLICY correos_entrantes_upd ON public.correos_entrantes FOR UPDATE TO authenticated
  USING (app.es('director', 'asesor')) WITH CHECK (app.es('director', 'asesor') AND (caso_id IS NULL OR app.caso_operable(caso_id)));
CREATE TRIGGER tg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.correos_entrantes
  FOR EACH ROW EXECUTE FUNCTION auditoria.tg_registrar();
