-- 13-nov-2026 · Fecha de asignación automática y CURP obligatoria en el formulario con QR.

-- Cuándo se asignó el caso a su asesor de pensiones. La pone la base, venga de donde venga la asignación
-- (verificar un prospecto de campo, el expediente o Asesores y referidores); se renueva si cambia de asesor.
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS socio_asignado_at timestamptz;
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
  RETURN NEW;
END $$;
-- Casos que ya tenían asesor: no se sabe cuándo se asignó; se toma la fecha de alta del caso (antes del disparador).
UPDATE public.casos SET socio_asignado_at = created_at WHERE socio_id IS NOT NULL AND socio_asignado_at IS NULL;
CREATE TRIGGER tg_socio_asignado BEFORE INSERT OR UPDATE ON public.casos FOR EACH ROW EXECUTE FUNCTION app.tg_socio_asignado();

-- CURP obligatoria para lo que llegue por el formulario desde ahora (NOT VALID: no toca registros anteriores).
ALTER TABLE public.campo_prospectos ADD CONSTRAINT campo_prospectos_formulario_curp
  CHECK (origen <> 'formulario' OR curp_hash IS NOT NULL) NOT VALID;
