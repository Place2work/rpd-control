-- Fase 3: dinero y comisiones (secciones 2.2, 5.8 y 9). Solo agrega; no borra nada.

-- Cada comisión lleva una clave estable dentro de su caso ("vendedor:pago:2", "socio:cobro:<id>",
-- "referido"...) para que el motor pueda recalcular sin duplicar. Las canceladas no estorban.
ALTER TABLE public.comisiones ADD COLUMN IF NOT EXISTS clave text;
CREATE UNIQUE INDEX IF NOT EXISTS comisiones_caso_clave_viva
  ON public.comisiones (caso_id, clave) WHERE estado <> 'cancelada' AND archivado_at IS NULL;
CREATE INDEX IF NOT EXISTS comisiones_estado_devengo ON public.comisiones (estado, fecha_devengo);

-- Concepto del cobro en servicios con varios componentes (fallecimiento: pago_inicial,
-- recuperado, primera_mensualidad) y motivo cuando se cancela.
ALTER TABLE public.cobros ADD COLUMN IF NOT EXISTS concepto text;
ALTER TABLE public.cobros ADD COLUMN IF NOT EXISTS motivo_cancelacion text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cobros_cancelado_con_motivo') THEN
    ALTER TABLE public.cobros ADD CONSTRAINT cobros_cancelado_con_motivo CHECK (
      estado <> 'cancelado' OR coalesce(trim(motivo_cancelacion), '') <> '');
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS cobros_pago_afore ON public.cobros (pago_afore_id);

-- El costo administrativo del socio se descuenta una vez por caso (o en cada cobro).
INSERT INTO public.parametros (clave, valor, tipo, descripcion, vigente_desde)
SELECT 'COSTO_ADMIN_SOCIO_POR', 'caso', 'texto', 'Costo administrativo del socio: una vez por caso (caso) o en cada cobro (cobro)', '2026-01-01'
WHERE NOT EXISTS (SELECT 1 FROM public.parametros WHERE clave = 'COSTO_ADMIN_SOCIO_POR');

-- Estado de cuenta: cada liquidación de comisiones queda agrupada para poder reimprimirla.
CREATE TABLE IF NOT EXISTS public.liquidaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiario_tipo "BeneficiarioTipo" NOT NULL,
  beneficiario_id uuid NOT NULL,
  periodo date NOT NULL,              -- primer día del mes liquidado
  total numeric(14,2) NOT NULL CHECK (total >= 0),
  fecha_pago date NOT NULL,
  metodo "MetodoPago" NOT NULL,
  referencia text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
ALTER TABLE public.comisiones ADD COLUMN IF NOT EXISTS liquidacion_id uuid REFERENCES public.liquidaciones (id);
ALTER TABLE public.liquidaciones ENABLE ROW LEVEL SECURITY;
-- En Supabase las tablas nuevas nacen con todos los permisos para anon y authenticated:
-- se quitan y se concede solo leer e insertar (nadie borra ni edita una liquidación).
REVOKE ALL ON public.liquidaciones FROM anon, authenticated;
GRANT SELECT, INSERT ON public.liquidaciones TO authenticated;
CREATE POLICY liquidaciones_sel ON public.liquidaciones FOR SELECT TO authenticated USING (
  app.es('director')
  OR (app.rol() IS NOT NULL AND beneficiario_tipo = 'usuario' AND beneficiario_id = auth.uid())
  OR (app.es('socio') AND beneficiario_tipo = 'socio' AND beneficiario_id = app.socio_id())
);
CREATE POLICY liquidaciones_ins ON public.liquidaciones FOR INSERT TO authenticated WITH CHECK (app.es('director'));
CREATE TRIGGER tg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.liquidaciones
  FOR EACH ROW EXECUTE FUNCTION auditoria.tg_registrar();
