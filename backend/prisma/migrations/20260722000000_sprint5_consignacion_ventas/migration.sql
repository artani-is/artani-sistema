-- Sprint 5: consignación y ventas (CONSIGNACION, VENTA)

-- CreateEnum
CREATE TYPE "estado_consignacion" AS ENUM ('ACTIVA', 'DEVUELTA', 'VENDIDA');

-- CreateTable
CREATE TABLE "consignacion" (
    "id_consignacion" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fecha_salida" DATE NOT NULL DEFAULT CURRENT_DATE,
    "fecha_retorno" DATE,
    "estado_consig" "estado_consignacion" NOT NULL DEFAULT 'ACTIVA',
    "porcentaje_comision" DECIMAL(5,2),
    "id_artesania" UUID NOT NULL,
    "id_galeria" UUID NOT NULL,

    CONSTRAINT "consignacion_pkey" PRIMARY KEY ("id_consignacion")
);

-- CreateTable
CREATE TABLE "venta" (
    "id_venta" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fecha_venta" DATE NOT NULL DEFAULT CURRENT_DATE,
    "monto_cobrado" DECIMAL(10,2) NOT NULL,
    "id_artesania" UUID NOT NULL,
    "id_consignacion" UUID,

    CONSTRAINT "venta_pkey" PRIMARY KEY ("id_venta")
);

-- CreateIndex
CREATE INDEX "consignacion_id_artesania_idx" ON "consignacion"("id_artesania");

-- CreateIndex
CREATE INDEX "consignacion_id_galeria_idx" ON "consignacion"("id_galeria");

-- CreateIndex
CREATE INDEX "consignacion_estado_consig_idx" ON "consignacion"("estado_consig");

-- CreateIndex
CREATE UNIQUE INDEX "venta_id_artesania_key" ON "venta"("id_artesania");

-- CreateIndex
CREATE UNIQUE INDEX "venta_id_consignacion_key" ON "venta"("id_consignacion");

-- AddForeignKey
ALTER TABLE "consignacion" ADD CONSTRAINT "consignacion_id_artesania_fkey" FOREIGN KEY ("id_artesania") REFERENCES "artesania"("id_artesania") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignacion" ADD CONSTRAINT "consignacion_id_galeria_fkey" FOREIGN KEY ("id_galeria") REFERENCES "galeria"("id_galeria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_id_artesania_fkey" FOREIGN KEY ("id_artesania") REFERENCES "artesania"("id_artesania") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_id_consignacion_fkey" FOREIGN KEY ("id_consignacion") REFERENCES "consignacion"("id_consignacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- restricciones check
ALTER TABLE "consignacion"
  ADD CONSTRAINT "chk_consignacion_retorno"  CHECK ("fecha_retorno" IS NULL OR "fecha_retorno" >= "fecha_salida"),
  ADD CONSTRAINT "chk_consignacion_comision" CHECK ("porcentaje_comision" IS NULL OR ("porcentaje_comision" >= 0 AND "porcentaje_comision" <= 100));

ALTER TABLE "venta"
  ADD CONSTRAINT "chk_venta_monto" CHECK ("monto_cobrado" > 0);
