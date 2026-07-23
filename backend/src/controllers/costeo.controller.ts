import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { decimalNoNegativoDe, decimalPositivoDe, paramDe, uuidDe } from "../lib/validate.js";
import { ApiError } from "../middlewares/error.js";
import { EstadoArtesania } from "../generated/prisma/enums.js";

const includeInsumo = {
  materiaPrima: { include: { tipoMaterial: true } },
} as const;

async function piezaEditableOr409(idArtesania: string) {
  const pieza = await prisma.artesania.findUnique({ where: { idArtesania } });
  if (!pieza) {
    throw new ApiError(404, "La artesanía no existe");
  }
  if (pieza.estado === EstadoArtesania.VENDIDA) {
    throw new ApiError(409, "La pieza ya fue vendida: su costeo no puede modificarse");
  }
  return pieza;
}

export async function listarInsumos(req: Request, res: Response, next: NextFunction) {
  try {
    const idArtesania = paramDe(req.params, "id");
    const pieza = await prisma.artesania.findUnique({ where: { idArtesania } });
    if (!pieza) {
      throw new ApiError(404, "La artesanía no existe");
    }
    const insumos = await prisma.insumoArtesania.findMany({
      where: { idArtesania },
      include: includeInsumo,
    });
    res.json(insumos);
  } catch (err) {
    next(err);
  }
}

/**
 * Reemplaza la lista completa de insumos de la pieza (HU-8).
 * Si un renglón no trae costo, se toma de la compra más reciente de esa materia.
 */
export async function guardarInsumos(req: Request, res: Response, next: NextFunction) {
  try {
    const idArtesania = paramDe(req.params, "id");
    await piezaEditableOr409(idArtesania);

    const body = (req.body ?? {}) as Record<string, unknown>;
    const filas = Array.isArray(body.insumos) ? (body.insumos as Record<string, unknown>[]) : [];

    const datos = await Promise.all(
      filas.map(async (fila) => {
        const idMateria = uuidDe(fila, "idMateria");
        let costo: string;
        if (fila.costoUnitarioUso !== undefined && fila.costoUnitarioUso !== null && fila.costoUnitarioUso !== "") {
          costo = decimalPositivoDe(fila, "costoUnitarioUso");
        } else {
          // HU-8: el costo se toma del historial de compras más reciente
          const ultimaCompra = await prisma.detalleCompra.findFirst({
            where: { idMateria },
            orderBy: { compra: { fecha: "desc" } },
          });
          if (!ultimaCompra) {
            throw new ApiError(
              400,
              "La materia prima no tiene compras registradas: captura el costo unitario manualmente",
            );
          }
          costo = ultimaCompra.costoUnitario.toString();
        }
        return {
          idArtesania,
          idMateria,
          cantidadUsada: decimalPositivoDe(fila, "cantidadUsada"),
          costoUnitarioUso: costo,
        };
      }),
    );

    await prisma.$transaction([
      prisma.insumoArtesania.deleteMany({ where: { idArtesania } }),
      prisma.insumoArtesania.createMany({ data: datos }),
    ]);

    const insumos = await prisma.insumoArtesania.findMany({
      where: { idArtesania },
      include: includeInsumo,
    });
    res.json(insumos);
  } catch (err) {
    next(err);
  }
}

/** Guarda horas trabajadas y tarifa por hora (HU-8; cero permitido con advertencia en la interfaz). */
export async function actualizarCosteo(req: Request, res: Response, next: NextFunction) {
  try {
    const idArtesania = paramDe(req.params, "id");
    await piezaEditableOr409(idArtesania);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const pieza = await prisma.artesania.update({
      where: { idArtesania },
      data: {
        horasTrabajadas: decimalNoNegativoDe(body, "horasTrabajadas"),
        tarifaHora: decimalNoNegativoDe(body, "tarifaHora"),
      },
    });
    res.json(pieza);
  } catch (err) {
    next(err);
  }
}

/** Asigna el precio de venta final (HU-9): número positivo definido por el artesano. */
export async function asignarPrecio(req: Request, res: Response, next: NextFunction) {
  try {
    const idArtesania = paramDe(req.params, "id");
    await piezaEditableOr409(idArtesania);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const pieza = await prisma.artesania.update({
      where: { idArtesania },
      data: { precioVenta: decimalPositivoDe(body, "precioVenta") },
    });
    res.json(pieza);
  } catch (err) {
    next(err);
  }
}
