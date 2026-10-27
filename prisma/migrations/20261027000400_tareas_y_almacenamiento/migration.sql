-- Tarea diaria en horario de la Ciudad de México y bucket privado de expedientes.

-- ───────────── Tarea diaria (sección 8) ─────────────
-- pg_cron solo entiende UTC. En lugar de fijar "13:00 UTC" (que se rompería si México
-- vuelve al horario de verano), el cron corre cada 5 minutos y esta función decide con la
-- hora de CDMX. Cada tarea corre una vez al día: ejecuciones_tarea tiene UNIQUE (tarea, fecha_cdmx).
--   HORA_ALERTAS_CDMX = 07:00 → /api/cron/diaria?tarea=ALERTAS_DIARIAS
--   HORA_CORREO_CDMX  = 07:15 → /api/cron/diaria?tarea=CORREO_RESUMEN
-- Si una corrida falla, el siguiente tic de 5 minutos la reintenta.
CREATE OR REPLACE FUNCTION app.tareas_pendientes_hoy() RETURNS TABLE (tarea text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT t.tarea
  FROM (VALUES ('ALERTAS_DIARIAS', 'HORA_ALERTAS_CDMX', '07:00'),
               ('CORREO_RESUMEN',  'HORA_CORREO_CDMX',  '07:15')) AS t (tarea, param, por_defecto)
  WHERE app.ahora_cdmx()::time >= coalesce(app.parametro(t.param), t.por_defecto)::time
    AND NOT EXISTS (
      SELECT 1 FROM public.ejecuciones_tarea e
      WHERE e.tarea = t.tarea AND e.fecha_cdmx = app.hoy_cdmx() AND e.terminada_at IS NOT NULL)
$$;

-- Llama al endpoint de la app con pg_net. La URL y el secreto viven en Supabase Vault
-- (rpd_app_url, rpd_cron_secreto), nunca en el código.
CREATE OR REPLACE FUNCTION app.disparar_tareas() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_url text;
  v_secreto text;
  r record;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'rpd_app_url';
  SELECT decrypted_secret INTO v_secreto FROM vault.decrypted_secrets WHERE name = 'rpd_cron_secreto';
  IF v_url IS NULL OR v_secreto IS NULL THEN
    RAISE WARNING 'Faltan rpd_app_url o rpd_cron_secreto en Vault; la tarea diaria no se disparó';
    RETURN;
  END IF;
  FOR r IN SELECT * FROM app.tareas_pendientes_hoy() LOOP
    PERFORM net.http_post(
      url := v_url || '/api/cron/diaria?tarea=' || r.tarea,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secreto),
      body := jsonb_build_object('tarea', r.tarea, 'fecha_cdmx', app.hoy_cdmx())
    );
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION app.disparar_tareas() FROM PUBLIC, authenticated, anon;

-- Programación: solo si el servidor tiene pg_cron y pg_net (Supabase sí; Postgres local no).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
    PERFORM cron.schedule('rpd-tareas-diarias', '*/5 * * * *', 'SELECT app.disparar_tareas()');
  ELSE
    RAISE NOTICE 'pg_cron/pg_net no disponibles: la tarea diaria no se programó (normal en local)';
  END IF;
END $$;

-- ───────────── Almacenamiento de expedientes ─────────────
-- Bucket privado; rutas {caso_id}/{uuid}.ext sin datos personales; URLs firmadas de 10 min
-- desde el servidor. El vendedor no entra al expediente.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('expedientes', 'expedientes', false, 15728640,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE OR REPLACE FUNCTION app.caso_de_ruta(p_ruta text) RETURNS uuid
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN split_part(p_ruta, '/', 1)::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;
GRANT EXECUTE ON FUNCTION app.caso_de_ruta(text) TO authenticated;

CREATE POLICY expedientes_sel ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'expedientes' AND app.caso_operable(app.caso_de_ruta(name)));
CREATE POLICY expedientes_ins ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expedientes' AND app.caso_operable(app.caso_de_ruta(name)));
-- Sin UPDATE ni DELETE: un documento corregido se sube como archivo nuevo.
