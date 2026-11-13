-- 16-nov-2026 · Gerente de campo: levanta prospectos en la calle con módulo, banner y volantes. Se le paga por día
-- trabajado (foto del módulo aprobada) y por prospecto verificado por el analista. Lo verificado/aprobado de lunes a
-- domingo se paga el miércoles siguiente. Sus prospectos quedan en una tabla aparte: no toca la base de clientes; al
-- verificarlo, el analista lo convierte en prospecto normal (persona + caso) y lo asigna.

CREATE TABLE IF NOT EXISTS public.campo_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gerente_id uuid NOT NULL REFERENCES public.usuarios(id),
  semana_inicio date NOT NULL,
  semana_fin date NOT NULL,
  fecha_pago date NOT NULL,
  prospectos integer NOT NULL CHECK (prospectos >= 0),
  dias integer NOT NULL CHECK (dias >= 0),
  monto_prospectos_cent bigint NOT NULL CHECK (monto_prospectos_cent >= 0),
  monto_dias_cent bigint NOT NULL CHECK (monto_dias_cent >= 0),
  total_cent bigint NOT NULL CHECK (total_cent = monto_prospectos_cent + monto_dias_cent),
  referencia text,
  pagado_por uuid NOT NULL DEFAULT auth.uid(),
  pagado_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gerente_id, semana_fin)
);

CREATE TABLE IF NOT EXISTS public.campo_prospectos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gerente_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.usuarios(id),
  nombre text NOT NULL CHECK (length(btrim(nombre)) >= 2),
  whatsapp text NOT NULL CHECK (whatsapp ~ '^\+52\d{10}$'),
  municipio text NOT NULL CHECK (length(btrim(municipio)) >= 2),
  lugar text,
  tipo_servicio text REFERENCES public.tipos_servicio(clave),
  fecha_baja date,
  notas text,
  fecha_registro date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Mexico_City')::date,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'verificado', 'rechazado')),
  motivo_rechazo text,
  intentos integer NOT NULL DEFAULT 0,
  ultimo_intento_at timestamptz,
  verificado_por uuid,
  verificado_at timestamptz,
  monto_cent bigint CHECK (monto_cent >= 0),
  caso_id uuid REFERENCES public.casos(id),
  pago_id uuid REFERENCES public.campo_pagos(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  archivado_at timestamptz,
  CHECK (estado <> 'verificado' OR (verificado_at IS NOT NULL AND monto_cent IS NOT NULL)),
  CHECK (estado <> 'rechazado' OR length(btrim(coalesce(motivo_rechazo, ''))) >= 3),
  CHECK (pago_id IS NULL OR estado = 'verificado')
);
CREATE INDEX IF NOT EXISTS campo_prospectos_gerente ON public.campo_prospectos (gerente_id, estado, created_at DESC);
CREATE INDEX IF NOT EXISTS campo_prospectos_whatsapp ON public.campo_prospectos (whatsapp) WHERE estado <> 'rechazado';

CREATE TABLE IF NOT EXISTS public.campo_jornadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gerente_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.usuarios(id),
  fecha date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Mexico_City')::date,
  municipio text NOT NULL CHECK (length(btrim(municipio)) >= 2),
  lugar text NOT NULL CHECK (length(btrim(lugar)) >= 2),
  foto_path text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  motivo text,
  revisada_por uuid,
  revisada_at timestamptz,
  monto_cent bigint CHECK (monto_cent >= 0),
  pago_id uuid REFERENCES public.campo_pagos(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (estado <> 'aprobada' OR (revisada_at IS NOT NULL AND monto_cent IS NOT NULL)),
  CHECK (estado <> 'rechazada' OR length(btrim(coalesce(motivo, ''))) >= 3),
  CHECK (pago_id IS NULL OR estado = 'aprobada'),
  CHECK (foto_path ~ ('^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic)$'))
);
-- Un día cuenta una vez: si la rechazan, puede volver a subirla ese mismo día.
CREATE UNIQUE INDEX IF NOT EXISTS campo_jornadas_dia ON public.campo_jornadas (gerente_id, fecha) WHERE estado <> 'rechazada';

-- ¿Ese WhatsApp ya está registrado (clientes o prospectos de campo vivos)? Solo responde sí o no.
CREATE OR REPLACE FUNCTION app.telefono_registrado(p_whatsapp text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT app.rol() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.personas WHERE telefono = p_whatsapp OR whatsapp = p_whatsapp)
    OR EXISTS (SELECT 1 FROM public.campo_prospectos WHERE whatsapp = p_whatsapp AND estado <> 'rechazado' AND archivado_at IS NULL))
$$;
REVOKE ALL ON FUNCTION app.telefono_registrado(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.telefono_registrado(text) TO authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['campo_pagos', 'campo_prospectos', 'campo_jornadas'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('CREATE TRIGGER tg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION auditoria.tg_registrar()', t);
  END LOOP;
END $$;

-- Prospectos de campo: el gerente da de alta y ve los suyos; el analista y el Director verifican y ven todos.
CREATE POLICY campo_prospectos_sel ON public.campo_prospectos FOR SELECT TO authenticated
  USING (app.es('director', 'asesor') OR (app.es('campo') AND gerente_id = auth.uid()));
GRANT INSERT (nombre, whatsapp, municipio, lugar, tipo_servicio, fecha_baja, notas) ON public.campo_prospectos TO authenticated;
CREATE POLICY campo_prospectos_ins ON public.campo_prospectos FOR INSERT TO authenticated
  WITH CHECK (app.es('campo') AND gerente_id = auth.uid());
GRANT UPDATE (estado, motivo_rechazo, intentos, ultimo_intento_at, verificado_por, verificado_at, monto_cent, caso_id, pago_id, archivado_at)
  ON public.campo_prospectos TO authenticated;
CREATE POLICY campo_prospectos_upd ON public.campo_prospectos FOR UPDATE TO authenticated
  USING (app.es('director', 'asesor')) WITH CHECK (app.es('director', 'asesor') AND (pago_id IS NULL OR app.es('director')));

-- Jornadas (foto del módulo): el gerente sube la del día; el analista o el Director la aprueban.
CREATE POLICY campo_jornadas_sel ON public.campo_jornadas FOR SELECT TO authenticated
  USING (app.es('director', 'asesor') OR (app.es('campo') AND gerente_id = auth.uid()));
GRANT INSERT (municipio, lugar, foto_path) ON public.campo_jornadas TO authenticated;
CREATE POLICY campo_jornadas_ins ON public.campo_jornadas FOR INSERT TO authenticated
  WITH CHECK (app.es('campo') AND gerente_id = auth.uid() AND split_part(foto_path, '/', 1) = auth.uid()::text);
GRANT UPDATE (estado, motivo, revisada_por, revisada_at, monto_cent, pago_id) ON public.campo_jornadas TO authenticated;
CREATE POLICY campo_jornadas_upd ON public.campo_jornadas FOR UPDATE TO authenticated
  USING (app.es('director', 'asesor')) WITH CHECK (app.es('director', 'asesor') AND (pago_id IS NULL OR app.es('director')));

-- Pagos semanales: solo el Director los registra; el gerente ve los suyos.
CREATE POLICY campo_pagos_sel ON public.campo_pagos FOR SELECT TO authenticated
  USING (app.es('director') OR (app.es('campo') AND gerente_id = auth.uid()));
GRANT INSERT ON public.campo_pagos TO authenticated;
CREATE POLICY campo_pagos_ins ON public.campo_pagos FOR INSERT TO authenticated
  WITH CHECK (app.es('director') AND pagado_por = auth.uid());

-- Fotos del módulo: bucket privado, carpeta por gerente. Las ve él, el analista y el Director. Sin borrar.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('campo', 'campo', false, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET public = false;
CREATE POLICY campo_fotos_ins ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campo' AND app.es('campo') AND split_part(name, '/', 1) = auth.uid()::text);
CREATE POLICY campo_fotos_sel ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'campo' AND (app.es('director', 'asesor') OR (app.es('campo') AND split_part(name, '/', 1) = auth.uid()::text)));

-- Tarifas (las pone el Director en Configuración, con vigencia) y el día de pago: el corte es el domingo y se paga
-- N días después (3 = miércoles).
INSERT INTO public.parametros (clave, valor, tipo, descripcion, vigente_desde)
SELECT v.clave, v.valor, v.tipo, v.descripcion, DATE '2026-01-01'
  FROM (VALUES
    ('CAMPO_PAGO_PROSPECTO', '20', 'decimal', 'Gerente de campo: pago por prospecto verificado (pesos)'),
    ('CAMPO_PAGO_DIA', '0', 'decimal', 'Gerente de campo: pago por día trabajado con foto aprobada (pesos)'),
    ('CAMPO_DIAS_PARA_PAGO', '3', 'entero', 'Gerente de campo: días después del corte del domingo en que se paga (3 = miércoles)')
  ) AS v(clave, valor, tipo, descripcion)
 WHERE NOT EXISTS (SELECT 1 FROM public.parametros p WHERE p.clave = v.clave);
