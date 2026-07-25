-- Sprint 6: reportes de ventas (REPORTE_VENTAS, bitácora de generación)

-- CreateTable
CREATE TABLE "reporte_ventas" (
    "id_reporte" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fecha_generacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "ruta_exportacion" VARCHAR(300),
    "id_artesano" UUID NOT NULL,

    CONSTRAINT "reporte_ventas_pkey" PRIMARY KEY ("id_reporte")
);

-- CreateIndex
CREATE INDEX "reporte_ventas_id_artesano_fecha_generacion_idx" ON "reporte_ventas"("id_artesano", "fecha_generacion");

-- AddForeignKey
ALTER TABLE "reporte_ventas" ADD CONSTRAINT "reporte_ventas_id_artesano_fkey" FOREIGN KEY ("id_artesano") REFERENCES "artesano"("id_artesano") ON DELETE CASCADE ON UPDATE CASCADE;

-- restricciones check
ALTER TABLE "reporte_ventas"
  ADD CONSTRAINT "chk_reporte_periodo" CHECK ("fecha_fin" >= "fecha_inicio");
