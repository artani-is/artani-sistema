import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "./error.js";

export interface TokenPayload {
  sub: string;
  correo: string;
}

declare global {
  namespace Express {
    interface Request {
      artesano?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new ApiError(401, "Se requiere autenticación"));
    return;
  }

  const token = header.slice("Bearer ".length);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as jwt.JwtPayload;
    req.artesano = { sub: decoded.sub as string, correo: decoded.correo as string };
    next();
  } catch {
    next(new ApiError(401, "Sesión inválida o expirada"));
  }
}
