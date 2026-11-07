-- Comprobante de la transferencia con que el cliente pagó el honorario. El archivo vive en el
-- bucket privado "expedientes" bajo la carpeta del caso (mismas políticas: solo quien opera el
-- caso lo sube o lo ve; el vendedor no). Aquí solo se guarda la ruta.
ALTER TABLE cobros
  ADD COLUMN comprobante_path text,
  ADD COLUMN comprobante_mime text,
  ADD COLUMN comprobante_at timestamptz(6),
  ADD COLUMN comprobante_por uuid REFERENCES usuarios(id);

-- La ruta debe estar en la carpeta del propio caso: así las políticas del bucket aplican igual.
ALTER TABLE cobros ADD CONSTRAINT cobros_comprobante_en_su_caso
  CHECK (comprobante_path IS NULL OR comprobante_path LIKE caso_id::text || '/%');
