-- 14-nov-2026 · Academia, fase C (docs/CAPACITACION.md 9.2, 9.5, 10 y 11.2-11.3): evaluación humana, incidencias con
-- suspensión automática por línea roja, solicitudes de evaluación y metas de desempeño. Solo el Director evalúa
-- (decisión pendiente 14.2: por defecto, solo el Director). Nadie borra.

CREATE TABLE IF NOT EXISTS public.cap_evaluaciones_roleplay (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  roleplay text NOT NULL CHECK (roleplay ~ '^RP-\d\d$'),
  evaluador_id uuid NOT NULL DEFAULT auth.uid(),
  cumple jsonb NOT NULL,                       -- {criterio: true|false}
  total integer NOT NULL CHECK (total BETWEEN 0 AND 100),
  eliminatorio_fallado boolean NOT NULL,
  aprobado boolean NOT NULL,
  comentarios text,
  created_at timestamptz NOT NULL DEFAULT now(),
  archivado_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.cap_shadowing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  ruta text NOT NULL CHECK (ruta IN ('R1', 'R2')),
  caso_id uuid NOT NULL REFERENCES public.casos(id),   -- solo la liga al caso real; ningún dato del cliente
  modo text NOT NULL CHECK (modo IN ('observa', 'observado')),
  ley73 boolean NOT NULL DEFAULT false,
  evaluador_id uuid NOT NULL DEFAULT auth.uid(),
  cumple boolean NOT NULL,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  archivado_at timestamptz,
  CHECK (ruta <> 'R2' OR ley73)                 -- R2 pide casos Ley 73 acompañados
);

CREATE TABLE IF NOT EXISTS public.cap_diagnosticos_validados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  caso_id uuid NOT NULL REFERENCES public.casos(id),
  validado_por uuid NOT NULL DEFAULT auth.uid(),
  correccion_grave boolean NOT NULL,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  archivado_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.cap_entrevistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  ruta text NOT NULL DEFAULT 'P2' CHECK (ruta = 'P2'),
  evaluador_id uuid NOT NULL DEFAULT auth.uid(),
  aprobada boolean NOT NULL,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  archivado_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.cap_incidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  caso_id uuid REFERENCES public.casos(id),
  tipo text NOT NULL CHECK (tipo IN ('promesa_monto', 'dato_sensible', 'contrasena_terceros', 'documento_rechazado', 'plazo_prometido', 'alerta_ignorada', 'queja_cliente', 'otro')),
  severidad text NOT NULL CHECK (severidad IN ('leve', 'grave', 'linea_roja')),
  descripcion text NOT NULL CHECK (length(btrim(descripcion)) >= 5),
  accion text,
  registrada_por uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  archivado_at timestamptz
);
CREATE INDEX IF NOT EXISTS cap_incidencias_usuario ON public.cap_incidencias (usuario_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.cap_solicitudes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  tipo text NOT NULL CHECK (tipo IN ('roleplay', 'acompanamiento', 'entrevista')),
  referencia text NOT NULL,                     -- RP-01, R1, P2…
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'atendida', 'cancelada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cap_solicitudes_pendiente ON public.cap_solicitudes (usuario_id, tipo, referencia) WHERE estado = 'pendiente';

CREATE TABLE IF NOT EXISTS public.cap_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metrica text NOT NULL,
  valor numeric(6,4) NOT NULL CHECK (valor >= 0),
  vigente_desde date NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metrica, vigente_desde)
);
-- Metas iniciales de la sección 10 (el Director las ajusta). «bloqueados» y «linea_roja» son máximos.
INSERT INTO public.cap_metas (metrica, valor, vigente_desde, created_by) VALUES
  ('contacto_24h', 0.90, DATE '2026-01-01', NULL), ('prospecto_precalificado', 0.50, DATE '2026-01-01', NULL),
  ('apto_contrato', 0.60, DATE '2026-01-01', NULL), ('expediente_primera', 0.80, DATE '2026-01-01', NULL),
  ('bloqueados', 0.10, DATE '2026-01-01', NULL), ('no_conviene_desvio', 0.30, DATE '2026-01-01', NULL),
  ('alertas_a_tiempo', 0.90, DATE '2026-01-01', NULL), ('linea_roja', 0, DATE '2026-01-01', NULL),
  ('l73_analisis', 1.00, DATE '2026-01-01', NULL)
ON CONFLICT DO NOTHING;

-- Plazos de las métricas (sección 10): horas para el primer contacto y días para atender una alerta.
INSERT INTO public.parametros (clave, valor, tipo, descripcion, vigente_desde)
SELECT v.clave, v.valor, 'entero', v.descripcion, DATE '2026-01-01'
  FROM (VALUES ('CAP_CONTACTO_HORAS', '24', 'Desempeño: horas para el primer contacto con un prospecto'),
               ('CAP_ALERTA_DIAS', '1', 'Desempeño: días después del disparo para que una alerta cuente como atendida a tiempo')) AS v(clave, valor, descripcion)
 WHERE NOT EXISTS (SELECT 1 FROM public.parametros p WHERE p.clave = v.clave);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cap_evaluaciones_roleplay', 'cap_shadowing', 'cap_diagnosticos_validados', 'cap_entrevistas', 'cap_incidencias', 'cap_solicitudes', 'cap_metas'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('CREATE TRIGGER tg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION auditoria.tg_registrar()', t);
  END LOOP;
  -- Evaluaciones del Director: la persona ve las suyas; solo el Director las registra (y las archiva, no las borra).
  FOREACH t IN ARRAY ARRAY['cap_evaluaciones_roleplay', 'cap_shadowing', 'cap_entrevistas'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (app.rol() IS NOT NULL AND (usuario_id = auth.uid() OR app.es(''director'')))', t || '_sel', t);
    EXECUTE format('GRANT INSERT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT UPDATE (archivado_at) ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (app.es(''director'') AND evaluador_id = auth.uid() AND usuario_id <> auth.uid())', t || '_ins', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (app.es(''director'')) WITH CHECK (app.es(''director''))', t || '_upd', t);
  END LOOP;
END $$;

CREATE POLICY cap_diagnosticos_validados_sel ON public.cap_diagnosticos_validados FOR SELECT TO authenticated USING (app.rol() IS NOT NULL AND (usuario_id = auth.uid() OR app.es('director')));
GRANT INSERT ON public.cap_diagnosticos_validados TO authenticated;
GRANT UPDATE (archivado_at) ON public.cap_diagnosticos_validados TO authenticated;
CREATE POLICY cap_diagnosticos_validados_ins ON public.cap_diagnosticos_validados FOR INSERT TO authenticated WITH CHECK (app.es('director') AND validado_por = auth.uid() AND usuario_id <> auth.uid());
CREATE POLICY cap_diagnosticos_validados_upd ON public.cap_diagnosticos_validados FOR UPDATE TO authenticated USING (app.es('director')) WITH CHECK (app.es('director'));

-- Incidencias: las registran el Director o el analista (desde el caso); las ve el Director, quien la registró y la persona.
CREATE POLICY cap_incidencias_sel ON public.cap_incidencias FOR SELECT TO authenticated
  USING (app.rol() IS NOT NULL AND (app.es('director') OR usuario_id = auth.uid() OR registrada_por = auth.uid()));
GRANT INSERT ON public.cap_incidencias TO authenticated;
GRANT UPDATE (archivado_at, accion) ON public.cap_incidencias TO authenticated;
CREATE POLICY cap_incidencias_ins ON public.cap_incidencias FOR INSERT TO authenticated
  WITH CHECK (app.es('director', 'asesor') AND registrada_por = auth.uid() AND usuario_id <> auth.uid());
CREATE POLICY cap_incidencias_upd ON public.cap_incidencias FOR UPDATE TO authenticated USING (app.es('director')) WITH CHECK (app.es('director'));

-- Solicitudes: la persona pide su juego de roles, acompañamiento o entrevista; el Director la marca atendida.
CREATE POLICY cap_solicitudes_sel ON public.cap_solicitudes FOR SELECT TO authenticated USING (app.rol() IS NOT NULL AND (usuario_id = auth.uid() OR app.es('director')));
GRANT INSERT ON public.cap_solicitudes TO authenticated;
GRANT UPDATE (estado, updated_at) ON public.cap_solicitudes TO authenticated;
CREATE POLICY cap_solicitudes_ins ON public.cap_solicitudes FOR INSERT TO authenticated WITH CHECK (app.rol() IS NOT NULL AND usuario_id = auth.uid() AND estado = 'pendiente');
CREATE POLICY cap_solicitudes_upd ON public.cap_solicitudes FOR UPDATE TO authenticated
  USING (app.es('director') OR usuario_id = auth.uid()) WITH CHECK (app.es('director') OR (usuario_id = auth.uid() AND estado = 'cancelada'));

-- Metas: las ven todos; las cambia el Director (nueva vigencia).
CREATE POLICY cap_metas_sel ON public.cap_metas FOR SELECT TO authenticated USING (app.rol() IS NOT NULL);
GRANT INSERT ON public.cap_metas TO authenticated;
CREATE POLICY cap_metas_ins ON public.cap_metas FOR INSERT TO authenticated WITH CHECK (app.es('director'));
GRANT UPDATE (valor) ON public.cap_metas TO authenticated;
CREATE POLICY cap_metas_upd ON public.cap_metas FOR UPDATE TO authenticated USING (app.es('director')) WITH CHECK (app.es('director'));

-- El Director reactiva (tras revisión) o revoca certificaciones, con motivo.
GRANT UPDATE (estado, motivo, updated_at) ON public.cap_certificaciones TO authenticated;
CREATE POLICY cap_certificaciones_upd ON public.cap_certificaciones FOR UPDATE TO authenticated
  USING (app.es('director')) WITH CHECK (app.es('director') AND estado IN ('vigente', 'suspendida', 'revocada'));

-- 9.5: una incidencia de línea roja suspende de inmediato todas las certificaciones de la persona y avisa al Director.
CREATE OR REPLACE FUNCTION app.tg_incidencia_linea_roja() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  hoy date := (now() AT TIME ZONE 'America/Mexico_City')::date;
  v_nombre text;
BEGIN
  IF NEW.severidad <> 'linea_roja' THEN RETURN NEW; END IF;
  UPDATE public.cap_certificaciones
     SET estado = 'suspendida', motivo = 'Suspendida por incidencia de línea roja: ' || left(NEW.descripcion, 200), updated_at = now()
   WHERE usuario_id = NEW.usuario_id AND estado IN ('vigente', 'por_vencer') AND archivado_at IS NULL;
  SELECT u.nombre INTO v_nombre FROM public.usuarios u WHERE u.id = NEW.usuario_id;
  INSERT INTO public.alertas (regla, caso_id, severidad, asignado_a, mensaje, fecha_disparo, clave_dedup)
  SELECT 'CAP_INCIDENCIA_LINEA_ROJA', NEW.caso_id, 'critica', d.id,
         coalesce(v_nombre, 'Asesor') || ': incidencia de línea roja; sus certificaciones quedaron suspendidas', hoy,
         'CAP_INCIDENCIA_LINEA_ROJA:' || NEW.id || ':' || d.id
    FROM public.usuarios d WHERE d.rol = 'director' AND d.activo AND d.archivado_at IS NULL
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_incidencia_linea_roja AFTER INSERT ON public.cap_incidencias
  FOR EACH ROW EXECUTE FUNCTION app.tg_incidencia_linea_roja();

-- Con una suspensión vigente (línea roja), ni las excepciones temporales dan permisos.
CREATE OR REPLACE FUNCTION app.permiso_de(p_usuario uuid, p_permiso text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH u AS (SELECT rol FROM public.usuarios WHERE id = p_usuario AND activo AND archivado_at IS NULL)
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM u) THEN false
    WHEN (SELECT rol::text FROM u) NOT IN ('socio', 'vendedor') THEN true
    WHEN NOT app.academia_bloqueos_activos() THEN true
    WHEN EXISTS (SELECT 1 FROM public.cap_certificaciones s WHERE s.usuario_id = p_usuario AND s.estado = 'suspendida' AND s.archivado_at IS NULL) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.cap_permisos_ruta pr
       WHERE pr.permiso = p_permiso AND (
         EXISTS (SELECT 1 FROM public.cap_certificaciones c
                  WHERE c.usuario_id = p_usuario AND c.ruta = pr.ruta AND c.archivado_at IS NULL
                    AND c.estado IN ('vigente', 'por_vencer')
                    AND (c.vence_at IS NULL OR c.vence_at >= (now() AT TIME ZONE 'America/Mexico_City')::date))
         OR EXISTS (SELECT 1 FROM public.cap_excepciones e
                     WHERE e.usuario_id = p_usuario AND e.ruta = pr.ruta AND e.archivado_at IS NULL
                       AND e.hasta >= (now() AT TIME ZONE 'America/Mexico_City')::date)))
  END
$$;
