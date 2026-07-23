import { Router } from "express";
import * as reportesController from "../controllers/reportes.controller.js";

export const reportesRouter = Router();

reportesRouter.get("/", reportesController.listar);
reportesRouter.post("/", reportesController.generar);
