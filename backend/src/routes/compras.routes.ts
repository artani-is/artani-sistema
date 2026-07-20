import { Router } from "express";
import * as comprasController from "../controllers/compras.controller.js";

export const comprasRouter = Router();

comprasRouter.get("/", comprasController.listar);
comprasRouter.get("/:id", comprasController.obtener);
comprasRouter.post("/", comprasController.crear);
comprasRouter.delete("/:id", comprasController.eliminar);
