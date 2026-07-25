import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../middlewares/error.js";
import { textoDe } from "../lib/validate.js";
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

/** Actualiza el perfil del taller (HU-17); el correo no es editable. */
export async function actualizarPerfil(req: Request, res: Response, next: NextFunction) {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const artesano = await authService.actualizarPerfil(req.artesano!.sub, {
      nombres: textoDe(body, "nombres", { obligatorio: true, max: 100 }) as string,
      apellidoPaterno: textoDe(body, "apellidoPaterno", { obligatorio: true, max: 60 }) as string,
      apellidoMaterno: textoDe(body, "apellidoMaterno", { max: 60 }),
      telefono: textoDe(body, "telefono", { max: 20 }),
      nombreTaller: textoDe(body, "nombreTaller", { max: 150 }),
    });
    res.json(artesano);
  } catch (err) {
    next(err);
  }
}
