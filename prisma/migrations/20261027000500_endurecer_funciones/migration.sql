-- Endurecimiento según el asesor de seguridad de Supabase.

-- 1. El generador de folios sale del esquema expuesto por la API (public). Antes cualquiera,
--    incluso sin sesión, podía llamarlo en /rest/v1/rpc/siguiente_folio y quemar folios.
CREATE OR REPLACE FUNCTION app.siguiente_folio() RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_prefijo text := coalesce(app.parametro('FOLIO_PREFIJO'), 'RP-');
  v_ancho   int  := coalesce(app.parametro('FOLIO_ANCHO')::int, 4);
  v_n       bigint := nextval('public.folio_seq');
BEGIN
  RETURN v_prefijo || lpad(v_n::text, greatest(v_ancho, length(v_n::text)), '0');
END $$;
REVOKE EXECUTE ON FUNCTION app.siguiente_folio() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app.siguiente_folio() TO authenticated;

ALTER TABLE public.casos ALTER COLUMN folio SET DEFAULT app.siguiente_folio();
-- La función vieja se conserva (no se borra nada) pero nadie de la API puede llamarla.
REVOKE EXECUTE ON FUNCTION public.siguiente_folio() FROM PUBLIC, anon, authenticated;

-- 2. search_path fijo en todas las funciones propias.
ALTER FUNCTION app.ahora_cdmx() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION app.hoy_cdmx() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION app.mfa_ok() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION app.es(VARIADIC public."Rol"[]) SET search_path = public, pg_temp;
ALTER FUNCTION app.caso_operable(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION app.ip_cliente() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION app.tg_sellos() SET search_path = public, pg_temp;
ALTER FUNCTION auditoria.tg_inmutable() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION app.tg_dictamen_manual() SET search_path = public, pg_temp;
ALTER FUNCTION app.tg_ultimo_retiro() SET search_path = public, pg_temp;
ALTER FUNCTION app.caso_de_ruta(text) SET search_path = pg_catalog, pg_temp;
