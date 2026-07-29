-- RNF_012: cada fotografía se almacena como dos derivados comprimidos.
--   ruta_webp -> se sirve en inventario, galería y ficha pública
--   ruta_jpeg -> se incrusta en el certificado PDF (PDFKit no admite WebP)
--
-- La columna ruta_archivo guardaba el archivo original sin comprimir y deja de
-- existir. Las filas previas apuntan a archivos que no tienen equivalente
-- comprimido, por lo que se migra su valor a ambas columnas: el registro
-- conserva su referencia y las fotografías que se vuelvan a cargar quedan ya
-- con los derivados nuevos.

ALTER TABLE "foto_artesania"
  ADD COLUMN "ruta_webp" VARCHAR(300),
  ADD COLUMN "ruta_jpeg" VARCHAR(300);

UPDATE "foto_artesania"
   SET "ruta_webp" = "ruta_archivo",
       "ruta_jpeg" = "ruta_archivo"
 WHERE "ruta_webp" IS NULL;

ALTER TABLE "foto_artesania"
  ALTER COLUMN "ruta_webp" SET NOT NULL,
  ALTER COLUMN "ruta_jpeg" SET NOT NULL;

ALTER TABLE "foto_artesania" DROP COLUMN "ruta_archivo";
