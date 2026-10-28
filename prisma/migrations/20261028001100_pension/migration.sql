-- Fase 4: pensión y Modalidad 40 (7.6). Solo agrega.

-- Plan de Modalidad 40 del caso: meses a pagar y monto mensual (lo calcula el asesor con la
-- tasa vigente del IMSS; el sistema no inventa la tasa).
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS m40_desde date;
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS m40_hasta date;
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS m40_salario numeric(12,2);   -- salario diario registrado
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS m40_monto numeric(14,2);     -- pago mensual
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'casos_m40_periodo') THEN
    ALTER TABLE public.casos ADD CONSTRAINT casos_m40_periodo CHECK (m40_desde IS NULL OR m40_hasta IS NULL OR m40_hasta >= m40_desde);
  END IF;
END $$;

-- Semanas cotizadas en los últimos 5 años antes de la baja (requisito de M40, art. 218).
ALTER TABLE public.datos_imss ADD COLUMN IF NOT EXISTS semanas_ultimos_5_anios numeric(8,1);

-- Plazos de 7.6 y de las alertas de 8.1 como parámetros.
INSERT INTO public.parametros (clave, valor, tipo, descripcion, vigente_desde)
SELECT x.clave, x.valor, x.tipo, x.descripcion, '2026-01-01'::date FROM (VALUES
  ('M40_ANIOS_DERECHO', '5', 'entero', 'M40: años desde la baja para inscribirse (art. 219 LSS)'),
  ('M40_SEMANAS_REQUERIDAS', '52', 'entero', 'M40: semanas en los últimos 5 años (art. 218 LSS)'),
  ('M40_MESES_BAJA', '2', 'entero', 'M40: meses seguidos sin pago que causan baja (art. 220 LSS)'),
  ('M40_MESES_REINGRESO', '12', 'entero', 'M40: meses para reingresar después de la baja'),
  ('M40_DIA_LIMITE', '17', 'entero', 'M40: día del mes en que vence el pago'),
  ('M40_PAGO_ADELANTADO', 'si', 'texto', 'M40: si = el mes se paga a más tardar el día límite del mismo mes; no = del mes siguiente'),
  ('VENTANA_SIN_EXAMEN_MESES', '12', 'entero', 'Incorporación voluntaria sin examen médico: meses desde la baja (art. 85 RACERF)'),
  ('CONSERVACION_FRACCION', '0.25', 'decimal', 'Conservación de derechos Ley 73: fracción del tiempo cotizado (art. 150 LSS 1973)'),
  ('CONSERVACION_MIN_MESES', '12', 'entero', 'Conservación de derechos Ley 73: mínimo en meses'),
  ('AVISO_M40_PAGO_DIAS', '5', 'entero', 'Alerta M40_PAGO_PROXIMO: días antes del vencimiento'),
  ('AVISO_M40_PLAZO_DIAS', '60', 'entero', 'Alerta M40_PLAZO_5_ANIOS: días antes'),
  ('AVISO_VENTANA_DIAS', '30', 'entero', 'Alerta VENTANA_12_MESES: días antes'),
  ('AVISO_EDAD_MESES', '6', 'entero', 'Alerta EDAD_PENSION: meses antes de cumplir 60 y 65'),
  ('AVISO_CONSERVACION_DIAS', '90', 'entero', 'Alerta CONSERVACION_DERECHOS: días antes'),
  ('INFONAVIT_EDAD_AVISO', '69', 'entero', 'Alerta INFONAVIT_70: edad del aviso'),
  ('INFONAVIT_EDAD_LIMITE', '70', 'entero', 'Edad en que el saldo de vivienda pasa al Fondo de Pensiones para el Bienestar')
) AS x (clave, valor, tipo, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM public.parametros p WHERE p.clave = x.clave);
