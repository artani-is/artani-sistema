import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { paramDe, textoDe } from "../lib/validate.js";
import { ApiError } from "../middlewares/error.js";

// CAM-015: domicilio completo; solo el nombre es obligatorio y el número admite "S/N"
function parseProveedor(body: Record<string, unknown>) {
  return {
    nombre: textoDe(body, "nombre", { obligatorio: true, max: 150 }) as string,
    telefono: textoDe(body, "telefono", { max: 20 }),
    correo: textoDe(body, "correo", { max: 254 }),
    calle: textoDe(body, "calle", { max: 100 }),
    numero: textoDe(body, "numero", { max: 10 }),
    numeroInterior: textoDe(body, "numeroInterior", { max: 10 }),
    colonia: textoDe(body, "colonia", { max: 100 }),
    codigoPostal: textoDe(body, "codigoPostal", { max: 10 }),
    ciudad: textoDe(body, "ciudad", { max: 100 }),
    estado: textoDe(body, "estado", { max: 100 }),
  };
}

export async function listar(_req: Request, res: Response, next: NextFunction) {
  try {
    const proveedores = await prisma.proveedor.findMany({
      orderBy: { nombre: "asc" },
      include: { _count: { select: { compras: true } } },
    });
    res.json(proveedores);
  } catch (err) {
    next(err);
  }
}

export async function crear(req: Request, res: Response, next: NextFunction) {
  try {
    const proveedor = await prisma.proveedor.create({ data: parseProveedor(req.body ?? {}) });
    res.status(201).json(proveedor);
  } catch (err) {
    next(err);
  }
}

export async function actualizar(req: Request, res: Response, next: NextFunction) {
  try {
    const proveedor = await prisma.proveedor.update({
      where: { idProveedor: paramDe(req.params, "id") },
      data: parseProveedor(req.body ?? {}),
    });
    res.json(proveedor);
  } catch (err) {
    next(err);
  }
}

export async function eliminar(req: Request, res: Response, next: NextFunction) {
  try {
    const compras = await prisma.compra.count({ where: { idProveedor: paramDe(req.params, "id") } });
    if (compras > 0) {
      throw new ApiError(
        409,
        "No se puede eliminar el proveedor porque tiene compras registradas asociadas",
      );
    }
    await prisma.proveedor.delete({ where: { idProveedor: paramDe(req.params, "id") } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
