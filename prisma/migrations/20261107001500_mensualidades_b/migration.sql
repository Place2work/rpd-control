-- Pagos de la Afore por retiro: la modalidad A se paga en una sola exhibición; la B en hasta N
-- mensualidades. El máximo deja de estar escrito en el código.
INSERT INTO parametros (clave, valor, tipo, descripcion, vigente_desde)
VALUES ('MODALIDAD_B_MENSUALIDADES_MAX', '6', 'entero', 'Pagos máximos de la Afore en modalidad B; la A se paga en uno solo', '2026-01-01')
ON CONFLICT (clave, vigente_desde) DO NOTHING;
