import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { decimalPositivoDe, paramDe, textoDe, uuidDe } from "../lib/validate.js";
import { ApiError } from "../middlewares/error.js";

const includeCompra = {
  proveedor: true,
  detalles: { where: { eliminado: false }, include: { materiaPrima: true } },
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

async function compraActivaOr404(id: string) {
  const compra = await prisma.compra.findUnique({
    where: { idCompra: id },
    include: includeCompra,
  });
  if (!compra || compra.eliminado) {
    throw new ApiError(404, "La compra no existe");
  }
  return compra;
}

export async function listar(_req: Request, res: Response, next: NextFunction) {
  try {
    const compras = await prisma.compra.findMany({
      where: { eliminado: false },
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
    res.json(await compraActivaOr404(paramDe(req.params, "id")));
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

/**
 * CAM-010: edición de una compra capturada con datos erróneos.
 * No modifica los costeos ya calculados: INSUMO_ARTESANIA conserva el
 * costo al momento del uso como valor histórico.
 */
export async function actualizar(req: Request, res: Response, next: NextFunction) {
  try {
    const idCompra = paramDe(req.params, "id");
    await compraActivaOr404(idCompra);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const detalles = parseDetalles(body);

    const compra = await prisma.$transaction(async (tx) => {
      // Los detalles se sustituyen por completo (el formulario captura una compra por renglón)
      await tx.detalleCompra.deleteMany({ where: { idCompra } });
      return tx.compra.update({
        where: { idCompra },
        data: {
          idProveedor: uuidDe(body, "idProveedor"),
          folioNota: textoDe(body, "folioNota", { max: 50 }),
          ...(typeof body.fecha === "string" && body.fecha
            ? { fecha: new Date(body.fecha) }
            : {}),
          detalles: { create: detalles },
        },
        include: includeCompra,
      });
    });
    res.json(compra);
  } catch (err) {
    next(err);
  }
}

/**
 * CAM-012: borrado lógico con motivo obligatorio. El registro y el motivo
 * se conservan en la base de datos; los listados y totales lo excluyen.
 */
export async function eliminar(req: Request, res: Response, next: NextFunction) {
  try {
    const idCompra = paramDe(req.params, "id");
    await compraActivaOr404(idCompra);
    const motivo = textoDe((req.body ?? {}) as Record<string, unknown>, "motivo", {
      obligatorio: true,
      max: 500,
    }) as string;

    const fechaEliminacion = new Date();
    await prisma.$transaction([
      prisma.compra.update({
        where: { idCompra },
        data: { eliminado: true, motivoEliminacion: motivo, fechaEliminacion },
      }),
      prisma.detalleCompra.updateMany({
        where: { idCompra },
        data: { eliminado: true, motivoEliminacion: motivo, fechaEliminacion },
      }),
    ]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
