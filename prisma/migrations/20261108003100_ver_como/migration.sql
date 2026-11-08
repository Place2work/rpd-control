-- «Ver como asesor» (solo Director, solo lectura): cada vez que se activa queda en la bitácora de cuentas.
CREATE OR REPLACE FUNCTION app.registrar_accion_cuenta(p_usuario uuid, p_accion text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT app.es('director') THEN
    RAISE EXCEPTION 'Solo el Director' USING ERRCODE = '42501';
  END IF;
  IF p_accion NOT IN ('CLAVE_TEMPORAL', 'RESTABLECER_2FA', 'VER_COMO') THEN
    RAISE EXCEPTION 'Acción no permitida: %', p_accion USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = p_usuario) THEN
    RAISE EXCEPTION 'Usuario inexistente' USING ERRCODE = '22023';
  END IF;
  INSERT INTO auditoria.auditoria (tabla, registro_id, accion, resaltado, usuario_id, ip)
  VALUES ('usuarios', p_usuario::text, p_accion, true, auth.uid(), app.ip_cliente());
END
$$;
