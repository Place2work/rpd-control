-- Pago que la Afore va a hacer al cliente, conocido antes del depósito (resolución de la Afore). Sirve para
-- proyectar el honorario por cobrar. No es un pago: no mueve la etapa ni cuenta como monto retirado.
ALTER TABLE casos
  ADD COLUMN monto_afore_esperado numeric(14, 2) CHECK (monto_afore_esperado IS NULL OR monto_afore_esperado > 0),
  ADD COLUMN fecha_afore_estimada date;
