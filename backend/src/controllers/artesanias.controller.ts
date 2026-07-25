import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { paramDe, textoDe, uuidDe } from "../lib/validate.js";
import { ApiError } from "../middlewares/error.js";
import { EstadoArtesania, EstadoConsignacion } from "../generated/prisma/enums.js";
import type { Prisma } from "../generated/prisma/client.js";

const includeArtesania = {
  tecnica: true,
  categoria: true,
  fotos: { orderBy: { fechaCarga: "asc" } },
  insumos: { include: { materiaPrima: true } },
  certificado: { include: { _count: { select: { verificaciones: true } } } },
  venta: true,
  consignaciones: {
    where: { estado: EstadoConsignacion.ACTIVA },
    include: { galeria: { select: { idGaleria: true, nombre: true } } },
  },
} satisfies Prisma.ArtesaniaInclude;

function parseArtesania(body: Record<string, unknown>) {
  return {
    nombre: textoDe(body, "nombre", { obligatorio: true, max: 200 }) as string,
    descripcion: textoDe(body, "descripcion", { max: 5000 }),
    idTecnica: uuidDe(body, "idTecnica"),
    idCategoria: uuidDe(body, "idCategoria"),
  };
}

async function artesaniaOr404(id: string) {
  const artesania = await prisma.artesania.findUnique({
    where: { idArtesania: id },
    include: includeArtesania,
  });
  // CAM-013: las piezas dadas de baja no son visibles en el panel administrativo
  if (!artesania || artesania.eliminado) {
    throw new ApiError(404, "La artesanía no existe");
  }
  return artesania;
}

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const { busqueda, estado, idTecnica, idCategoria } = req.query;
    // CAM-013: listados, contadores y reportes excluyen las piezas dadas de baja
    const where: Prisma.ArtesaniaWhereInput = { eliminado: false };

    if (typeof busqueda === "string" && busqueda.trim()) {
      where.nombre = { contains: busqueda.trim(), mode: "insensitive" };
    }
    if (typeof estado === "string" && estado in EstadoArtesania) {
      where.estado = estado as EstadoArtesania;
    }
    if (typeof idTecnica === "string" && idTecnica) {
      where.idTecnica = idTecnica;
    }
    if (typeof idCategoria === "string" && idCategoria) {
      where.idCategoria = idCategoria;
    }

    const artesanias = await prisma.artesania.findMany({
      where,
      orderBy: { fechaRegistro: "desc" },
      include: includeArtesania,
    });
    res.json(artesanias);
  } catch (err) {
    next(err);
  }
}

export async function obtener(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await artesaniaOr404(paramDe(req.params, "id")));
  } catch (err) {
    next(err);
  }
}

export async function crear(req: Request, res: Response, next: NextFunction) {
  try {
    // El estado inicial siempre es DISPONIBLE (HU-06); el valor lo asigna el default de la BD
    const artesania = await prisma.artesania.create({
      data: { ...parseArtesania(req.body ?? {}), idArtesano: req.artesano!.sub },
      include: includeArtesania,
    });
    res.status(201).json(artesania);
  } catch (err) {
    next(err);
  }
}

export async function actualizar(req: Request, res: Response, next: NextFunction) {
  try {
    const actual = await artesaniaOr404(paramDe(req.params, "id"));
    if (actual.estado === EstadoArtesania.VENDIDA) {
      throw new ApiError(
        409,
        "No se puede modificar una pieza vendida: sus datos respaldan el certificado emitido",
      );
    }
    const artesania = await prisma.artesania.update({
      where: { idArtesania: paramDe(req.params, "id") },
      data: parseArtesania(req.body ?? {}),
      include: includeArtesania,
    });
    res.json(artesania);
  } catch (err) {
    next(err);
  }
}

/**
 * CAM-013: baja lógica con justificación obligatoria. La pieza conserva sus
 * fotografías, costeo y certificado; si tiene certificado emitido, el código QR
 * sigue resolviendo y la vista pública muestra la leyenda de pieza dada de baja.
 */
export async function eliminar(req: Request, res: Response, next: NextFunction) {
  try {
    const actual = await artesaniaOr404(paramDe(req.params, "id"));
    if (actual.estado !== EstadoArtesania.DISPONIBLE) {
      throw new ApiError(
        409,
        "Solo se pueden eliminar piezas con estado Disponible; una pieza vendida o en consignación debe resolverse primero",
      );
    }
    const motivo = textoDe((req.body ?? {}) as Record<string, unknown>, "motivo", {
      obligatorio: true,
      max: 500,
    }) as string;
    await prisma.artesania.update({
      where: { idArtesania: actual.idArtesania },
      data: { eliminado: true, motivoEliminacion: motivo, fechaEliminacion: new Date() },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
