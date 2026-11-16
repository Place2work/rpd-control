-- 16-nov-2026 · Al verificar un prospecto de campo también se puede asignar a un vendedor. La fecha de asignación
-- del vendedor la pone la base igual que la del asesor de pensiones (mismo disparador).
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS vendedor_asignado_at timestamptz;
UPDATE public.casos SET vendedor_asignado_at = created_at WHERE vendedor_id IS NOT NULL AND vendedor_asignado_at IS NULL;
CREATE OR REPLACE FUNCTION app.tg_socio_asignado() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.socio_id IS NULL THEN
    NEW.socio_asignado_at := NULL;
  ELSIF TG_OP = 'INSERT' OR NEW.socio_id IS DISTINCT FROM OLD.socio_id THEN
    NEW.socio_asignado_at := now();
  ELSE
    NEW.socio_asignado_at := OLD.socio_asignado_at;
  END IF;
  IF NEW.vendedor_id IS NULL THEN
    NEW.vendedor_asignado_at := NULL;
  ELSIF TG_OP = 'INSERT' OR NEW.vendedor_id IS DISTINCT FROM OLD.vendedor_id THEN
    NEW.vendedor_asignado_at := now();
  ELSE
    NEW.vendedor_asignado_at := OLD.vendedor_asignado_at;
  END IF;
  RETURN NEW;
END $$;
