-- Fase 4: suscripción al calendario con liga privada (.ics). Solo agrega.
-- Cada usuario tiene a lo más una liga viva; generar otra revoca la anterior. Se guarda el HMAC
-- del token, nunca el token.
CREATE TABLE IF NOT EXISTS public.calendario_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios (id),
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  ultimo_uso_at timestamptz,
  revocado_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS calendario_tokens_vivo ON public.calendario_tokens (usuario_id) WHERE revocado_at IS NULL;
ALTER TABLE public.calendario_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario_tokens FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendario_tokens FROM anon, authenticated;
GRANT SELECT (id, usuario_id, created_at, ultimo_uso_at, revocado_at) ON public.calendario_tokens TO authenticated;
GRANT INSERT, UPDATE ON public.calendario_tokens TO authenticated;
CREATE POLICY calendario_tokens_sel ON public.calendario_tokens FOR SELECT TO authenticated USING (app.rol() IS NOT NULL AND usuario_id = auth.uid());
CREATE POLICY calendario_tokens_ins ON public.calendario_tokens FOR INSERT TO authenticated WITH CHECK (app.rol() IS NOT NULL AND usuario_id = auth.uid());
CREATE POLICY calendario_tokens_upd ON public.calendario_tokens FOR UPDATE TO authenticated USING (app.rol() IS NOT NULL AND usuario_id = auth.uid());
CREATE TRIGGER tg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.calendario_tokens
  FOR EACH ROW EXECUTE FUNCTION auditoria.tg_registrar();
