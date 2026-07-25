import { Router } from "express";
import * as materiasController from "../controllers/materias-primas.controller.js";

export const materiasPrimasRouter = Router();

materiasPrimasRouter.get("/", materiasController.listar);
materiasPrimasRouter.post("/", materiasController.crear);
materiasPrimasRouter.put("/:id", materiasController.actualizar);
materiasPrimasRouter.delete("/:id", materiasController.eliminar);
materiasPrimasRouter.get("/:id/historial-precios", materiasController.historialPrecios);
