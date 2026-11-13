-- 13-nov-2026 · Formulario público del gerente de campo: cada gerente tiene un código (para su QR y su liga). La
-- persona se registra desde su celular y el registro llega como prospecto de campo pendiente, a nombre de ese gerente.

ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS campo_codigo text UNIQUE CHECK (campo_codigo ~ '^[a-z0-9]{8}$');

-- Código al volverse gerente de campo (nuevo o por cambio de rol). Se conserva si después cambia de rol: así sus QR
-- impresos no apuntan a otra persona; el formulario solo acepta códigos de gerentes de campo activos.
CREATE OR REPLACE FUNCTION app.tg_campo_codigo() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.rol = 'campo' AND NEW.campo_codigo IS NULL THEN
    NEW.campo_codigo := substr(md5(random()::text || clock_timestamp()::text || NEW.id::text), 1, 8);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_campo_codigo BEFORE INSERT OR UPDATE OF rol ON public.usuarios FOR EACH ROW EXECUTE FUNCTION app.tg_campo_codigo();
UPDATE public.usuarios SET campo_codigo = substr(md5(random()::text || clock_timestamp()::text || id::text), 1, 8)
 WHERE rol = 'campo' AND campo_codigo IS NULL;

-- De dónde vino el prospecto de campo, y el aviso de privacidad que aceptó la persona en el formulario.
ALTER TABLE public.campo_prospectos ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'gerente' CHECK (origen IN ('gerente', 'formulario'));
ALTER TABLE public.campo_prospectos ADD COLUMN IF NOT EXISTS privacidad_aceptada_at timestamptz;
ALTER TABLE public.campo_prospectos ADD COLUMN IF NOT EXISTS privacidad_version text;
ALTER TABLE public.campo_prospectos ADD COLUMN IF NOT EXISTS ip_hash text;
ALTER TABLE public.campo_prospectos ADD CONSTRAINT campo_prospectos_formulario_privacidad
  CHECK (origen <> 'formulario' OR privacidad_aceptada_at IS NOT NULL);
CREATE INDEX IF NOT EXISTS campo_prospectos_ip ON public.campo_prospectos (ip_hash, created_at) WHERE ip_hash IS NOT NULL;

-- Freno contra registros en serie desde un mismo teléfono (por hora).
INSERT INTO public.parametros (clave, valor, tipo, descripcion, vigente_desde)
SELECT 'CAMPO_FORMULARIO_MAX_HORA', '5', 'entero', 'Gerente de campo: registros por hora que acepta el formulario público desde un mismo teléfono', DATE '2026-01-01'
 WHERE NOT EXISTS (SELECT 1 FROM public.parametros WHERE clave = 'CAMPO_FORMULARIO_MAX_HORA');
