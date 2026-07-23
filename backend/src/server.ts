import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma.js";
import { UPLOADS_DIR } from "./lib/uploads.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.js";
import { requireAuth } from "./middlewares/auth.js";
import { authRouter } from "./routes/auth.routes.js";
import { catalogosRouter } from "./routes/catalogos.routes.js";
import { proveedoresRouter } from "./routes/proveedores.routes.js";
import { materiasPrimasRouter } from "./routes/materias-primas.routes.js";
import { comprasRouter } from "./routes/compras.routes.js";
import { artesaniasRouter } from "./routes/artesanias.routes.js";
import { consignacionesRouter, ventasRouter } from "./routes/ventas.routes.js";
import { reportesRouter } from "./routes/reportes.routes.js";
import { publicoRouter } from "./routes/publico.routes.js";

export function crearServidor() {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json());
  app.use("/uploads", express.static(UPLOADS_DIR));

  app.get("/api/health", async (_req, res, next) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", db: "ok" });
    } catch (err) {
      next(err);
    }
  });

  app.use("/api/auth", authRouter);
  app.use("/api/catalogos", requireAuth, catalogosRouter);
  app.use("/api/proveedores", requireAuth, proveedoresRouter);
  app.use("/api/materias-primas", requireAuth, materiasPrimasRouter);
  app.use("/api/compras", requireAuth, comprasRouter);
  app.use("/api/artesanias", requireAuth, artesaniasRouter);
  app.use("/api/ventas", requireAuth, ventasRouter);
  app.use("/api/consignaciones", requireAuth, consignacionesRouter);
  app.use("/api/reportes", requireAuth, reportesRouter);
  // Verificación pública de certificados: sin autenticación (HU-12)
  app.use("/api/publico", publicoRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
