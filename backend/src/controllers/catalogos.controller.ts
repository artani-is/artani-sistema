import { Router, type NextFunction, type Request, type Response } from "express";
import { ApiError } from "../middlewares/error.js";
import { paramDe } from "../lib/validate.js";

export interface CatalogoConfig<T> {
  /** Nombre legible del catálogo, usado en mensajes de error. */
  etiqueta: string;
  listar(): Promise<T[]>;
  crear(data: Record<string, unknown>): Promise<T>;
  actualizar(id: string, data: Record<string, unknown>): Promise<T>;
  eliminar(id: string): Promise<void>;
  /** Devuelve true si el elemento está vinculado a registros activos. */
  enUso(id: string): Promise<boolean>;
  /** Valida el body y devuelve los datos listos para persistir. */
  parseBody(body: Record<string, unknown>): Record<string, unknown>;
}

export function crearCatalogoRouter<T>(config: CatalogoConfig<T>): Router {
  const router = Router();

  router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await config.listar());
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = config.parseBody(req.body ?? {});
      res.status(201).json(await config.crear(data));
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = config.parseBody(req.body ?? {});
      res.json(await config.actualizar(paramDe(req.params, "id"), data));
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (await config.enUso(paramDe(req.params, "id"))) {
        throw new ApiError(
          409,
          `No se puede eliminar: ${config.etiqueta} está vinculado a registros activos`,
        );
      }
      await config.eliminar(paramDe(req.params, "id"));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
