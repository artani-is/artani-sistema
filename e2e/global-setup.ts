import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(RAIZ, "../backend");
const DB_E2E = "postgresql://artani:artani_dev@localhost:5432/artani_e2e?schema=public";

export const DIR_CAPTURAS = path.join(RAIZ, "capturas");

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

/**
 * Deja la base de datos de extremo a extremo en un estado conocido antes de la
 * corrida. Se usa `migrate deploy` (no destructivo) más un vaciado explícito de
 * las tablas: se evita `migrate reset`, que elimina la base de datos completa.
 */
export default async function globalSetup() {
  rmSync(DIR_CAPTURAS, { recursive: true, force: true });
  mkdirSync(DIR_CAPTURAS, { recursive: true });

  const env = { ...process.env, DATABASE_URL: DB_E2E };

  // 1. Esquema al día, sin destruir la base
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: BACKEND,
    env,
    stdio: "pipe",
  });

  // 2. Vaciado de datos de corridas anteriores (solo la base artani_e2e)
  const cliente = new Client({ connectionString: DB_E2E });
  await cliente.connect();
  try {
    await cliente.query(
      `TRUNCATE TABLE ${TABLAS.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`,
    );
  } finally {
    await cliente.end();
  }

  // 3. Artesano de demostración
  execFileSync("pnpm", ["seed"], { cwd: BACKEND, env, stdio: "pipe" });
}
