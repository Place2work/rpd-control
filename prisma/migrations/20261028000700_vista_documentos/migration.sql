-- Ver un documento del expediente deja renglón en la bitácora (sección 12), igual que NSS/CURP.
-- La app no puede escribir en auditoria; esta función valida acceso y escribe por ella.
CREATE OR REPLACE FUNCTION app.registrar_vista_documento(p_documento uuid) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caso uuid;
  v_ruta text;
BEGIN
  SELECT caso_id, archivo_path INTO v_caso, v_ruta FROM documentos WHERE id = p_documento AND archivado_at IS NULL;
  IF v_caso IS NULL OR NOT app.caso_operable(v_caso) THEN
    RAISE EXCEPTION 'Sin acceso a este documento' USING ERRCODE = '42501';
  END IF;
  INSERT INTO auditoria.auditoria (tabla, registro_id, accion, campo, usuario_id, ip)
  VALUES ('documentos', p_documento::text, 'VER_SENSIBLE', 'documento', auth.uid(), app.ip_cliente());
  RETURN v_ruta;
END $$;
REVOKE EXECUTE ON FUNCTION app.registrar_vista_documento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app.registrar_vista_documento(uuid) TO authenticated;
