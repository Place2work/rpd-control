-- Bitácora por trigger (sección 12), sellos de fecha/usuario y restricciones de datos.

-- ───────────── Sellos: created_by y updated_at ─────────────
CREATE OR REPLACE FUNCTION app.tg_sellos() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF to_jsonb(NEW) ? 'created_by' THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object('created_by', coalesce(to_jsonb(NEW) ->> 'created_by', auth.uid()::text)));
    END IF;
  END IF;
  IF to_jsonb(NEW) ? 'updated_at' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('updated_at', now()));
  END IF;
  RETURN NEW;
END $$;

-- ───────────── Bitácora ─────────────
CREATE OR REPLACE FUNCTION auditoria.tg_registrar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_antes   jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
  v_despues jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END;
  v_fila    jsonb := coalesce(v_despues, v_antes);
  v_id      text;
  v_accion  text := TG_OP;
  v_cambios text[];
  -- Cambios que se resaltan en la bitácora del caso (sección 12).
  v_vigilados text[] := ARRAY[
    'sbc_ultimo', 'sbc_promedio_250', 'semanas_cotizadas', 'semanas_descontadas',
    'semanas_reintegradas', 'semanas_totales', 'bimestres_cotizados',
    'saldo_rcv', 'saldo_sar92', 'saldo_vivienda', 'saldo_voluntarias',
    'monto_bruto', 'isr_retenido', 'monto_neto', 'honorario_total', 'subtotal', 'iva',
    'honorario_fijo', 'base', 'monto', 'estado', 'dictamen_manual', 'estado_ultimo_retiro',
    'fecha_ultimo_retiro', 'regimen'];
  v_ocultos text[] := ARRAY['curp_cifrada', 'nss_cifrado', 'clabe_cifrada'];
  k text;
BEGIN
  v_id := coalesce(v_fila ->> 'id', v_fila ->> 'clave', v_fila ->> 'fecha',
                   concat_ws('/', v_fila ->> 'tipo_documento_id', v_fila ->> 'tipo_servicio'));

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(n.key ORDER BY n.key) INTO v_cambios
    FROM jsonb_each(v_despues) n
    WHERE n.key NOT IN ('updated_at') AND n.value IS DISTINCT FROM v_antes -> n.key;
    IF v_cambios IS NULL THEN
      RETURN NULL; -- nada cambió de verdad
    END IF;
    IF (v_antes ->> 'archivado_at') IS NULL AND (v_despues ->> 'archivado_at') IS NOT NULL THEN
      v_accion := 'ARCHIVE';
    END IF;
  END IF;

  -- Los valores cifrados no se copian: solo se anota que cambiaron.
  FOREACH k IN ARRAY v_ocultos LOOP
    IF v_antes ? k AND v_antes -> k <> 'null'::jsonb THEN v_antes := jsonb_set(v_antes, ARRAY[k], '"[cifrado]"'); END IF;
    IF v_despues ? k AND v_despues -> k <> 'null'::jsonb THEN v_despues := jsonb_set(v_despues, ARRAY[k], '"[cifrado]"'); END IF;
  END LOOP;

  INSERT INTO auditoria.auditoria (tabla, registro_id, accion, campos_cambiados, resaltado, antes, despues, usuario_id, ip)
  VALUES (TG_TABLE_NAME, v_id, v_accion, coalesce(v_cambios, '{}'),
          TG_OP = 'UPDATE' AND v_cambios && v_vigilados AND TG_TABLE_NAME NOT IN ('alertas', 'ejecuciones_tarea'),
          v_antes, v_despues, auth.uid(), app.ip_cliente());
  RETURN NULL;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('CREATE TRIGGER tg_sellos BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.tg_sellos()', t);
    EXECUTE format('CREATE TRIGGER tg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION auditoria.tg_registrar()', t);
  END LOOP;
END $$;

-- La bitácora no se edita ni se borra, ni siquiera con privilegios de tabla.
CREATE OR REPLACE FUNCTION auditoria.tg_inmutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora no se puede modificar ni borrar' USING ERRCODE = '42501';
END $$;
CREATE TRIGGER tg_inmutable BEFORE UPDATE OR DELETE ON auditoria.auditoria
  FOR EACH ROW EXECUTE FUNCTION auditoria.tg_inmutable();

-- ───────────── Dictamen manual de elegibilidad ─────────────
-- Para casos que el motor no resuelve (p. ej. cuenta con menos de 3 años): el asesor o el
-- Director marcan APTO o NO_APTO con motivo. Prevalece sobre el resultado automático.
ALTER TABLE public.casos ADD CONSTRAINT casos_dictamen_con_motivo
  CHECK (dictamen_manual IS NULL OR length(trim(coalesce(dictamen_manual_motivo, ''))) >= 10);

CREATE OR REPLACE FUNCTION app.tg_dictamen_manual() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.dictamen_manual IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.dictamen_manual IS NOT DISTINCT FROM OLD.dictamen_manual
     AND NEW.dictamen_manual_motivo IS NOT DISTINCT FROM OLD.dictamen_manual_motivo THEN
    RETURN NEW;
  END IF;
  -- En sesiones de usuario solo asesor y Director; los procesos del servidor (sin auth.uid) pasan.
  IF auth.uid() IS NOT NULL AND NOT app.es('director', 'asesor') THEN
    RAISE EXCEPTION 'Solo un asesor o el Director pueden dictaminar la elegibilidad' USING ERRCODE = '42501';
  END IF;
  NEW.dictamen_manual_por := auth.uid();
  NEW.dictamen_manual_at := CASE WHEN NEW.dictamen_manual IS NULL THEN NULL ELSE now() END;
  IF NEW.dictamen_manual IS NULL THEN
    NEW.dictamen_manual_motivo := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_dictamen_manual BEFORE INSERT OR UPDATE ON public.casos
  FOR EACH ROW EXECUTE FUNCTION app.tg_dictamen_manual();

-- ───────────── Último retiro: por verificar / nunca retiró / con retiro ─────────────
ALTER TABLE public.datos_afore ADD CONSTRAINT datos_afore_ultimo_retiro_coherente CHECK (
  (estado_ultimo_retiro = 'con_retiro') = (fecha_ultimo_retiro IS NOT NULL)
);

CREATE OR REPLACE FUNCTION app.tg_ultimo_retiro() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.estado_ultimo_retiro IS DISTINCT FROM OLD.estado_ultimo_retiro
     OR NEW.fecha_ultimo_retiro IS DISTINCT FROM OLD.fecha_ultimo_retiro THEN
    IF NEW.estado_ultimo_retiro = 'por_verificar' THEN
      NEW.ultimo_retiro_verificado_at := NULL;
      NEW.ultimo_retiro_verificado_por := NULL;
    ELSE
      NEW.ultimo_retiro_verificado_at := now();
      NEW.ultimo_retiro_verificado_por := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_ultimo_retiro BEFORE INSERT OR UPDATE ON public.datos_afore
  FOR EACH ROW EXECUTE FUNCTION app.tg_ultimo_retiro();

-- ───────────── Restricciones de datos ─────────────
ALTER TABLE public.pagos_afore ADD CONSTRAINT pagos_afore_numero_1_a_6 CHECK (numero BETWEEN 1 AND 6);
ALTER TABLE public.pagos_afore ADD CONSTRAINT pagos_afore_montos CHECK (
  monto_bruto >= 0 AND isr_retenido >= 0 AND monto_neto = monto_bruto - isr_retenido);
ALTER TABLE public.cobros ADD CONSTRAINT cobros_iva_cuadra CHECK (
  honorario_total >= 0 AND subtotal >= 0 AND iva = honorario_total - subtotal);
ALTER TABLE public.cobros ADD CONSTRAINT cobros_cobrado_con_fecha CHECK (
  estado <> 'cobrado' OR (fecha_cobro IS NOT NULL AND metodo IS NOT NULL));
ALTER TABLE public.comisiones ADD CONSTRAINT comisiones_pagada_con_fecha CHECK (
  estado <> 'pagada' OR fecha_pago IS NOT NULL);
ALTER TABLE public.personas ADD CONSTRAINT personas_whatsapp_e164 CHECK (
  whatsapp IS NULL OR whatsapp ~ '^\+[1-9][0-9]{7,14}$');
ALTER TABLE public.personas ADD CONSTRAINT personas_nss_ultimos4 CHECK (
  nss_ultimos4 IS NULL OR nss_ultimos4 ~ '^[0-9]{4}$');
ALTER TABLE public.personas ADD CONSTRAINT personas_archivo_con_motivo CHECK (
  archivado_at IS NULL OR motivo_archivo IS NOT NULL);
ALTER TABLE public.casos ADD CONSTRAINT casos_archivo_con_motivo CHECK (
  archivado_at IS NULL OR motivo_archivo IS NOT NULL);
ALTER TABLE public.casos ADD CONSTRAINT casos_perdido_con_motivo CHECK (
  etapa <> 'PERDIDO' OR motivo_perdida IS NOT NULL);
ALTER TABLE public.casos ADD CONSTRAINT casos_bloqueado_con_motivo CHECK (
  etapa <> 'BLOQUEADO' OR motivo_bloqueo IS NOT NULL);
ALTER TABLE public.casos ADD CONSTRAINT casos_dias_suspendidos CHECK (dias_suspendidos >= 0);
ALTER TABLE public.alertas ADD CONSTRAINT alertas_pospuesta_con_fecha CHECK (
  estado <> 'pospuesta' OR pospuesta_hasta IS NOT NULL);
ALTER TABLE public.alertas ADD CONSTRAINT alertas_descartada_con_motivo CHECK (
  estado <> 'descartada' OR motivo_descarte IS NOT NULL);
ALTER TABLE public.documentos ADD CONSTRAINT documentos_rechazo_con_motivo CHECK (
  estado <> 'rechazado' OR motivo_rechazo IS NOT NULL);
ALTER TABLE public.suspensiones_contrato ADD CONSTRAINT suspensiones_rango CHECK (fin IS NULL OR fin >= inicio);
