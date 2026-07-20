import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../middlewares/error.js";
import * as authService from "../services/auth.service.js";

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { correo, contrasena } = req.body as { correo?: unknown; contrasena?: unknown };
    if (typeof correo !== "string" || !correo.trim()) {
      throw new ApiError(400, "El correo es obligatorio");
    }
    if (typeof contrasena !== "string" || !contrasena) {
      throw new ApiError(400, "La contraseña es obligatoria");
    }
    const sesion = await authService.login(correo.trim(), contrasena);
    res.json(sesion);
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const artesano = await authService.perfil(req.artesano!.sub);
    res.json(artesano);
  } catch (err) {
    next(err);
  }
}
