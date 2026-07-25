import { Router } from "express";
import * as proveedoresController from "../controllers/proveedores.controller.js";

export const proveedoresRouter = Router();

proveedoresRouter.get("/", proveedoresController.listar);
proveedoresRouter.post("/", proveedoresController.crear);
proveedoresRouter.put("/:id", proveedoresController.actualizar);
proveedoresRouter.delete("/:id", proveedoresController.eliminar);
