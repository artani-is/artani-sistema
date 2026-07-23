import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { decimalPositivoDe, paramDe, uuidDe } from "../lib/validate.js";
import { ApiError } from "../middlewares/error.js";
import { EstadoArtesania, EstadoConsignacion } from "../generated/prisma/enums.js";

/** El canal es derivado (modelo v3): con consignación => CONSIGNACION, sin ella => DIRECTA. */
function conCanal<T extends { idConsignacion: string | null }>(venta: T) {
  return { ...venta, canal: venta.idConsignacion ? "CONSIGNACION" : "DIRECTA" };
}

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    // Filtros del reporte (HU-16): periodo y canal (derivado de id_consignacion)
    const { inicio, fin, canal } = req.query;
    const fechaVenta: { gte?: Date; lte?: Date } = {};
    if (typeof inicio === "string" && inicio) fechaVenta.gte = new Date(inicio);
    if (typeof fin === "string" && fin) fechaVenta.lte = new Date(fin);

    const ventas = await prisma.venta.findMany({
      where: {
        ...(fechaVenta.gte || fechaVenta.lte ? { fechaVenta } : {}),
        ...(canal === "DIRECTA" ? { idConsignacion: null } : {}),
        ...(canal === "CONSIGNACION" ? { idConsignacion: { not: null } } : {}),
      },
      orderBy: { fechaVenta: "desc" },
      include: {
        artesania: { select: { idArtesania: true, nombre: true } },
        consignacion: { include: { galeria: { select: { idGaleria: true, nombre: true } } } },
      },
    });
    res.json(ventas.map(conCanal));
  } catch (err) {
    next(err);
  }
}

/**
 * Registra la venta final de una pieza (HU-14): desde Disponible (venta directa)
 * o desde En consignación (venta reportada por la galería). Una sola vez (RF_015).
 */
export async function registrar(req: Request, res: Response, next: NextFunction) {
  try {
    const idArtesania = paramDe(req.params, "id");
    const body = (req.body ?? {}) as Record<string, unknown>;
    const montoCobrado = decimalPositivoDe(body, "montoCobrado");

    const pieza = await prisma.artesania.findUnique({
      where: { idArtesania },
      include: { consignaciones: { where: { estado: EstadoConsignacion.ACTIVA } } },
    });
    if (!pieza) {
      throw new ApiError(404, "La artesanía no existe");
    }
    if (pieza.estado === EstadoArtesania.VENDIDA) {
      throw new ApiError(409, "La pieza ya fue vendida");
    }

    const consignacionActiva = pieza.consignaciones[0] ?? null;
    const venta = await prisma.$transaction(async (tx) => {
      if (consignacionActiva) {
        await tx.consignacion.update({
          where: { idConsignacion: consignacionActiva.idConsignacion },
          data: { estado: EstadoConsignacion.VENDIDA },
        });
      }
      await tx.artesania.update({
        where: { idArtesania },
        data: { estado: EstadoArtesania.VENDIDA },
      });
      return tx.venta.create({
        data: {
          idArtesania,
          montoCobrado,
          idConsignacion: consignacionActiva?.idConsignacion ?? null,
          ...(typeof body.fechaVenta === "string" && body.fechaVenta
            ? { fechaVenta: new Date(body.fechaVenta) }
            : {}),
        },
        include: {
          consignacion: { include: { galeria: { select: { idGaleria: true, nombre: true } } } },
        },
      });
    });
    res.status(201).json(conCanal(venta));
  } catch (err) {
    next(err);
  }
}

/**
 * Envía una pieza a consignación (HU-13): solo piezas Disponibles,
 * con galería obligatoria de los catálogos maestros.
 */
export async function enviarConsignacion(req: Request, res: Response, next: NextFunction) {
  try {
    const idArtesania = paramDe(req.params, "id");
    const body = (req.body ?? {}) as Record<string, unknown>;
    const idGaleria = uuidDe(body, "idGaleria");

    let porcentajeComision: string | null = null;
    if (body.porcentajeComision !== undefined && body.porcentajeComision !== null && body.porcentajeComision !== "") {
      const numero = Number(body.porcentajeComision);
      if (!Number.isFinite(numero) || numero < 0 || numero > 100) {
        throw new ApiError(400, 'El campo "porcentajeComision" debe estar entre 0 y 100');
      }
      porcentajeComision = String(numero);
    }

    const pieza = await prisma.artesania.findUnique({ where: { idArtesania } });
    if (!pieza) {
      throw new ApiError(404, "La artesanía no existe");
    }
    if (pieza.estado !== EstadoArtesania.DISPONIBLE) {
      throw new ApiError(409, "Solo las piezas disponibles pueden enviarse a consignación");
    }

    const [consignacion] = await prisma.$transaction([
      prisma.consignacion.create({
        data: { idArtesania, idGaleria, porcentajeComision },
        include: { galeria: true },
      }),
      prisma.artesania.update({
        where: { idArtesania },
        data: { estado: EstadoArtesania.EN_CONSIGNACION },
      }),
    ]);
    res.status(201).json(consignacion);
  } catch (err) {
    next(err);
  }
}

export async function listarConsignaciones(req: Request, res: Response, next: NextFunction) {
  try {
    const { estado } = req.query;
    const consignaciones = await prisma.consignacion.findMany({
      where:
        typeof estado === "string" && estado in EstadoConsignacion
          ? { estado: estado as EstadoConsignacion }
          : {},
      orderBy: { fechaSalida: "desc" },
      include: {
        artesania: { select: { idArtesania: true, nombre: true, estado: true } },
        galeria: { select: { idGaleria: true, nombre: true } },
      },
    });
    res.json(consignaciones);
  } catch (err) {
    next(err);
  }
}

/** Registra la devolución de una consignación activa: la pieza vuelve a estar Disponible. */
export async function registrarDevolucion(req: Request, res: Response, next: NextFunction) {
  try {
    const idConsignacion = paramDe(req.params, "id");
    const consignacion = await prisma.consignacion.findUnique({ where: { idConsignacion } });
    if (!consignacion) {
      throw new ApiError(404, "La consignación no existe");
    }
    if (consignacion.estado !== EstadoConsignacion.ACTIVA) {
      throw new ApiError(409, "Solo las consignaciones activas pueden registrarse como devueltas");
    }

    const [actualizada] = await prisma.$transaction([
      prisma.consignacion.update({
        where: { idConsignacion },
        data: { estado: EstadoConsignacion.DEVUELTA, fechaRetorno: new Date() },
        include: { galeria: true },
      }),
      prisma.artesania.update({
        where: { idArtesania: consignacion.idArtesania },
        data: { estado: EstadoArtesania.DISPONIBLE },
      }),
    ]);
    res.json(actualizada);
  } catch (err) {
    next(err);
  }
}
