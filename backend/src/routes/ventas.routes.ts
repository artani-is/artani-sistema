import { Router } from "express";
import * as ventasController from "../controllers/ventas.controller.js";

export const ventasRouter = Router();

ventasRouter.get("/", ventasController.listar);

export const consignacionesRouter = Router();

consignacionesRouter.get("/", ventasController.listarConsignaciones);
consignacionesRouter.patch("/:id/devolucion", ventasController.registrarDevolucion);
