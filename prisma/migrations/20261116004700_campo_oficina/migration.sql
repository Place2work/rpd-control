-- 16-nov-2026 · El Director o el analista también capturan prospectos de campo («oficina») y los asignan a un gerente
-- de campo al momento o después. Se le paga al gerente igual que lo que él levanta: si se verifica. Para la semana de
-- pago cuenta la fecha más tardía entre la verificación y la asignación al gerente (así nunca cae en una semana ya pagada).

ALTER TABLE public.campo_prospectos ADD CONSTRAINT campo_prospectos_origen_valido CHECK (origen IN ('gerente', 'formulario', 'oficina'));
ALTER TABLE public.campo_prospectos ADD COLUMN IF NOT EXISTS gerente_asignado_at timestamptz;
UPDATE public.campo_prospectos SET gerente_asignado_at = created_at WHERE gerente_asignado_at IS NULL;

-- Origen y fecha de asignación los pone la base; el gerente solo puede ser un gerente de campo; ya pagado no cambia.
CREATE OR REPLACE FUNCTION app.tg_campo_prospecto_gerente() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' AND app.rol() IN ('director', 'asesor') THEN
    NEW.origen := 'oficina';
  END IF;
  IF NEW.gerente_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.gerente_id IS DISTINCT FROM OLD.gerente_id)
     AND NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = NEW.gerente_id AND u.rol = 'campo' AND u.archivado_at IS NULL) THEN
    RAISE EXCEPTION 'campo_prospectos: el gerente asignado no es un gerente de campo' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.gerente_id IS DISTINCT FROM OLD.gerente_id AND OLD.pago_id IS NOT NULL THEN
    RAISE EXCEPTION 'campo_prospectos: ya se pagó; no se puede cambiar de gerente' USING ERRCODE = '23514';
  END IF;
  IF NEW.gerente_id IS NULL THEN
    NEW.gerente_asignado_at := NULL;
  ELSIF TG_OP = 'INSERT' OR NEW.gerente_id IS DISTINCT FROM OLD.gerente_id THEN
    NEW.gerente_asignado_at := now();
  ELSE
    NEW.gerente_asignado_at := OLD.gerente_asignado_at;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_campo_prospecto_gerente BEFORE INSERT OR UPDATE ON public.campo_prospectos FOR EACH ROW EXECUTE FUNCTION app.tg_campo_prospecto_gerente();

-- Permisos: el Director y el analista capturan con gerente (o sin él) y con la CURP cifrada; el gerente sigue sin
-- poder escribir CURP ni capturar a nombre de otro.
GRANT INSERT (gerente_id, curp_cifrada, curp_hash, curp_parcial) ON public.campo_prospectos TO authenticated;
GRANT UPDATE (gerente_id) ON public.campo_prospectos TO authenticated;
CREATE POLICY campo_prospectos_ins_gerente ON public.campo_prospectos FOR INSERT TO authenticated
  WITH CHECK (app.es('campo') AND gerente_id = auth.uid() AND curp_hash IS NULL);
CREATE POLICY campo_prospectos_ins_oficina ON public.campo_prospectos FOR INSERT TO authenticated
  WITH CHECK (app.es('director', 'asesor'));
