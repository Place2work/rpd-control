-- Configuración editable (10.9). Solo agrega.
-- Un día inhábil capturado por error se desactiva (nadie borra).
ALTER TABLE public.dias_inhabiles ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;
