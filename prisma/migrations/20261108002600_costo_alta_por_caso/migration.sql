-- Costo administrativo propio de un alta (pesos). NULL = el general (COSTO_ADMIN_ALTA vigente el día del alta).
-- Sirve para poner $0 o más en altas de pensión u otros servicios. Solo el Director lo fija (trigger).
ALTER TABLE public.casos
  ADD COLUMN IF NOT EXISTS costo_admin_alta numeric(12, 2)
  CHECK (costo_admin_alta IS NULL OR (costo_admin_alta >= 0 AND costo_admin_alta <= 1000000));

CREATE OR REPLACE FUNCTION app.tg_costo_admin_alta() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.costo_admin_alta IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.costo_admin_alta IS NOT DISTINCT FROM OLD.costo_admin_alta THEN
    RETURN NEW;
  END IF;
  -- En sesiones de usuario solo el Director; los procesos del servidor (sin auth.uid) pasan.
  IF auth.uid() IS NOT NULL AND NOT app.es('director') THEN
    RAISE EXCEPTION 'Solo el Director cambia el costo administrativo de un alta' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_costo_admin_alta ON public.casos;
CREATE TRIGGER tg_costo_admin_alta BEFORE INSERT OR UPDATE ON public.casos
  FOR EACH ROW EXECUTE FUNCTION app.tg_costo_admin_alta();
