-- 16-nov-2026 · (1) El Director quita un prospecto de campo (pruebas o errores): se archiva con motivo, no se borra,
-- y deja de contar para el pago. (2) Premios para el equipo con meta visible: el primero, una pantalla TCL de 65"
-- por 30 clientes de retiro con honorario cobrado, contados desde hoy, para asesores de pensiones.

ALTER TABLE public.campo_prospectos ADD COLUMN IF NOT EXISTS archivo_motivo text;
ALTER TABLE public.campo_prospectos ADD CONSTRAINT campo_prospectos_archivo_motivo
  CHECK (archivado_at IS NULL OR length(btrim(coalesce(archivo_motivo, ''))) >= 3);
GRANT UPDATE (archivo_motivo) ON public.campo_prospectos TO authenticated;

CREATE TABLE IF NOT EXISTS public.premios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL CHECK (length(btrim(nombre)) >= 3),
  descripcion text,
  meta integer NOT NULL CHECK (meta > 0),
  criterio text NOT NULL DEFAULT 'retiro_honorario_cobrado' CHECK (criterio IN ('retiro_honorario_cobrado')),
  participantes text NOT NULL DEFAULT 'socio' CHECK (participantes IN ('socio')),
  desde date NOT NULL,
  hasta date,
  activo boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  archivado_at timestamptz,
  CHECK (hasta IS NULL OR hasta >= desde)
);
ALTER TABLE public.premios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premios FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.premios FROM anon, authenticated;
GRANT SELECT ON public.premios TO authenticated;
GRANT INSERT (nombre, descripcion, meta, desde, hasta, activo) ON public.premios TO authenticated;
GRANT UPDATE (nombre, descripcion, meta, desde, hasta, activo, archivado_at) ON public.premios TO authenticated;
CREATE POLICY premios_sel ON public.premios FOR SELECT TO authenticated USING (app.rol() IS NOT NULL);
CREATE POLICY premios_ins ON public.premios FOR INSERT TO authenticated WITH CHECK (app.es('director'));
CREATE POLICY premios_upd ON public.premios FOR UPDATE TO authenticated USING (app.es('director')) WITH CHECK (app.es('director'));
CREATE TRIGGER tg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.premios FOR EACH ROW EXECUTE FUNCTION auditoria.tg_registrar();

INSERT INTO public.premios (nombre, descripcion, meta, desde)
SELECT 'Pantalla TCL de 65 pulgadas', 'Para el asesor de pensiones que llegue a 30 clientes de retiro con honorario cobrado.', 30, DATE '2026-11-16'
 WHERE NOT EXISTS (SELECT 1 FROM public.premios WHERE nombre = 'Pantalla TCL de 65 pulgadas');
