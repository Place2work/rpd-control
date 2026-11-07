-- Domicilio por partes (todas opcionales). `domicilio` sigue siendo el texto completo que va en el contrato:
-- se arma con estas partes al guardar. Estado y municipio salen del catálogo del INEGI en la pantalla.
ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS calle text,
  ADD COLUMN IF NOT EXISTS numero_exterior text,
  ADD COLUMN IF NOT EXISTS numero_interior text,
  ADD COLUMN IF NOT EXISTS colonia text,
  ADD COLUMN IF NOT EXISTS codigo_postal text CHECK (codigo_postal IS NULL OR codigo_postal ~ '^\d{5}$');
-- personas tiene permisos por columna: las columnas nuevas se conceden aparte.
GRANT SELECT (calle, numero_exterior, numero_interior, colonia, codigo_postal) ON public.personas TO authenticated;
