import { Router } from "express";
import * as comprasController from "../controllers/compras.controller.js";

export const comprasRouter = Router();

comprasRouter.get("/", comprasController.listar);
comprasRouter.get("/:id", comprasController.obtener);
comprasRouter.post("/", comprasController.crear);
comprasRouter.put("/:id", comprasController.actualizar); // CAM-010
comprasRouter.delete("/:id", comprasController.eliminar); // CAM-012: motivo obligatorio en el body
