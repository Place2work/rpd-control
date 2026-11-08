-- Tres esquemas: Analista de expedientes (sin comisión), Asesor de pensiones (reparto) y Referidor.
-- El esquema del vendedor se cierra (no se borra): desde hoy ya no genera comisiones nuevas.
UPDATE esquemas_comision SET vigente_hasta = DATE '2026-11-07'
WHERE tipo = 'vendedor' AND (vigente_hasta IS NULL OR vigente_hasta > DATE '2026-11-07') AND vigente_desde <= DATE '2026-11-07';
-- Versiones del vendedor programadas a futuro: rango vacío (nunca entran en vigor).
UPDATE esquemas_comision SET vigente_hasta = vigente_desde - 1
WHERE tipo = 'vendedor' AND vigente_desde > DATE '2026-11-07' AND (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde);
