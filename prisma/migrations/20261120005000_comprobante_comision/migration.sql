-- 20-nov-2026 · Comprobante del pago de la comisión al asesor (o referidor), desde el expediente. Se guarda en la
-- carpeta del caso (bucket expedientes, mismas políticas): lo ve el Director y el beneficiario que ve el caso.
ALTER TABLE public.comisiones ADD COLUMN IF NOT EXISTS comprobante_path text;
ALTER TABLE public.comisiones ADD COLUMN IF NOT EXISTS comprobante_mime text;
ALTER TABLE public.comisiones ADD COLUMN IF NOT EXISTS comprobante_at timestamptz;
ALTER TABLE public.comisiones ADD COLUMN IF NOT EXISTS comprobante_por uuid;
ALTER TABLE public.comisiones ADD CONSTRAINT comisiones_comprobante_ruta
  CHECK (comprobante_path IS NULL OR comprobante_path ~ ('^' || caso_id::text || '/[0-9a-f-]{36}\.[a-z]{3,4}$'));
