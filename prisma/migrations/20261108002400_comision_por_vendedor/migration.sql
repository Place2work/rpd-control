-- Porcentaje de comisión propio de cada vendedor (retiro por desempleo). NULL = el del esquema general.
-- Al cambiarlo se recalculan sus comisiones no pagadas; las pagadas no cambian.
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS comision_pct numeric(5, 4) CHECK (comision_pct IS NULL OR (comision_pct > 0 AND comision_pct < 1));
