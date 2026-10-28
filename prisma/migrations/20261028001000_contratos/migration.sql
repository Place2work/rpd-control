-- Fase 4: contratos y aviso de privacidad desde plantilla (10.4, pestaña Contrato). Solo agrega.

-- Domicilio e identificación del cliente, tal como van en el contrato.
ALTER TABLE public.personas ADD COLUMN IF NOT EXISTS domicilio text;          -- "Calle del Hule No. 63, Col. Atenatitlán, C.P. 62570, Jiutepec, Morelos"
ALTER TABLE public.personas ADD COLUMN IF NOT EXISTS identificacion text;     -- "credencial para votar vigente"
-- personas tiene permisos por columna (los cifrados no se leen): las columnas nuevas se conceden aparte.
GRANT SELECT (domicilio, identificacion) ON public.personas TO authenticated;

-- Datos del contrato que cambian por caso.
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS contrato_advertencias text;   -- una por renglón (cláusula TERCERA de fallecimiento)
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS contrato_regularizacion text; -- detalle de la regularización documental
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS contrato_pct numeric(5,4);    -- % de lo recuperado (fallecimiento)
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS contrato_generado_at timestamptz;

-- Plantillas: contrato o aviso de privacidad, con nombre visible.
ALTER TABLE public.plantillas_contrato ADD COLUMN IF NOT EXISTS clase text NOT NULL DEFAULT 'contrato';
ALTER TABLE public.plantillas_contrato ADD COLUMN IF NOT EXISTS nombre text;
CREATE UNIQUE INDEX IF NOT EXISTS plantillas_contrato_version ON public.plantillas_contrato (clase, tipo_servicio, version);

-- Otras personas del caso que no son el cliente: la beneficiaria y el finado (fallecimiento).
-- CURP y NSS cifrados como en personas; el dato completo solo con app.ver_dato_sensible().
CREATE TABLE IF NOT EXISTS public.partes_caso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id uuid NOT NULL REFERENCES public.casos (id),
  rol text NOT NULL CHECK (rol IN ('beneficiaria', 'finado')),
  nombre text NOT NULL,
  curp_cifrada bytea,
  curp_parcial text,
  nss_cifrado bytea,
  nss_ultimos4 char(4),
  domicilio text,
  identificacion text,
  relacion text,              -- beneficiaria: "madre de EL CLIENTE y cónyuge supérstite del finado …"
  parentesco_cliente text,    -- finado: lo que el cliente es del finado ("hija")
  fecha_defuncion date,
  regimen text,               -- finado: "Ley del Seguro Social de 1973"
  afore text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  archivado_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS partes_caso_rol_vivo ON public.partes_caso (caso_id, rol) WHERE archivado_at IS NULL;
ALTER TABLE public.partes_caso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partes_caso FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.partes_caso FROM anon, authenticated;
GRANT SELECT (id, caso_id, rol, nombre, curp_parcial, nss_ultimos4, domicilio, identificacion, relacion, parentesco_cliente,
              fecha_defuncion, regimen, afore, created_at, updated_at, created_by, archivado_at) ON public.partes_caso TO authenticated;
GRANT INSERT, UPDATE ON public.partes_caso TO authenticated;
CREATE POLICY partes_caso_sel ON public.partes_caso FOR SELECT TO authenticated USING (app.caso_operable(caso_id));
CREATE POLICY partes_caso_ins ON public.partes_caso FOR INSERT TO authenticated WITH CHECK (app.caso_operable(caso_id));
CREATE POLICY partes_caso_upd ON public.partes_caso FOR UPDATE TO authenticated USING (app.caso_operable(caso_id));
CREATE TRIGGER tg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.partes_caso
  FOR EACH ROW EXECUTE FUNCTION auditoria.tg_registrar();

-- ver_dato_sensible ahora también abre CURP y NSS de las partes del caso (con bitácora).
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
  ELSIF p_tabla = 'partes_caso' AND p_campo IN ('curp', 'nss') THEN
    IF p_campo = 'curp' THEN SELECT app.caso_operable(caso_id), curp_cifrada INTO v_ok, v FROM partes_caso WHERE id = p_id;
    ELSE SELECT app.caso_operable(caso_id), nss_cifrado INTO v_ok, v FROM partes_caso WHERE id = p_id; END IF;
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

-- Datos de EL PRESTADOR (iguales en contratos y aviso de privacidad) y del contrato.
INSERT INTO public.parametros (clave, valor, tipo, descripcion, vigente_desde)
SELECT x.clave, x.valor, 'texto', x.descripcion, '2026-01-01'::date FROM (VALUES
  ('PRESTADOR_NOMBRE', 'Irving Ortega Valois', 'Responsable y prestador del servicio (persona física)'),
  ('PRESTADOR_NOMBRE_COMERCIAL', 'RetiroPorDesempleo.com', 'Nombre comercial'),
  ('PRESTADOR_RFC', 'OEVI8807096I5', 'RFC del prestador'),
  ('PRESTADOR_REGIMEN', 'Régimen Simplificado de Confianza', 'Régimen fiscal'),
  ('PRESTADOR_DOMICILIO', 'Blvd. Gustavo Díaz Ordaz No. 49, Interior D-3, Col. Acapantzingo, C.P. 62440, Cuernavaca, Morelos', 'Domicilio del prestador'),
  ('PRESTADOR_BANCO', 'BBVA', 'Banco para el pago de honorarios'),
  ('PRESTADOR_CUENTA', '049 105 7618', 'Cuenta para el pago de honorarios'),
  ('PRESTADOR_CLABE', '012 540 00491057618 1', 'CLABE para el pago de honorarios'),
  ('CONTRATO_CIUDAD', 'Cuernavaca, Morelos', 'Ciudad de firma de los contratos'),
  ('FALLEC_HONORARIO_PCT_RECUPERADO', '0.40', '% de lo recuperado en pensión por fallecimiento (si el caso no trae otro)'),
  ('FALLEC_REGIMEN_TEXTO', 'Ley del Seguro Social de 1973', 'Régimen del finado por defecto en el contrato')
) AS x (clave, valor, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM public.parametros p WHERE p.clave = x.clave);
UPDATE public.parametros SET tipo = 'decimal' WHERE clave = 'FALLEC_HONORARIO_PCT_RECUPERADO';

-- Las plantillas (versión 1) se cargan desde src/lib/contratos/plantillas-iniciales.ts la primera vez que se usan.
