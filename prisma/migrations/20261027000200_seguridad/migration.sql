-- Seguridad: roles, 2FA obligatorio, RLS por rol (sección 3), columnas cifradas
-- fuera del alcance directo y lectura auditada de datos sensibles (sección 12).
--
-- Supuestos de Supabase: existen los roles anon, authenticated y service_role, y las
-- funciones auth.uid() y auth.jwt(). En local, scripts/supabase-local-stub.sql los simula.

-- ───────────── Vínculo con Supabase Auth ─────────────
ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_auth_users_fk FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE RESTRICT;

-- ───────────── Funciones de contexto ─────────────

-- 2FA: la sesión debe estar en nivel aal2 (contraseña + app autenticadora).
CREATE OR REPLACE FUNCTION app.mfa_ok() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT coalesce(auth.jwt() ->> 'aal', '') = 'aal2' $$;

-- Rol del usuario actual. Sin 2FA, sin usuario activo o archivado → NULL, y toda política falla.
CREATE OR REPLACE FUNCTION app.rol() RETURNS public."Rol"
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT u.rol FROM public.usuarios u
  WHERE u.id = auth.uid() AND u.activo AND u.archivado_at IS NULL AND app.mfa_ok()
$$;

CREATE OR REPLACE FUNCTION app.socio_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT u.socio_id FROM public.usuarios u WHERE u.id = auth.uid() AND app.mfa_ok()
$$;

CREATE OR REPLACE FUNCTION app.es(VARIADIC p_roles public."Rol"[]) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT coalesce(app.rol() = ANY (p_roles), false) $$;

-- Regla de visibilidad de un caso (sección 3):
--   director todo · asesor asignados + bandeja general (sin asignar)
--   vendedor los que trajo o vende · socio los de su cartera.
CREATE OR REPLACE FUNCTION app.caso_visible(p_caso uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.casos c
    WHERE c.id = p_caso
      AND CASE app.rol()
        WHEN 'director' THEN true
        WHEN 'asesor'   THEN c.asignado_a = auth.uid() OR c.asignado_a IS NULL
        WHEN 'vendedor' THEN c.vendedor_id = auth.uid() OR c.owner_id = auth.uid()
        WHEN 'socio'    THEN c.socio_id IS NOT NULL AND c.socio_id = app.socio_id()
        ELSE false
      END
  )
$$;

-- Expediente completo, pagos y cobros: todos menos el vendedor.
CREATE OR REPLACE FUNCTION app.caso_operable(p_caso uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT app.es('director', 'asesor', 'socio') AND app.caso_visible(p_caso) $$;

CREATE OR REPLACE FUNCTION app.persona_visible(p_persona uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE app.rol()
    WHEN 'director' THEN true
    WHEN 'asesor'   THEN true
    WHEN 'vendedor' THEN EXISTS (SELECT 1 FROM public.personas p WHERE p.id = p_persona AND p.owner_id = auth.uid())
                      OR EXISTS (SELECT 1 FROM public.casos c WHERE c.persona_id = p_persona
                                 AND (c.vendedor_id = auth.uid() OR c.owner_id = auth.uid()))
    WHEN 'socio'    THEN EXISTS (SELECT 1 FROM public.casos c WHERE c.persona_id = p_persona
                                 AND c.socio_id IS NOT NULL AND c.socio_id = app.socio_id())
    ELSE false
  END
$$;

-- ───────────── Privilegios de tabla ─────────────
-- anon no toca nada; el formulario web entra por /api/leads con la llave de servidor.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Nadie borra desde la app (sección 3): no se concede DELETE.
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA app TO authenticated;

-- La tabla de control de Prisma no es de la app (solo existe si se migró con Prisma).
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON TABLE public._prisma_migrations FROM authenticated, anon;
  END IF;
END $$;

-- Columnas cifradas: el rol authenticated no puede leerlas directamente.
-- Se leen solo con app.ver_dato_sensible(), que valida el rol y deja bitácora.
DO $$
DECLARE
  t text;
  cols text;
  sensibles text[] := ARRAY['curp_cifrada', 'nss_cifrado', 'clabe_cifrada'];
BEGIN
  FOREACH t IN ARRAY ARRAY['personas', 'datos_afore', 'referidores', 'socios'] LOOP
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = t AND column_name <> ALL (sensibles);
    EXECUTE format('REVOKE SELECT ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT (%s) ON public.%I TO authenticated', cols, t);
  END LOOP;
END $$;

-- ───────────── RLS en todas las tablas ─────────────
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Usuarios: todos ven la lista (para asignar); solo el Director la modifica.
CREATE POLICY usuarios_sel ON public.usuarios FOR SELECT TO authenticated USING (app.rol() IS NOT NULL);
CREATE POLICY usuarios_ins ON public.usuarios FOR INSERT TO authenticated WITH CHECK (app.es('director'));
CREATE POLICY usuarios_upd ON public.usuarios FOR UPDATE TO authenticated USING (app.es('director'));

-- Catálogos y configuración: lectura para todos, escritura solo Director (10.9).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tipos_servicio', 'afores', 'tipos_documento', 'tipos_documento_servicio',
                           'parametros', 'dias_inhabiles', 'plantillas_mensaje', 'plantillas_contrato',
                           'esquemas_comision'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (app.rol() IS NOT NULL)', t || '_sel', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (app.es(''director''))', t || '_ins', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (app.es(''director''))', t || '_upd', t);
  END LOOP;
END $$;

-- Personas
CREATE POLICY personas_sel ON public.personas FOR SELECT TO authenticated USING (app.persona_visible(id));
CREATE POLICY personas_ins ON public.personas FOR INSERT TO authenticated
  WITH CHECK (app.es('director', 'asesor') OR (app.es('vendedor', 'socio') AND owner_id = auth.uid()));
CREATE POLICY personas_upd ON public.personas FOR UPDATE TO authenticated USING (app.persona_visible(id));

-- Casos. Se escribe en línea (no con app.caso_visible) para que WITH CHECK evalúe
-- la fila NUEVA: un vendedor no puede pasarse un caso ajeno ni regalar el suyo.
CREATE POLICY casos_sel ON public.casos FOR SELECT TO authenticated USING (
  app.es('director')
  OR (app.es('asesor') AND (asignado_a = auth.uid() OR asignado_a IS NULL))
  OR (app.es('vendedor') AND (vendedor_id = auth.uid() OR owner_id = auth.uid()))
  OR (app.es('socio') AND socio_id = app.socio_id())
);
CREATE POLICY casos_ins ON public.casos FOR INSERT TO authenticated WITH CHECK (
  app.es('director', 'asesor')
  OR (app.es('vendedor') AND owner_id = auth.uid() AND vendedor_id = auth.uid())
  OR (app.es('socio') AND socio_id = app.socio_id())
);
CREATE POLICY casos_upd ON public.casos FOR UPDATE TO authenticated
  USING (
    app.es('director')
    OR (app.es('asesor') AND (asignado_a = auth.uid() OR asignado_a IS NULL))
    OR (app.es('vendedor') AND (vendedor_id = auth.uid() OR owner_id = auth.uid()))
    OR (app.es('socio') AND socio_id = app.socio_id())
  )
  WITH CHECK (
    app.es('director', 'asesor')  -- el asesor puede reasignar
    OR (app.es('vendedor') AND vendedor_id = auth.uid())
    OR (app.es('socio') AND socio_id = app.socio_id())
  );

-- Datos que el vendedor sí ve para precalificar (la CLABE ya está fuera por columna).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['datos_imss', 'datos_afore', 'calculos', 'eventos', 'historial_etapas'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (app.caso_visible(caso_id))', t || '_sel', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (app.caso_visible(caso_id))', t || '_ins', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (app.caso_visible(caso_id))', t || '_upd', t);
  END LOOP;
END $$;

-- Expediente y dinero: el vendedor no entra.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['documentos', 'pagos_afore', 'cobros', 'pagos_m40', 'suspensiones_contrato'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (app.caso_operable(caso_id))', t || '_sel', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (app.caso_operable(caso_id))', t || '_ins', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (app.caso_operable(caso_id))', t || '_upd', t);
  END LOOP;
END $$;

-- Alertas: cada quien las suyas; el Director todas.
CREATE POLICY alertas_sel ON public.alertas FOR SELECT TO authenticated
  USING (app.es('director') OR (app.rol() IS NOT NULL AND asignado_a = auth.uid()));
CREATE POLICY alertas_upd ON public.alertas FOR UPDATE TO authenticated
  USING (app.es('director') OR (app.rol() IS NOT NULL AND asignado_a = auth.uid()));

-- Comisiones: cada beneficiario ve su estado de cuenta; las crea y liquida el Director
-- (el motor de la fase 3 corre del lado del servidor).
CREATE POLICY comisiones_sel ON public.comisiones FOR SELECT TO authenticated USING (
  app.es('director')
  OR (app.rol() IS NOT NULL AND beneficiario_tipo = 'usuario' AND beneficiario_id = auth.uid())
  OR (app.es('socio') AND beneficiario_tipo = 'socio' AND beneficiario_id = app.socio_id())
);
CREATE POLICY comisiones_ins ON public.comisiones FOR INSERT TO authenticated WITH CHECK (app.es('director'));
CREATE POLICY comisiones_upd ON public.comisiones FOR UPDATE TO authenticated USING (app.es('director'));

-- Referidores: todos los eligen al capturar; alta Director y asesor.
CREATE POLICY referidores_sel ON public.referidores FOR SELECT TO authenticated USING (app.rol() IS NOT NULL);
CREATE POLICY referidores_ins ON public.referidores FOR INSERT TO authenticated WITH CHECK (app.es('director', 'asesor'));
CREATE POLICY referidores_upd ON public.referidores FOR UPDATE TO authenticated USING (app.es('director', 'asesor'));

-- Socios: Director y asesor; cada socio solo el suyo.
CREATE POLICY socios_sel ON public.socios FOR SELECT TO authenticated
  USING (app.es('director', 'asesor') OR (app.es('socio') AND id = app.socio_id()));
CREATE POLICY socios_ins ON public.socios FOR INSERT TO authenticated WITH CHECK (app.es('director'));
CREATE POLICY socios_upd ON public.socios FOR UPDATE TO authenticated USING (app.es('director'));

-- ARCO y tareas: solo Director.
CREATE POLICY arco_sel ON public.solicitudes_arco FOR SELECT TO authenticated USING (app.es('director'));
CREATE POLICY arco_ins ON public.solicitudes_arco FOR INSERT TO authenticated WITH CHECK (app.es('director'));
CREATE POLICY arco_upd ON public.solicitudes_arco FOR UPDATE TO authenticated USING (app.es('director'));
CREATE POLICY tareas_sel ON public.ejecuciones_tarea FOR SELECT TO authenticated USING (app.es('director'));

-- ───────────── Bitácora: solo lectura para el Director ─────────────
REVOKE ALL ON ALL TABLES IN SCHEMA auditoria FROM anon, authenticated;
GRANT USAGE ON SCHEMA auditoria TO authenticated;
GRANT SELECT ON auditoria.auditoria TO authenticated;
ALTER TABLE auditoria.auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria.auditoria FORCE ROW LEVEL SECURITY;
CREATE POLICY auditoria_sel ON auditoria.auditoria FOR SELECT TO authenticated USING (app.es('director'));

-- IP del cliente: la pone PostgREST o, en el camino de Prisma, lib/db/prisma.ts.
CREATE OR REPLACE FUNCTION app.ip_cliente() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(trim(split_part(coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)), '')
$$;

-- ───────────── Lectura auditada de datos sensibles ─────────────
-- Devuelve el valor CIFRADO; el servidor lo descifra con la llave del gestor de secretos.
-- Cada llamada deja un renglón VER_SENSIBLE en la bitácora (criterio 14.2).
CREATE OR REPLACE FUNCTION app.ver_dato_sensible(p_tabla text, p_id uuid, p_campo text)
RETURNS bytea
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v bytea;
  v_ok boolean;
BEGIN
  IF NOT app.es('director', 'asesor', 'socio') THEN
    RAISE EXCEPTION 'Tu rol no puede ver este dato completo' USING ERRCODE = '42501';
  END IF;

  IF p_tabla = 'personas' AND p_campo IN ('curp', 'nss') THEN
    v_ok := app.persona_visible(p_id);
    IF p_campo = 'curp' THEN SELECT curp_cifrada INTO v FROM personas WHERE id = p_id;
    ELSE SELECT nss_cifrado INTO v FROM personas WHERE id = p_id; END IF;
  ELSIF p_tabla = 'datos_afore' AND p_campo = 'clabe' THEN
    SELECT app.caso_operable(caso_id), clabe_cifrada INTO v_ok, v FROM datos_afore WHERE id = p_id;
  ELSIF p_tabla IN ('referidores', 'socios') AND p_campo = 'clabe' AND app.es('director') THEN
    v_ok := true;
    EXECUTE format('SELECT clabe_cifrada FROM public.%I WHERE id = $1', p_tabla) INTO v USING p_id;
  ELSE
    RAISE EXCEPTION 'Dato no permitido: %.%', p_tabla, p_campo USING ERRCODE = '42501';
  END IF;

  IF NOT coalesce(v_ok, false) THEN
    RAISE EXCEPTION 'Sin acceso a este registro' USING ERRCODE = '42501';
  END IF;

  INSERT INTO auditoria.auditoria (tabla, registro_id, accion, campo, usuario_id, ip)
  VALUES (p_tabla, p_id::text, 'VER_SENSIBLE', p_campo, auth.uid(), app.ip_cliente());

  RETURN v;
END $$;

-- Detección de duplicados (10.2) sin revelar a quién pertenece el registro.
-- Recibe los hashes HMAC que calcula el servidor; nunca el dato en claro.
CREATE OR REPLACE FUNCTION app.buscar_duplicados(p_telefono text, p_curp_hash text, p_nss_hash text)
RETURNS TABLE (campo text, persona_id uuid, visible boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT x.campo, CASE WHEN app.persona_visible(x.id) THEN x.id END, app.persona_visible(x.id)
  FROM (
    SELECT 'telefono' AS campo, id FROM personas
      WHERE p_telefono IS NOT NULL AND (telefono = p_telefono OR whatsapp = p_telefono)
    UNION ALL SELECT 'curp', id FROM personas WHERE p_curp_hash IS NOT NULL AND curp_hash = p_curp_hash
    UNION ALL SELECT 'nss', id FROM personas WHERE p_nss_hash IS NOT NULL AND nss_hash = p_nss_hash
  ) x
  WHERE app.rol() IS NOT NULL AND x.id IS NOT NULL
$$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM anon, public;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO authenticated;
