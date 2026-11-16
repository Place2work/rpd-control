-- 16-nov-2026 · Se quita el CHECK de CURP del formulario: lo reemplaza el disparador de la migración anterior
-- (solo al crear). Va aparte porque es un DROP.
ALTER TABLE public.campo_prospectos DROP CONSTRAINT IF EXISTS campo_prospectos_formulario_curp;
