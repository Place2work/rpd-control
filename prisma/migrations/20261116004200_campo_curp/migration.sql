-- 13-nov-2026 · CURP en el formulario con QR del gerente de campo. Dato sensible: se guarda cifrada (src/lib/cripto),
-- con su hash HMAC para buscar repetidos y la versión parcial para mostrar. Al verificar, pasa al cliente.
ALTER TABLE public.campo_prospectos ADD COLUMN IF NOT EXISTS curp_cifrada bytea;
ALTER TABLE public.campo_prospectos ADD COLUMN IF NOT EXISTS curp_hash text;
ALTER TABLE public.campo_prospectos ADD COLUMN IF NOT EXISTS curp_parcial text;
ALTER TABLE public.campo_prospectos ADD CONSTRAINT campo_prospectos_curp_completa
  CHECK ((curp_cifrada IS NULL) = (curp_hash IS NULL) AND (curp_hash IS NULL) = (curp_parcial IS NULL));
CREATE INDEX IF NOT EXISTS campo_prospectos_curp ON public.campo_prospectos (curp_hash) WHERE curp_hash IS NOT NULL;
