-- Base: esquema de funciones internas, hora de CDMX y folios.
-- Va antes de init porque casos.folio usa public.siguiente_folio() como DEFAULT.

CREATE SCHEMA IF NOT EXISTS app;

-- Fecha y hora oficiales del negocio. Todo "hoy" del sistema sale de aquí.
CREATE OR REPLACE FUNCTION app.ahora_cdmx() RETURNS timestamp
LANGUAGE sql STABLE AS $$ SELECT now() AT TIME ZONE 'America/Mexico_City' $$;

CREATE OR REPLACE FUNCTION app.hoy_cdmx() RETURNS date
LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'America/Mexico_City')::date $$;

-- Valor vigente de un parámetro en una fecha (sección 5.9).
CREATE OR REPLACE FUNCTION app.parametro(p_clave text, p_fecha date DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v text;
BEGIN
  SELECT valor INTO v
  FROM public.parametros
  WHERE clave = p_clave
    AND vigente_desde <= coalesce(p_fecha, app.hoy_cdmx())
    AND (vigente_hasta IS NULL OR vigente_hasta >= coalesce(p_fecha, app.hoy_cdmx()))
  ORDER BY vigente_desde DESC
  LIMIT 1;
  RETURN v;
END $$;

-- Folio consecutivo RP-0001 (2.6). Prefijo y ancho son parámetros.
-- La secuencia garantiza que dos asesores nunca reciban el mismo número.
CREATE SEQUENCE IF NOT EXISTS public.folio_seq;

CREATE OR REPLACE FUNCTION public.siguiente_folio() RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_prefijo text := coalesce(app.parametro('FOLIO_PREFIJO'), 'RP-');
  v_ancho   int  := coalesce(app.parametro('FOLIO_ANCHO')::int, 4);
  v_n       bigint := nextval('public.folio_seq');
BEGIN
  RETURN v_prefijo || lpad(v_n::text, greatest(v_ancho, length(v_n::text)), '0');
END $$;
