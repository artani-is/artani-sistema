import { execFileSync } from "node:child_process";

const URL_PRUEBAS =
  "postgresql://artani:artani_dev@localhost:5432/artani_test?schema=public";

/**
 * Aplica el esquema completo (todas las migraciones de Prisma) sobre la base de
 * datos de pruebas antes de ejecutar cualquier suite. Usa `migrate deploy` para
 * aplicar exactamente las migraciones versionadas del repositorio, de modo que
 * las restricciones CHECK y UNIQUE declaradas en SQL también queden verificadas.
 */
export default function setup() {
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: URL_PRUEBAS },
    stdio: "pipe",
  });
}
