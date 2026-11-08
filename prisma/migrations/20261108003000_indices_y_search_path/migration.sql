-- Revisión del 8-nov-2026 (avisos del linter de Supabase). Solo agrega; no cambia datos.
-- 1) La función del trigger del costo del alta con search_path fijo (como las demás funciones de app).
ALTER FUNCTION app.tg_costo_admin_alta() SET search_path = public, pg_temp;

-- 2) Índices de las llaves foráneas que más se consultan (expediente, comisiones, alertas, cuentas).
CREATE INDEX IF NOT EXISTS "usuarios_socio_id_idx" ON "usuarios"("socio_id");
CREATE INDEX IF NOT EXISTS "casos_persona_id_idx" ON "casos"("persona_id");
CREATE INDEX IF NOT EXISTS "casos_referidor_id_idx" ON "casos"("referidor_id");
CREATE INDEX IF NOT EXISTS "suspensiones_contrato_caso_id_idx" ON "suspensiones_contrato"("caso_id");
CREATE INDEX IF NOT EXISTS "alertas_caso_id_idx" ON "alertas"("caso_id");
CREATE INDEX IF NOT EXISTS "cobros_caso_id_idx" ON "cobros"("caso_id");
CREATE INDEX IF NOT EXISTS "comisiones_cobro_id_idx" ON "comisiones"("cobro_id");
CREATE INDEX IF NOT EXISTS "comisiones_pago_afore_id_idx" ON "comisiones"("pago_afore_id");
