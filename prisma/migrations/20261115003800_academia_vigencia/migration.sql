-- 15-nov-2026 · Academia, fase D (docs/CAPACITACION.md 9.5, 9.6, 11.3 y 12.3): vencimiento y recertificación,
-- microlecciones de actualización ligadas a parámetros, preguntas en revisión, repasos obligatorios y alertas.
-- Lo escribe el motor de la Academia (prismaSistema); el Director revisa preguntas y publica microlecciones con RLS.

-- 1) Bitácora de cambios de parámetros para la Academia: la llena un disparador en `parametros`, venga el cambio de
--    Configuración o de una migración. Solo registra cambios de valor de un parámetro que ya existía.
CREATE TABLE IF NOT EXISTS public.cap_cambios_parametro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parametro_clave text NOT NULL,
  valor text NOT NULL,
  anterior text NOT NULL,
  vigente_desde date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  procesado_at timestamptz,
  UNIQUE (parametro_clave, vigente_desde, valor)
);

CREATE OR REPLACE FUNCTION app.tg_parametro_cambio_academia() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_anterior text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.valor IS NOT DISTINCT FROM OLD.valor THEN RETURN NEW; END IF;
  SELECT p.valor INTO v_anterior FROM public.parametros p
   WHERE p.clave = NEW.clave AND p.id <> NEW.id AND p.vigente_desde < NEW.vigente_desde
   ORDER BY p.vigente_desde DESC LIMIT 1;
  IF v_anterior IS NULL OR v_anterior = NEW.valor THEN RETURN NEW; END IF;
  INSERT INTO public.cap_cambios_parametro (parametro_clave, valor, anterior, vigente_desde)
  VALUES (NEW.clave, NEW.valor, v_anterior, NEW.vigente_desde)
  ON CONFLICT (parametro_clave, vigente_desde, valor) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_parametro_cambio_academia ON public.parametros;
CREATE TRIGGER tg_parametro_cambio_academia AFTER INSERT OR UPDATE OF valor ON public.parametros
  FOR EACH ROW EXECUTE FUNCTION app.tg_parametro_cambio_academia();

-- 2) Preguntas en revisión (9.6): una pregunta que depende de un parámetro que cambió no se sirve en exámenes hasta
--    que el Director confirma que sigue correcta. Si el contenido sube de versión, la revisión vieja deja de aplicar.
CREATE TABLE IF NOT EXISTS public.cap_preguntas_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pregunta text NOT NULL CHECK (pregunta ~ '^(N0|R1|R2|P1|P2)-Q\d\d$'),
  version integer NOT NULL,
  cambio_id uuid NOT NULL REFERENCES public.cap_cambios_parametro(id),
  estado text NOT NULL DEFAULT 'revisar' CHECK (estado IN ('revisar', 'vigente')),
  nota text,
  revisada_por uuid,
  revisada_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pregunta, version, cambio_id)
);

-- 3) Microlecciones de actualización (9.5). Las preguntas (con respuesta) no se conceden a nadie: las lee el motor.
CREATE TABLE IF NOT EXISTS public.cap_actualizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plantilla text NOT NULL,
  cambio_id uuid NOT NULL REFERENCES public.cap_cambios_parametro(id),
  parametro_clave text NOT NULL,
  vigente_desde date NOT NULL,
  titulo text NOT NULL,
  contenido text NOT NULL,
  preguntas jsonb NOT NULL,
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicada')),
  publicada_at timestamptz,
  publicada_por uuid,
  fecha_limite date,
  created_at timestamptz NOT NULL DEFAULT now(),
  archivado_at timestamptz,
  UNIQUE (plantilla, vigente_desde),
  CHECK (estado = 'borrador' OR (publicada_at IS NOT NULL AND fecha_limite IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS public.cap_actualizaciones_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actualizacion_id uuid NOT NULL REFERENCES public.cap_actualizaciones(id),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  aprobada_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actualizacion_id, usuario_id)
);

-- 4) Repasos obligatorios: 2 incidencias graves en 90 días → repetir el módulo relacionado y su quiz en 14 días.
CREATE TABLE IF NOT EXISTS public.cap_repasos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  modulo text NOT NULL CHECK (modulo ~ '^(N0|R1|R2|P1|P2)-\d\d$'),
  motivo text NOT NULL,
  fecha_limite date NOT NULL,
  completado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  archivado_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS cap_repasos_abierto ON public.cap_repasos (usuario_id, modulo) WHERE completado_at IS NULL AND archivado_at IS NULL;

-- 5) Recertificación y quiz de microlección como tipos de intento; origen de la suspensión de una certificación.
ALTER TABLE public.cap_intentos DROP CONSTRAINT IF EXISTS cap_intentos_tipo_check;
ALTER TABLE public.cap_intentos ADD CONSTRAINT cap_intentos_tipo_check CHECK (tipo IN ('quiz_modulo', 'examen_ruta', 'recertificacion', 'actualizacion'));
ALTER TABLE public.cap_certificaciones ADD COLUMN IF NOT EXISTS suspendida_por text;  -- linea_roja | actualizacion:<id>

-- La de línea roja ahora deja dicho su origen (solo el Director la reactiva).
CREATE OR REPLACE FUNCTION app.tg_incidencia_linea_roja() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  hoy date := (now() AT TIME ZONE 'America/Mexico_City')::date;
  v_nombre text;
BEGIN
  IF NEW.severidad <> 'linea_roja' THEN RETURN NEW; END IF;
  UPDATE public.cap_certificaciones
     SET estado = 'suspendida', suspendida_por = 'linea_roja',
         motivo = 'Suspendida por incidencia de línea roja: ' || left(NEW.descripcion, 200), updated_at = now()
   WHERE usuario_id = NEW.usuario_id AND estado IN ('vigente', 'por_vencer', 'suspendida') AND archivado_at IS NULL;
  SELECT u.nombre INTO v_nombre FROM public.usuarios u WHERE u.id = NEW.usuario_id;
  INSERT INTO public.alertas (regla, caso_id, severidad, asignado_a, mensaje, fecha_disparo, clave_dedup)
  SELECT 'CAP_INCIDENCIA_LINEA_ROJA', NEW.caso_id, 'critica', d.id,
         coalesce(v_nombre, 'Asesor') || ': incidencia de línea roja; sus certificaciones quedaron suspendidas', hoy,
         'CAP_INCIDENCIA_LINEA_ROJA:' || NEW.id || ':' || d.id
    FROM public.usuarios d WHERE d.rol = 'director' AND d.activo AND d.archivado_at IS NULL
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

-- 6) RLS: el Director ve todo; cada quien, lo suyo; las microlecciones publicadas las ven todos (sin las preguntas).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cap_cambios_parametro', 'cap_preguntas_revision', 'cap_actualizaciones', 'cap_actualizaciones_usuario', 'cap_repasos'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('CREATE TRIGGER tg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION auditoria.tg_registrar()', t);
  END LOOP;
END $$;
GRANT SELECT ON public.cap_cambios_parametro TO authenticated;
CREATE POLICY cap_cambios_parametro_sel ON public.cap_cambios_parametro FOR SELECT TO authenticated USING (app.es('director'));

GRANT SELECT ON public.cap_preguntas_revision TO authenticated;
GRANT UPDATE (estado, nota, revisada_por, revisada_at) ON public.cap_preguntas_revision TO authenticated;
CREATE POLICY cap_preguntas_revision_sel ON public.cap_preguntas_revision FOR SELECT TO authenticated USING (app.es('director'));
CREATE POLICY cap_preguntas_revision_upd ON public.cap_preguntas_revision FOR UPDATE TO authenticated
  USING (app.es('director')) WITH CHECK (app.es('director') AND revisada_por = auth.uid());

GRANT SELECT (id, plantilla, cambio_id, parametro_clave, vigente_desde, titulo, contenido, estado, publicada_at, publicada_por, fecha_limite, created_at, archivado_at)
  ON public.cap_actualizaciones TO authenticated;
GRANT UPDATE (estado, publicada_at, publicada_por, fecha_limite, archivado_at) ON public.cap_actualizaciones TO authenticated;
CREATE POLICY cap_actualizaciones_sel ON public.cap_actualizaciones FOR SELECT TO authenticated
  USING (app.rol() IS NOT NULL AND (app.es('director') OR (estado = 'publicada' AND archivado_at IS NULL)));
CREATE POLICY cap_actualizaciones_upd ON public.cap_actualizaciones FOR UPDATE TO authenticated
  USING (app.es('director')) WITH CHECK (app.es('director') AND (estado = 'borrador' OR publicada_por = auth.uid()));

GRANT SELECT ON public.cap_actualizaciones_usuario TO authenticated;
CREATE POLICY cap_actualizaciones_usuario_sel ON public.cap_actualizaciones_usuario FOR SELECT TO authenticated
  USING (app.rol() IS NOT NULL AND (usuario_id = auth.uid() OR app.es('director')));

GRANT SELECT ON public.cap_repasos TO authenticated;
GRANT UPDATE (archivado_at) ON public.cap_repasos TO authenticated;
CREATE POLICY cap_repasos_sel ON public.cap_repasos FOR SELECT TO authenticated
  USING (app.rol() IS NOT NULL AND (usuario_id = auth.uid() OR app.es('director')));
CREATE POLICY cap_repasos_upd ON public.cap_repasos FOR UPDATE TO authenticated USING (app.es('director')) WITH CHECK (app.es('director'));

-- El Director, al reactivar o revocar, limpia el origen de la suspensión.
GRANT UPDATE (estado, motivo, updated_at, suspendida_por) ON public.cap_certificaciones TO authenticated;

-- 7) Plazos de la fase D (sección 9.5 y 12.3), editables en Configuración.
INSERT INTO public.parametros (clave, valor, tipo, descripcion, vigente_desde)
SELECT v.clave, v.valor, v.tipo, v.descripcion, DATE '2026-01-01'
  FROM (VALUES
    ('CAP_POR_VENCER_DIAS', '30', 'entero', 'Academia: días antes del vencimiento en que una certificación pasa a «por vencer»'),
    ('CAP_ACTUALIZACION_DIAS', '30', 'entero', 'Academia: días para aprobar una microlección de actualización antes de la suspensión'),
    ('CAP_ACTUALIZACION_RECORDATORIOS', '7,21,28', 'texto', 'Academia: días después de publicada una microlección en que se recuerda (el último es crítico)'),
    ('CAP_SIN_AVANCE_DIAS', '7', 'entero', 'Academia: días sin avance en una ruta en curso para avisar'),
    ('CAP_SOLICITUD_DIAS', '3', 'entero', 'Academia: días de una solicitud de evaluación sin atender para avisar al Director'),
    ('CAP_REPASO_DIAS', '14', 'entero', 'Academia: días para completar un repaso obligatorio'),
    ('CAP_GRAVES_DIAS', '90', 'entero', 'Academia: ventana en días para contar incidencias graves'),
    ('CAP_GRAVES_UMBRAL', '2', 'entero', 'Academia: incidencias graves en la ventana que obligan a un repaso')
  ) AS v(clave, valor, tipo, descripcion)
 WHERE NOT EXISTS (SELECT 1 FROM public.parametros p WHERE p.clave = v.clave);
