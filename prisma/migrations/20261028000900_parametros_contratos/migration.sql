-- Decisiones del 28-oct con los contratos vigentes de Irving: honorario del retiro 26% IVA
-- incluido y vigencia del contrato de 180 días naturales. No se borra nada: el valor anterior
-- queda con vigencia hasta ayer, así los cálculos y contratos viejos se reproducen igual.
UPDATE public.parametros SET vigente_hasta = '2026-10-27'
WHERE clave IN ('HONORARIO_RETIRO_PCT', 'VIGENCIA_CONTRATO_DIAS') AND vigente_hasta IS NULL AND vigente_desde < '2026-10-28';

INSERT INTO public.parametros (clave, valor, tipo, descripcion, vigente_desde)
SELECT x.clave, x.valor, x.tipo, x.descripcion, '2026-10-28'::date FROM (VALUES
  ('HONORARIO_RETIRO_PCT', '0.26', 'decimal', 'Honorario del retiro, IVA incluido (contrato vigente: 26%)'),
  ('VIGENCIA_CONTRATO_DIAS', '180', 'entero', 'Vigencia del contrato de retiro en días naturales (contrato vigente: 180)')
) AS x (clave, valor, tipo, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM public.parametros p WHERE p.clave = x.clave AND p.vigente_desde = '2026-10-28');
