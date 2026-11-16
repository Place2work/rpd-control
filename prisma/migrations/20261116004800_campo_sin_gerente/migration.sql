-- 16-nov-2026 · Lo que se quita va aparte (DROP): un prospecto de oficina puede quedar sin gerente hasta que se le
-- asigne; el CHECK de origen viejo (sin «oficina») y la política de alta vieja (la reemplazan las de la migración anterior).
ALTER TABLE public.campo_prospectos ALTER COLUMN gerente_id DROP NOT NULL;
ALTER TABLE public.campo_prospectos DROP CONSTRAINT IF EXISTS campo_prospectos_origen_check;
DROP POLICY IF EXISTS campo_prospectos_ins ON public.campo_prospectos;
