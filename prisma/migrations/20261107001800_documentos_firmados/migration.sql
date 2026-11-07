-- Contrato y aviso de privacidad ya firmados por el cliente: se suben como documentos del expediente
-- (mismo bucket privado y mismas políticas). Opcionales: no cambian los requisitos de etapa.
INSERT INTO tipos_documento (nombre, obligatorio, requiere_original, instrucciones, orden)
VALUES
  ('Contrato firmado', false, false, 'El contrato generado por el sistema, firmado por el cliente en todas sus hojas. Escaneado o foto clara de cada hoja (un PDF de preferencia).', 90),
  ('Aviso de privacidad firmado', false, false, 'El aviso de privacidad generado por el sistema, firmado por el cliente. Escaneado o foto clara (un PDF de preferencia).', 91)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO tipos_documento_servicio (tipo_documento_id, tipo_servicio, obligatorio)
SELECT t.id, s.clave, false
FROM tipos_documento t CROSS JOIN tipos_servicio s
WHERE t.nombre IN ('Contrato firmado', 'Aviso de privacidad firmado')
ON CONFLICT DO NOTHING;
