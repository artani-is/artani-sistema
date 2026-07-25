import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { textoDe } from "../lib/validate.js";
import { ApiError } from "../middlewares/error.js";
import { generarPdfReporte } from "../lib/reportes.js";

function periodoDe(body: Record<string, unknown>) {
  const inicio = textoDe(body, "fechaInicio", { obligatorio: true }) as string;
  const fin = textoDe(body, "fechaFin", { obligatorio: true }) as string;
  const fechaInicio = new Date(inicio);
  const fechaFin = new Date(fin);
  if (Number.isNaN(fechaInicio.getTime()) || Number.isNaN(fechaFin.getTime())) {
    throw new ApiError(400, "Las fechas del periodo no son válidas (usa formato AAAA-MM-DD)");
  }
  if (fechaFin < fechaInicio) {
    throw new ApiError(400, "La fecha final del periodo debe ser posterior o igual a la inicial");
  }
  return { fechaInicio, fechaFin };
}

function ventasDelPeriodo(fechaInicio: Date, fechaFin: Date) {
  return prisma.venta.findMany({
    where: { fechaVenta: { gte: fechaInicio, lte: fechaFin } },
    orderBy: { fechaVenta: "asc" },
    include: {
      artesania: { select: { nombre: true } },
      consignacion: { include: { galeria: { select: { nombre: true } } } },
    },
  });
}

/**
 * Genera y exporta el reporte de ventas del periodo (HU-16): calcula los
 * totales derivados, ensambla el PDF y registra la generación en la bitácora.
 */
export async function generar(req: Request, res: Response, next: NextFunction) {
  try {
    const { fechaInicio, fechaFin } = periodoDe((req.body ?? {}) as Record<string, unknown>);
    const ventas = await ventasDelPeriodo(fechaInicio, fechaFin);

    // HU-16: sin ventas no se genera un reporte vacío sin explicación
    if (ventas.length === 0) {
      throw new ApiError(409, "No hay ventas registradas en el periodo seleccionado");
    }

    const artesano = await prisma.artesano.findUnique({
      where: { idArtesano: req.artesano!.sub },
    });
    if (!artesano) {
      throw new ApiError(404, "El artesano no existe");
    }

    // UUID generado antes del INSERT para nombrar el PDF (modelo v3)
    const idReporte = randomUUID();
    const rutaExportacion = await generarPdfReporte({
      idReporte,
      artesano: {
        nombreCompleto: `${artesano.nombres} ${artesano.apellidoPaterno}`,
        nombreTaller: artesano.nombreTaller,
      },
      fechaInicio,
      fechaFin,
      ventas: ventas.map((v) => ({
        fechaVenta: v.fechaVenta,
        montoCobrado: v.montoCobrado.toString(),
        pieza: v.artesania.nombre,
        canal: v.idConsignacion ? "CONSIGNACION" : "DIRECTA",
        galeria: v.consignacion?.galeria.nombre ?? null,
      })),
    });

    const reporte = await prisma.reporteVentas.create({
      data: {
        idReporte,
        fechaInicio,
        fechaFin,
        rutaExportacion,
        idArtesano: req.artesano!.sub,
      },
    });

    const totalVentas = ventas.reduce((s, v) => s + Number(v.montoCobrado), 0);
    res.status(201).json({ ...reporte, totalVentas, totalPiezas: ventas.length });
  } catch (err) {
    next(err);
  }
}

/** Bitácora de reportes generados, con totales derivados por periodo. */
export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const reportes = await prisma.reporteVentas.findMany({
      where: { idArtesano: req.artesano!.sub },
      orderBy: { fechaGeneracion: "desc" },
    });
    const conTotales = await Promise.all(
      reportes.map(async (reporte) => {
        const agregado = await prisma.venta.aggregate({
          where: { fechaVenta: { gte: reporte.fechaInicio, lte: reporte.fechaFin } },
          _sum: { montoCobrado: true },
          _count: true,
        });
        return {
          ...reporte,
          totalVentas: Number(agregado._sum.montoCobrado ?? 0),
          totalPiezas: agregado._count,
        };
      }),
    );
    res.json(conTotales);
  } catch (err) {
    next(err);
  }
}
