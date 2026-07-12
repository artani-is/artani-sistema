import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  target: "node24",
  clean: true,
  sourcemap: true,
  external: ["@prisma/client", "@prisma/adapter-pg", "pg"],
});
