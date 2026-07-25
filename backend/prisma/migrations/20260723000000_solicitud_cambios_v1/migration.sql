-- Solicitud de cambios v1.0 (CAM-009, CAM-012, CAM-013, CAM-015)

-- CAM-013: borrado lógico de artesanías (el motivo se conserva junto al registro)
ALTER TABLE "artesania"
  ADD COLUMN "eliminado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "motivo_eliminacion" TEXT,
  ADD COLUMN "fecha_eliminacion" TIMESTAMPTZ(6);

CREATE INDEX "artesania_eliminado_idx" ON "artesania"("eliminado");

-- CAM-012: borrado lógico de compras y sus detalles
ALTER TABLE "compra"
  ADD COLUMN "eliminado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "motivo_eliminacion" TEXT,
  ADD COLUMN "fecha_eliminacion" TIMESTAMPTZ(6);

CREATE INDEX "compra_eliminado_idx" ON "compra"("eliminado");

ALTER TABLE "detalle_compra"
  ADD COLUMN "eliminado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "motivo_eliminacion" TEXT,
  ADD COLUMN "fecha_eliminacion" TIMESTAMPTZ(6);

-- CAM-015: domicilio completo del proveedor (misma estructura que GALERIA; todos opcionales)
ALTER TABLE "proveedor"
  ADD COLUMN "calle" VARCHAR(100),
  ADD COLUMN "numero" VARCHAR(10),
  ADD COLUMN "numero_interior" VARCHAR(10),
  ADD COLUMN "colonia" VARCHAR(100),
  ADD COLUMN "codigo_postal" VARCHAR(10);

-- CAM-009: eliminación del catálogo "Tipos de material".
-- Migración destructiva acordada: los registros existentes son datos de prueba,
-- se asume la pérdida total del dato sin respaldo ni migración.
ALTER TABLE "materia_prima" DROP COLUMN "id_tipo_material";

DROP TABLE "tipo_material";
