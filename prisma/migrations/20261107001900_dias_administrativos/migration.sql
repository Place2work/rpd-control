-- Margen que la empresa se da después del día 46 para ingresar el trámite. No cambia la fecha legal:
-- se muestra junto a ella y tiene su propia alerta. Editable con vigencia en Configuración → Parámetros.
INSERT INTO parametros (clave, valor, tipo, descripcion, vigente_desde)
VALUES ('DIAS_ADMINISTRATIVOS', '10', 'entero', 'Días administrativos después del día 46 para ingresar el trámite (margen de la empresa)', '2026-01-01')
ON CONFLICT (clave, vigente_desde) DO NOTHING;
