-- 13-nov-2026 · Academia, fase B (docs/CAPACITACION.md 3.2, 9.1 y 11): simulador, permisos por certificación
-- con interruptor (apagado hasta que el Director lo encienda) y excepciones temporales.

-- 1) Intentos del simulador: los escribe el motor (nadie se autoaprueba).
CREATE TABLE IF NOT EXISTS public.cap_casos_intentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  caso text NOT NULL CHECK (caso ~ '^C-[RP]\d\d$'),
  version integer NOT NULL,
  captura jsonb NOT NULL,
  resultado_motor jsonb,
  diferencias jsonb,
  aprobado boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cap_casos_intentos_usuario ON public.cap_casos_intentos (usuario_id, caso);

-- 2) Excepción temporal de permisos (máx. 30 días, con motivo; solo el Director).
CREATE TABLE IF NOT EXISTS public.cap_excepciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  ruta text NOT NULL CHECK (ruta IN ('N0', 'R1', 'R2', 'P1', 'P2')),
  hasta date NOT NULL,
  motivo text NOT NULL CHECK (length(btrim(motivo)) >= 5),
  otorgada_por uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  archivado_at timestamptz,
  CHECK (hasta <= ((created_at AT TIME ZONE 'America/Mexico_City')::date + 30))
);

-- 3) Qué habilita cada certificación (content/academia/rutas.json; cada ruta incluye las de sus prerrequisitos).
CREATE TABLE IF NOT EXISTS public.cap_permisos_ruta (
  ruta text NOT NULL,
  permiso text NOT NULL,
  PRIMARY KEY (ruta, permiso)
);
INSERT INTO public.cap_permisos_ruta (ruta, permiso) VALUES
  ('N0', 'prospecto.crear'),
  ('N0', 'prospecto.nota'),
  ('N0', 'prospecto.seguimiento'),
  ('N0', 'whatsapp.plantillas'),
  ('R1', 'contrato.retiro.generar'),
  ('R1', 'documentos.solicitar'),
  ('R1', 'precalificacion.retiro'),
  ('R1', 'prospecto.crear'),
  ('R1', 'prospecto.nota'),
  ('R1', 'prospecto.seguimiento'),
  ('R1', 'whatsapp.plantillas'),
  ('R2', 'analisis_impacto.borrador'),
  ('R2', 'caso.desvio.crear'),
  ('R2', 'contrato.retiro.generar'),
  ('R2', 'documentos.solicitar'),
  ('R2', 'precalificacion.retiro'),
  ('R2', 'precalificacion.retiro.L73'),
  ('R2', 'prospecto.crear'),
  ('R2', 'prospecto.nota'),
  ('R2', 'prospecto.seguimiento'),
  ('R2', 'whatsapp.plantillas'),
  ('P1', 'analisis_impacto.borrador'),
  ('P1', 'caso.desvio.crear'),
  ('P1', 'contrato.retiro.generar'),
  ('P1', 'diagnostico_inicial.capturar'),
  ('P1', 'documentos.solicitar'),
  ('P1', 'precalificacion.retiro'),
  ('P1', 'precalificacion.retiro.L73'),
  ('P1', 'prospecto.crear'),
  ('P1', 'prospecto.nota'),
  ('P1', 'prospecto.pension.recibir'),
  ('P1', 'prospecto.seguimiento'),
  ('P1', 'whatsapp.plantillas'),
  ('P2', 'analisis_impacto.borrador'),
  ('P2', 'caso.desvio.crear'),
  ('P2', 'contrato.retiro.generar'),
  ('P2', 'diagnostico_inicial.capturar'),
  ('P2', 'documentos.solicitar'),
  ('P2', 'fallecimiento.integrar_expediente'),
  ('P2', 'plan_pension.presentar'),
  ('P2', 'precalificacion.retiro'),
  ('P2', 'precalificacion.retiro.L73'),
  ('P2', 'prospecto.crear'),
  ('P2', 'prospecto.nota'),
  ('P2', 'prospecto.pension.recibir'),
  ('P2', 'prospecto.seguimiento'),
  ('P2', 'whatsapp.plantillas')
ON CONFLICT DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cap_casos_intentos', 'cap_excepciones'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (app.rol() IS NOT NULL AND (usuario_id = auth.uid() OR app.es(''director'')))', t || '_sel', t);
    EXECUTE format('CREATE TRIGGER tg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION auditoria.tg_registrar()', t);
  END LOOP;
END $$;
GRANT INSERT ON public.cap_excepciones TO authenticated;
GRANT UPDATE (archivado_at) ON public.cap_excepciones TO authenticated;
CREATE POLICY cap_excepciones_ins ON public.cap_excepciones FOR INSERT TO authenticated WITH CHECK (app.es('director') AND otorgada_por = auth.uid());
CREATE POLICY cap_excepciones_upd ON public.cap_excepciones FOR UPDATE TO authenticated USING (app.es('director')) WITH CHECK (app.es('director'));
ALTER TABLE public.cap_permisos_ruta ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cap_permisos_ruta FROM anon, authenticated;
GRANT SELECT ON public.cap_permisos_ruta TO authenticated;
CREATE POLICY cap_permisos_ruta_sel ON public.cap_permisos_ruta FOR SELECT TO authenticated USING (app.rol() IS NOT NULL);

-- 4) Interruptor: apagado. El Director lo enciende (nueva vigencia en parametros) cuando el equipo esté certificado.
INSERT INTO public.parametros (clave, valor, tipo, descripcion, vigente_desde)
SELECT 'ACADEMIA_BLOQUEOS', 'apagado', 'texto', 'Academia: bloquear funciones del CRM a quien no tenga la certificación (apagado | encendido)', DATE '2026-01-01'
WHERE NOT EXISTS (SELECT 1 FROM public.parametros WHERE clave = 'ACADEMIA_BLOQUEOS');

CREATE OR REPLACE FUNCTION app.academia_bloqueos_activos() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce((
    SELECT valor = 'encendido' FROM public.parametros
     WHERE clave = 'ACADEMIA_BLOQUEOS'
       AND vigente_desde <= (now() AT TIME ZONE 'America/Mexico_City')::date
       AND (vigente_hasta IS NULL OR vigente_hasta >= (now() AT TIME ZONE 'America/Mexico_City')::date)
     ORDER BY vigente_desde DESC LIMIT 1), false)
$$;

-- Permiso de una persona (3.2): solo aplica al asesor de pensiones (rol socio; también el antiguo vendedor). Con el
-- interruptor apagado, todos conservan sus permisos de siempre.
CREATE OR REPLACE FUNCTION app.permiso_de(p_usuario uuid, p_permiso text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH u AS (SELECT rol FROM public.usuarios WHERE id = p_usuario AND activo AND archivado_at IS NULL)
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM u) THEN false
    WHEN (SELECT rol::text FROM u) NOT IN ('socio', 'vendedor') THEN true
    WHEN NOT app.academia_bloqueos_activos() THEN true
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

-- tienePermiso del usuario de la sesión.
CREATE OR REPLACE FUNCTION app.tiene_permiso(p_permiso text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT app.rol() IS NOT NULL AND app.permiso_de(auth.uid(), p_permiso)
$$;

-- Permiso de otra persona: solo lo consultan el Director y el analista (para asignarle casos).
CREATE OR REPLACE FUNCTION app.permiso_de_otro(p_usuario uuid, p_permiso text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE WHEN app.es('director', 'asesor') THEN app.permiso_de(p_usuario, p_permiso) ELSE NULL END
$$;
REVOKE ALL ON FUNCTION app.permiso_de(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.permiso_de_otro(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.permiso_de_otro(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION app.tiene_permiso(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.tiene_permiso(text) TO authenticated;
GRANT EXECUTE ON FUNCTION app.academia_bloqueos_activos() TO authenticated;

CREATE OR REPLACE VIEW public.v_permisos_usuario WITH (security_invoker = true) AS
  SELECT DISTINCT permiso FROM public.cap_permisos_ruta WHERE app.tiene_permiso(permiso);
REVOKE ALL ON public.v_permisos_usuario FROM anon;
GRANT SELECT ON public.v_permisos_usuario TO authenticated;

-- 5) Candado en la base: precalificar un retiro (y uno Ley 73) requiere la certificación cuando el interruptor está
--    encendido. Es RESTRICTIVA: se suma a la política de siempre (caso visible).
CREATE POLICY calculos_ins_academia ON public.calculos AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (app.tiene_permiso('precalificacion.retiro')
    AND (coalesce(entradas->>'regimen', '') <> 'L73' OR app.tiene_permiso('precalificacion.retiro.L73')));
