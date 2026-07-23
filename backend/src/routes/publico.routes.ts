import { Router } from "express";
import * as certificadosController from "../controllers/certificados.controller.js";

/** Rutas sin autenticación: verificación de certificados por QR (HU-12). */
export const publicoRouter = Router();

publicoRouter.get("/certificados/:idCertificado", certificadosController.verificarPublico);
