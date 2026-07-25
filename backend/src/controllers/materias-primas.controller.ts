import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { paramDe, textoDe } from "../lib/validate.js";
import { ApiError } from "../middlewares/error.js";
import { UnidadMedida } from "../generated/prisma/enums.js";

// CAM-009: el insumo se identifica solo por nombre y unidad de medida
function parseMateriaPrima(body: Record<string, unknown>) {
  const unidad = body.unidadMedida;
  if (typeof unidad !== "string" || !(unidad in UnidadMedida)) {
    throw new ApiError(
      400,
      `El campo "unidadMedida" debe ser uno de: ${Object.keys(UnidadMedida).join(", ")}`,
    );
  }
  return {
    nombre: textoDe(body, "nombre", { obligatorio: true, max: 150 }) as string,
    unidadMedida: unidad as UnidadMedida,
  };
}

export async function listar(_req: Request, res: Response, next: NextFunction) {
  try {
    const materias = await prisma.materiaPrima.findMany({
      orderBy: { nombre: "asc" },
      include: {
        _count: { select: { detallesCompra: { where: { eliminado: false } } } },
      },
    });
    res.json(materias);
  } catch (err) {
    next(err);
  }
}

export async function crear(req: Request, res: Response, next: NextFunction) {
  try {
    const materia = await prisma.materiaPrima.create({
      data: parseMateriaPrima(req.body ?? {}),
    });
    res.status(201).json(materia);
  } catch (err) {
    next(err);
  }
}

export async function actualizar(req: Request, res: Response, next: NextFunction) {
  try {
    const materia = await prisma.materiaPrima.update({
      where: { idMateria: paramDe(req.params, "id") },
      data: parseMateriaPrima(req.body ?? {}),
    });
    res.json(materia);
  } catch (err) {
    next(err);
  }
}

export async function eliminar(req: Request, res: Response, next: NextFunction) {
  try {
    const vinculos = await prisma.detalleCompra.count({ where: { idMateria: paramDe(req.params, "id") } });
    if (vinculos > 0) {
      throw new ApiError(
        409,
        "No se puede eliminar la materia prima porque tiene compras registradas asociadas",
      );
    }
    await prisma.materiaPrima.delete({ where: { idMateria: paramDe(req.params, "id") } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/** Historial de precios de compra de una materia prima (RF_008); excluye compras eliminadas. */
export async function historialPrecios(req: Request, res: Response, next: NextFunction) {
  try {
    const detalles = await prisma.detalleCompra.findMany({
      where: { idMateria: paramDe(req.params, "id"), eliminado: false },
      orderBy: { compra: { fecha: "desc" } },
      include: {
        compra: { include: { proveedor: { select: { idProveedor: true, nombre: true } } } },
      },
    });
    res.json(
      detalles.map((d) => ({
        idDetalle: d.idDetalle,
        fecha: d.compra.fecha,
        folioNota: d.compra.folioNota,
        proveedor: d.compra.proveedor,
        cantidad: d.cantidad,
        costoUnitario: d.costoUnitario,
      })),
    );
  } catch (err) {
    next(err);
  }
}
