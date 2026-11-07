-- «Eliminar» una nota del seguimiento: nadie borra, se archiva (deja de verse y de contar como contacto).
ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS archivado_at timestamptz(6),
  ADD COLUMN IF NOT EXISTS archivado_por uuid REFERENCES public.usuarios(id);

-- Solo se archivan notas que escribió una persona; los registros del sistema son el historial del caso.
ALTER TABLE public.eventos ADD CONSTRAINT eventos_archivar_solo_notas
  CHECK (archivado_at IS NULL OR tipo IN ('nota', 'llamada', 'whatsapp', 'correo'));
