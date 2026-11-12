-- 13-nov-2026 · Academia, fase A (docs/CAPACITACION.md secciones 11.2 y 11.3).
-- El contenido (rutas, módulos, preguntas) vive versionado en content/academia/ y se empaqueta con la app.
-- Aquí solo el avance de cada persona. Calificar y otorgar certificaciones lo hace el servidor (motor de la
-- Academia, como el motor de comisiones): las personas no pueden escribir intentos ni certificaciones.

CREATE TABLE IF NOT EXISTS public.cap_progreso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  modulo text NOT NULL CHECK (modulo ~ '^(N0|R1|R2|P1|P2)-\d\d$'),
  version integer NOT NULL CHECK (version > 0),
  estado text NOT NULL DEFAULT 'completado' CHECK (estado IN ('leyendo', 'completado')),
  completado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, modulo, version)
);

CREATE TABLE IF NOT EXISTS public.cap_intentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  tipo text NOT NULL CHECK (tipo IN ('quiz_modulo', 'examen_ruta')),
  objetivo text NOT NULL,                       -- módulo (quiz) o ruta (examen)
  inicio timestamptz NOT NULL DEFAULT now(),
  fin timestamptz,
  preguntas jsonb NOT NULL,                     -- [{clave, version}] servidas, en orden
  respuestas jsonb,
  calificacion numeric(5,4),
  criticas_ok boolean,
  aprobado boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  archivado_at timestamptz
);
CREATE INDEX IF NOT EXISTS cap_intentos_usuario ON public.cap_intentos (usuario_id, tipo, objetivo, inicio);

CREATE TABLE IF NOT EXISTS public.cap_certificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  ruta text NOT NULL CHECK (ruta IN ('N0', 'R1', 'R2', 'P1', 'P2')),
  otorgada_at timestamptz NOT NULL DEFAULT now(),
  vence_at date,
  estado text NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'por_vencer', 'vencida', 'suspendida', 'revocada')),
  motivo text,
  otorgada_por uuid,                            -- null = el sistema (9.4)
  excepcion_hasta date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archivado_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS cap_certificaciones_viva ON public.cap_certificaciones (usuario_id, ruta)
  WHERE estado IN ('vigente', 'por_vencer') AND archivado_at IS NULL;

CREATE TABLE IF NOT EXISTS public.cap_acuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  documento text NOT NULL CHECK (documento IN ('codigo_conducta', 'privacidad_interna', 'confidencialidad')),
  version text NOT NULL,
  aceptado_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  UNIQUE (usuario_id, documento, version)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cap_progreso', 'cap_intentos', 'cap_certificaciones', 'cap_acuses'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (app.rol() IS NOT NULL AND (usuario_id = auth.uid() OR app.es(''director'')))', t || '_sel', t);
    EXECUTE format('CREATE TRIGGER tg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION auditoria.tg_registrar()', t);
  END LOOP;
END $$;

-- Lo que cada quien sí escribe: marcar lecciones leídas y firmar sus acuses (sin DELETE).
GRANT INSERT, UPDATE ON public.cap_progreso TO authenticated;
CREATE POLICY cap_progreso_ins ON public.cap_progreso FOR INSERT TO authenticated WITH CHECK (app.rol() IS NOT NULL AND usuario_id = auth.uid());
CREATE POLICY cap_progreso_upd ON public.cap_progreso FOR UPDATE TO authenticated
  USING (app.rol() IS NOT NULL AND usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
GRANT INSERT ON public.cap_acuses TO authenticated;
CREATE POLICY cap_acuses_ins ON public.cap_acuses FOR INSERT TO authenticated WITH CHECK (app.rol() IS NOT NULL AND usuario_id = auth.uid());
