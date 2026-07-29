import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.js";

export const authRouter = Router();

authRouter.post("/login", authController.login);
authRouter.get("/me", requireAuth, authController.me);
authRouter.put("/perfil", requireAuth, authController.actualizarPerfil);

// Recuperación de contraseña (HU-1): ambas rutas son públicas, por definición
authRouter.post("/recuperacion", authController.solicitarRecuperacion);
authRouter.post("/recuperacion/confirmar", authController.confirmarRecuperacion);
