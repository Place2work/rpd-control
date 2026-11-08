-- Desde el 8-nov-2026 el reparto del asesor de pensiones va sobre el honorario cobrado CON IVA:
-- (honorario − costo administrativo del alta) × % del asesor. La vigencia anterior (subtotal) se cierra el día previo.
UPDATE parametros SET vigente_hasta = DATE '2026-11-07'
WHERE clave = 'BASE_REPARTO_SOCIO' AND vigente_desde < DATE '2026-11-08' AND (vigente_hasta IS NULL OR vigente_hasta >= DATE '2026-11-08');
INSERT INTO parametros (clave, valor, tipo, descripcion, vigente_desde)
VALUES ('BASE_REPARTO_SOCIO', 'total', 'texto', 'Reparto del asesor de pensiones sobre el honorario con IVA (total) o sin IVA (subtotal)', DATE '2026-11-08')
ON CONFLICT (clave, vigente_desde) DO UPDATE SET valor = EXCLUDED.valor, descripcion = EXCLUDED.descripcion, vigente_hasta = NULL;
