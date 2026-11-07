-- Costo administrativo por cada prospecto dado de alta (pesos). Con vigencia: cada alta se valúa con el
-- costo vigente el día en que se dio de alta. Editable en Configuración → Parámetros.
INSERT INTO parametros (clave, valor, tipo, descripcion, vigente_desde)
VALUES ('COSTO_ADMIN_ALTA', '500', 'decimal', 'Costo administrativo por cada prospecto dado de alta (pesos)', '2026-01-01')
ON CONFLICT (clave, vigente_desde) DO NOTHING;
