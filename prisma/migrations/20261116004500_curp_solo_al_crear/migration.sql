-- 16-nov-2026 · La CURP obligatoria del formulario se revisa solo al crear el registro. Como CHECK (aunque fuera
-- NOT VALID) también frenaba actualizar registros anteriores sin CURP: verificarlos, rechazarlos o pagarlos.
CREATE OR REPLACE FUNCTION app.tg_campo_formulario_curp() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.origen = 'formulario' AND NEW.curp_hash IS NULL THEN
    RAISE EXCEPTION 'campo_prospectos: un registro del formulario necesita la CURP' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_campo_formulario_curp BEFORE INSERT ON public.campo_prospectos FOR EACH ROW EXECUTE FUNCTION app.tg_campo_formulario_curp();
