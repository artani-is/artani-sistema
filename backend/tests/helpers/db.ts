import { prisma } from "../../src/lib/prisma.js";

/** Tablas en orden inverso de dependencia para el TRUNCATE ... CASCADE. */
const TABLAS = [
  "verificacion_certificado",
  "certificado_qr",
  "venta",
  "consignacion",
  "reporte_ventas",
  "insumo_artesania",
  "foto_artesania",
  "artesania",
  "detalle_compra",
  "compra",
  "materia_prima",
  "proveedor",
  "galeria",
  "categoria_pieza",
  "tecnica_artesanal",
  "intento_acceso",
  "artesano",
];

export async function limpiarBaseDatos(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLAS.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`,
  );
}
