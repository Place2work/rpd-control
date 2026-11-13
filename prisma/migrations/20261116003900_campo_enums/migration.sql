-- 16-nov-2026 · Gerente de campo: rol y origen nuevos. Va aparte porque un valor nuevo de un enum no puede
-- usarse en la misma transacción en que se agrega.
ALTER TYPE public."Rol" ADD VALUE IF NOT EXISTS 'campo';
ALTER TYPE public."Origen" ADD VALUE IF NOT EXISTS 'campo';
