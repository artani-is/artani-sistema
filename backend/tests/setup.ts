import { beforeAll, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { limpiarBaseDatos } from "./helpers/db.js";

/**
 * Cada archivo de pruebas parte de una base limpia: así el resultado de una
 * suite no depende del orden ni de los datos que dejó otra.
 */
beforeAll(async () => {
  await limpiarBaseDatos();
});

afterAll(async () => {
  await prisma.$disconnect();
});
