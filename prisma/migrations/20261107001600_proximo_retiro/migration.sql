-- Decisión 7-nov-2026: todo retiro se registra con un solo pago de la Afore (también la modalidad B).
-- Vigencia nueva desde hoy; la anterior se cierra el día previo (nunca se cambia hacia atrás).
UPDATE parametros SET vigente_hasta = '2026-11-06'
WHERE clave = 'MODALIDAD_B_MENSUALIDADES_MAX' AND vigente_desde < '2026-11-07' AND vigente_hasta IS NULL;
INSERT INTO parametros (clave, valor, tipo, descripcion, vigente_desde)
VALUES ('MODALIDAD_B_MENSUALIDADES_MAX', '1', 'entero', 'Pagos máximos de la Afore en modalidad B; la A se paga en uno solo', '2026-11-07')
ON CONFLICT (clave, vigente_desde) DO NOTHING;

-- Aviso para volver a contactar al cliente antes de que pueda retirar otra vez.
INSERT INTO parametros (clave, valor, tipo, descripcion, vigente_desde)
VALUES ('AVISO_PROXIMO_RETIRO_DIAS', '30', 'entero', 'Días antes del próximo retiro (5 años después del depósito) para avisar al asesor', '2026-01-01')
ON CONFLICT (clave, vigente_desde) DO NOTHING;
