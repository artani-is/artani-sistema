-- Extensiones requeridas por el modelo v3 (UUID y correo case-insensitive)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateEnum
CREATE TYPE "estado_artesania" AS ENUM ('DISPONIBLE', 'EN_CONSIGNACION', 'VENDIDA');

-- CreateEnum
CREATE TYPE "unidad_medida_tipo" AS ENUM ('KG', 'GRAMO', 'METRO', 'CENTIMETRO', 'LITRO', 'MILILITRO', 'PIEZA');

-- CreateTable
CREATE TABLE "artesano" (
    "id_artesano" UUID NOT NULL DEFAULT gen_random_uuid(),
    "curp" VARCHAR(18) NOT NULL,
    "nombres" VARCHAR(100) NOT NULL,
    "apellido_paterno" VARCHAR(60) NOT NULL,
    "apellido_materno" VARCHAR(60),
    "correo" CITEXT NOT NULL,
    "contrasena_hash" VARCHAR(255) NOT NULL,
    "telefono" VARCHAR(20),
    "nombre_taller" VARCHAR(150),

    CONSTRAINT "artesano_pkey" PRIMARY KEY ("id_artesano")
);

-- CreateTable
CREATE TABLE "intento_acceso" (
    "id_intento" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fecha_hora" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitoso" BOOLEAN NOT NULL,
    "id_artesano" UUID NOT NULL,

    CONSTRAINT "intento_acceso_pkey" PRIMARY KEY ("id_intento")
);

-- CreateTable
CREATE TABLE "tipo_material" (
    "id_tipo_material" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "tipo_material_pkey" PRIMARY KEY ("id_tipo_material")
);

-- CreateTable
CREATE TABLE "tecnica_artesanal" (
    "id_tecnica" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "tecnica_artesanal_pkey" PRIMARY KEY ("id_tecnica")
);

-- CreateTable
CREATE TABLE "categoria_pieza" (
    "id_categoria" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "categoria_pieza_pkey" PRIMARY KEY ("id_categoria")
);

-- CreateTable
CREATE TABLE "galeria" (
    "id_galeria" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(150) NOT NULL,
    "nombre_contacto" VARCHAR(100),
    "telefono" VARCHAR(20),
    "correo" CITEXT,
    "calle" VARCHAR(100),
    "numero" VARCHAR(10),
    "colonia" VARCHAR(100),
    "codigo_postal" VARCHAR(10),
    "ciudad" VARCHAR(100),
    "estado" VARCHAR(100),
    "pais" VARCHAR(60) NOT NULL DEFAULT 'Mexico',

    CONSTRAINT "galeria_pkey" PRIMARY KEY ("id_galeria")
);

-- CreateTable
CREATE TABLE "proveedor" (
    "id_proveedor" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(150) NOT NULL,
    "telefono" VARCHAR(20),
    "correo" CITEXT,
    "ciudad" VARCHAR(100),
    "estado" VARCHAR(100),

    CONSTRAINT "proveedor_pkey" PRIMARY KEY ("id_proveedor")
);

-- CreateTable
CREATE TABLE "materia_prima" (
    "id_materia" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(150) NOT NULL,
    "unidad_medida" "unidad_medida_tipo" NOT NULL,
    "id_tipo_material" UUID NOT NULL,

    CONSTRAINT "materia_prima_pkey" PRIMARY KEY ("id_materia")
);

-- CreateTable
CREATE TABLE "compra" (
    "id_compra" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fecha" DATE NOT NULL DEFAULT CURRENT_DATE,
    "folio_nota" VARCHAR(50),
    "id_proveedor" UUID NOT NULL,
    "id_artesano" UUID NOT NULL,

    CONSTRAINT "compra_pkey" PRIMARY KEY ("id_compra")
);

-- CreateTable
CREATE TABLE "detalle_compra" (
    "id_detalle" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cantidad" DECIMAL(12,3) NOT NULL,
    "costo_unitario" DECIMAL(10,2) NOT NULL,
    "id_compra" UUID NOT NULL,
    "id_materia" UUID NOT NULL,

    CONSTRAINT "detalle_compra_pkey" PRIMARY KEY ("id_detalle")
);

-- CreateTable
CREATE TABLE "artesania" (
    "id_artesania" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "estado" "estado_artesania" NOT NULL DEFAULT 'DISPONIBLE',
    "fecha_registro" DATE NOT NULL DEFAULT CURRENT_DATE,
    "horas_trabajadas" DECIMAL(6,2),
    "tarifa_hora" DECIMAL(10,2),
    "precio_venta" DECIMAL(10,2),
    "id_artesano" UUID NOT NULL,
    "id_tecnica" UUID NOT NULL,
    "id_categoria" UUID NOT NULL,

    CONSTRAINT "artesania_pkey" PRIMARY KEY ("id_artesania")
);

-- CreateTable
CREATE TABLE "foto_artesania" (
    "id_foto" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ruta_archivo" VARCHAR(300) NOT NULL,
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "fecha_carga" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_artesania" UUID NOT NULL,

    CONSTRAINT "foto_artesania_pkey" PRIMARY KEY ("id_foto")
);

-- CreateTable
CREATE TABLE "insumo_artesania" (
    "id_insumo_art" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cantidad_usada" DECIMAL(12,3) NOT NULL,
    "costo_unitario_uso" DECIMAL(10,2) NOT NULL,
    "id_artesania" UUID NOT NULL,
    "id_materia" UUID NOT NULL,

    CONSTRAINT "insumo_artesania_pkey" PRIMARY KEY ("id_insumo_art")
);

-- CreateTable
CREATE TABLE "certificado_qr" (
    "id_certificado" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fecha_emision" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ruta_pdf" VARCHAR(300) NOT NULL,
    "id_artesania" UUID NOT NULL,

    CONSTRAINT "certificado_qr_pkey" PRIMARY KEY ("id_certificado")
);

-- CreateTable
CREATE TABLE "verificacion_certificado" (
    "id_verificacion" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fecha_hora" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_certificado" UUID NOT NULL,

    CONSTRAINT "verificacion_certificado_pkey" PRIMARY KEY ("id_verificacion")
);

-- CreateIndex
CREATE UNIQUE INDEX "artesano_curp_key" ON "artesano"("curp");

-- CreateIndex
CREATE UNIQUE INDEX "artesano_correo_key" ON "artesano"("correo");

-- CreateIndex
CREATE INDEX "intento_acceso_id_artesano_fecha_hora_idx" ON "intento_acceso"("id_artesano", "fecha_hora");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_material_nombre_key" ON "tipo_material"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tecnica_artesanal_nombre_key" ON "tecnica_artesanal"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_pieza_nombre_key" ON "categoria_pieza"("nombre");

-- CreateIndex
CREATE INDEX "materia_prima_id_tipo_material_idx" ON "materia_prima"("id_tipo_material");

-- CreateIndex
CREATE INDEX "compra_id_proveedor_idx" ON "compra"("id_proveedor");

-- CreateIndex
CREATE INDEX "compra_id_artesano_idx" ON "compra"("id_artesano");

-- CreateIndex
CREATE INDEX "detalle_compra_id_compra_idx" ON "detalle_compra"("id_compra");

-- CreateIndex
CREATE INDEX "detalle_compra_id_materia_id_compra_idx" ON "detalle_compra"("id_materia", "id_compra");

-- CreateIndex
CREATE INDEX "artesania_id_artesano_idx" ON "artesania"("id_artesano");

-- CreateIndex
CREATE INDEX "artesania_id_tecnica_idx" ON "artesania"("id_tecnica");

-- CreateIndex
CREATE INDEX "artesania_id_categoria_idx" ON "artesania"("id_categoria");

-- CreateIndex
CREATE INDEX "artesania_estado_idx" ON "artesania"("estado");

-- CreateIndex
CREATE INDEX "foto_artesania_id_artesania_idx" ON "foto_artesania"("id_artesania");

-- CreateIndex
CREATE INDEX "insumo_artesania_id_artesania_idx" ON "insumo_artesania"("id_artesania");

-- CreateIndex
CREATE INDEX "insumo_artesania_id_materia_idx" ON "insumo_artesania"("id_materia");

-- CreateIndex
CREATE UNIQUE INDEX "certificado_qr_id_artesania_key" ON "certificado_qr"("id_artesania");

-- CreateIndex
CREATE INDEX "verificacion_certificado_id_certificado_fecha_hora_idx" ON "verificacion_certificado"("id_certificado", "fecha_hora");

-- AddForeignKey
ALTER TABLE "intento_acceso" ADD CONSTRAINT "intento_acceso_id_artesano_fkey" FOREIGN KEY ("id_artesano") REFERENCES "artesano"("id_artesano") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materia_prima" ADD CONSTRAINT "materia_prima_id_tipo_material_fkey" FOREIGN KEY ("id_tipo_material") REFERENCES "tipo_material"("id_tipo_material") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "proveedor"("id_proveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_id_artesano_fkey" FOREIGN KEY ("id_artesano") REFERENCES "artesano"("id_artesano") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_compra" ADD CONSTRAINT "detalle_compra_id_compra_fkey" FOREIGN KEY ("id_compra") REFERENCES "compra"("id_compra") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_compra" ADD CONSTRAINT "detalle_compra_id_materia_fkey" FOREIGN KEY ("id_materia") REFERENCES "materia_prima"("id_materia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artesania" ADD CONSTRAINT "artesania_id_artesano_fkey" FOREIGN KEY ("id_artesano") REFERENCES "artesano"("id_artesano") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artesania" ADD CONSTRAINT "artesania_id_tecnica_fkey" FOREIGN KEY ("id_tecnica") REFERENCES "tecnica_artesanal"("id_tecnica") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artesania" ADD CONSTRAINT "artesania_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categoria_pieza"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foto_artesania" ADD CONSTRAINT "foto_artesania_id_artesania_fkey" FOREIGN KEY ("id_artesania") REFERENCES "artesania"("id_artesania") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumo_artesania" ADD CONSTRAINT "insumo_artesania_id_artesania_fkey" FOREIGN KEY ("id_artesania") REFERENCES "artesania"("id_artesania") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumo_artesania" ADD CONSTRAINT "insumo_artesania_id_materia_fkey" FOREIGN KEY ("id_materia") REFERENCES "materia_prima"("id_materia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificado_qr" ADD CONSTRAINT "certificado_qr_id_artesania_fkey" FOREIGN KEY ("id_artesania") REFERENCES "artesania"("id_artesania") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificacion_certificado" ADD CONSTRAINT "verificacion_certificado_id_certificado_fkey" FOREIGN KEY ("id_certificado") REFERENCES "certificado_qr"("id_certificado") ON DELETE CASCADE ON UPDATE CASCADE;

-- restricciones check
ALTER TABLE "detalle_compra"
  ADD CONSTRAINT "chk_detalle_cantidad" CHECK ("cantidad" > 0),
  ADD CONSTRAINT "chk_detalle_costo"    CHECK ("costo_unitario" > 0);

ALTER TABLE "artesania"
  ADD CONSTRAINT "chk_artesania_horas"  CHECK ("horas_trabajadas" >= 0),
  ADD CONSTRAINT "chk_artesania_tarifa" CHECK ("tarifa_hora" >= 0),
  ADD CONSTRAINT "chk_artesania_precio" CHECK ("precio_venta" > 0);

ALTER TABLE "insumo_artesania"
  ADD CONSTRAINT "chk_insumo_cantidad" CHECK ("cantidad_usada" > 0),
  ADD CONSTRAINT "chk_insumo_costo"    CHECK ("costo_unitario_uso" > 0);

-- indice unico parcial
CREATE UNIQUE INDEX "uq_foto_principal"
  ON "foto_artesania" ("id_artesania") WHERE "es_principal";
