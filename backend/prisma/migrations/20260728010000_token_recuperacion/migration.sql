-- HU-1: recuperación de contraseña por correo electrónico.
--
-- Del token solo se conserva su hash SHA-256 (64 caracteres hexadecimales); el
-- valor en claro viaja únicamente en el correo. La vigencia es corta y el uso
-- es único: fecha_uso se sella al consumirlo y ya no vuelve a ser válido.

CREATE TABLE "token_recuperacion" (
  "id_token"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "token_hash"       CHAR(64)     NOT NULL,
  "fecha_solicitud"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "fecha_expiracion" TIMESTAMPTZ(6) NOT NULL,
  "fecha_uso"        TIMESTAMPTZ(6),
  "id_artesano"      UUID         NOT NULL,

  CONSTRAINT "token_recuperacion_pkey" PRIMARY KEY ("id_token")
);

-- El hash es la clave de búsqueda al confirmar: única y con índice implícito
CREATE UNIQUE INDEX "token_recuperacion_token_hash_key"
  ON "token_recuperacion"("token_hash");

-- Sirve al conteo de solicitudes por hora y a la invalidación por artesano
CREATE INDEX "token_recuperacion_id_artesano_fecha_solicitud_idx"
  ON "token_recuperacion"("id_artesano", "fecha_solicitud");

ALTER TABLE "token_recuperacion"
  ADD CONSTRAINT "token_recuperacion_id_artesano_fkey"
  FOREIGN KEY ("id_artesano") REFERENCES "artesano"("id_artesano")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- La vigencia nunca puede ser anterior a la solicitud
ALTER TABLE "token_recuperacion"
  ADD CONSTRAINT "chk_token_vigencia" CHECK ("fecha_expiracion" > "fecha_solicitud"),
  ADD CONSTRAINT "chk_token_uso" CHECK ("fecha_uso" IS NULL OR "fecha_uso" >= "fecha_solicitud");
