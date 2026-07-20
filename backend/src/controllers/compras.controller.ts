import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { decimalPositivoDe, paramDe, textoDe, uuidDe } from "../lib/validate.js";
import { ApiError } from "../middlewares/error.js";

const includeCompra = {
  proveedor: true,
  detalles: { include: { materiaPrima: { include: { tipoMaterial: true } } } },
} as const;

function parseDetalles(body: Record<string, unknown>) {
  const detalles = body.detalles;
  if (!Array.isArray(detalles) || detalles.length === 0) {
    throw new ApiError(400, "La compra debe incluir al menos un detalle de materia prima");
  }
  return detalles.map((detalle: Record<string, unknown>) => ({
    idMateria: uuidDe(detalle, "idMateria"),
    cantidad: decimalPositivoDe(detalle, "cantidad"),
    costoUnitario: decimalPositivoDe(detalle, "costoUnitario"),
  }));
}

export async function listar(_req: Request, res: Response, next: NextFunction) {
  try {
    const compras = await prisma.compra.findMany({
      orderBy: { fecha: "desc" },
      include: includeCompra,
    });
    res.json(compras);
  } catch (err) {
    next(err);
  }
}

export async function obtener(req: Request, res: Response, next: NextFunction) {
  try {
    const compra = await prisma.compra.findUnique({
      where: { idCompra: paramDe(req.params, "id") },
      include: includeCompra,
    });
    if (!compra) {
      throw new ApiError(404, "La compra no existe");
    }
    res.json(compra);
  } catch (err) {
    next(err);
  }
}

export async function crear(req: Request, res: Response, next: NextFunction) {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const compra = await prisma.compra.create({
      data: {
        idProveedor: uuidDe(body, "idProveedor"),
        idArtesano: req.artesano!.sub,
        folioNota: textoDe(body, "folioNota", { max: 50 }),
        ...(typeof body.fecha === "string" && body.fecha
          ? { fecha: new Date(body.fecha) }
          : {}),
        detalles: { create: parseDetalles(body) },
      },
      include: includeCompra,
    });
    res.status(201).json(compra);
  } catch (err) {
    next(err);
  }
}

export async function eliminar(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.compra.delete({ where: { idCompra: paramDe(req.params, "id") } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
