import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { Prisma } from "../generated/prisma/client.js";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Recurso no encontrado" });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002":
        res.status(409).json({ error: "Ya existe un registro con ese valor único" });
        return;
      case "P2003":
        res.status(409).json({
          error: "No se puede completar la operación: el registro está vinculado a otros datos",
        });
        return;
      case "P2025":
        res.status(404).json({ error: "El registro solicitado no existe" });
        return;
    }
  }

  if (err instanceof multer.MulterError) {
    const mensaje =
      err.code === "LIMIT_FILE_SIZE"
        ? "Cada fotografía debe pesar máximo 5 MB"
        : "Error al procesar los archivos adjuntos";
    res.status(400).json({ error: mensaje });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ error: "Datos inválidos en la petición" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
}
