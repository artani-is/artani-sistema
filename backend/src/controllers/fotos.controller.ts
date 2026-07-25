import { unlink } from "node:fs/promises";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { UPLOADS_DIR } from "../lib/uploads.js";
import { ApiError } from "../middlewares/error.js";
import { paramDe } from "../lib/validate.js";

async function borrarArchivo(rutaArchivo: string) {
  const nombre = path.basename(rutaArchivo);
  await unlink(path.join(UPLOADS_DIR, nombre)).catch(() => {
    // El registro en BD es la fuente de verdad; un archivo ya ausente no debe romper la operación
  });
}

export async function subir(req: Request, res: Response, next: NextFunction) {
  try {
    const archivos = (req.files ?? []) as Express.Multer.File[];
    if (archivos.length === 0) {
      throw new ApiError(400, "Debes adjuntar al menos una fotografía (PNG o JPG)");
    }

    const idArtesania = paramDe(req.params, "id");
    const artesania = await prisma.artesania.findUnique({
      where: { idArtesania },
      include: { _count: { select: { fotos: true } } },
    });
    if (!artesania || artesania.eliminado) {
      await Promise.all(archivos.map((archivo) => borrarArchivo(archivo.filename)));
      throw new ApiError(404, "La artesanía no existe");
    }

    // Si la pieza no tiene fotos, la primera cargada se marca como principal (HU-07)
    const sinFotos = artesania._count.fotos === 0;
    const fotos = await prisma.$transaction(
      archivos.map((archivo, indice) =>
        prisma.fotoArtesania.create({
          data: {
            idArtesania,
            rutaArchivo: `/uploads/${archivo.filename}`,
            esPrincipal: sinFotos && indice === 0,
          },
        }),
      ),
    );
    res.status(201).json(fotos);
  } catch (err) {
    next(err);
  }
}

export async function marcarPrincipal(req: Request, res: Response, next: NextFunction) {
  try {
    const idArtesania = paramDe(req.params, "id");
    const idFoto = paramDe(req.params, "idFoto");
    const foto = await prisma.fotoArtesania.findFirst({
      where: { idFoto, idArtesania },
    });
    if (!foto) {
      throw new ApiError(404, "La fotografía no existe para esta artesanía");
    }
    await prisma.$transaction([
      prisma.fotoArtesania.updateMany({
        where: { idArtesania, esPrincipal: true },
        data: { esPrincipal: false },
      }),
      prisma.fotoArtesania.update({
        where: { idFoto },
        data: { esPrincipal: true },
      }),
    ]);
    res.json({ ...foto, esPrincipal: true });
  } catch (err) {
    next(err);
  }
}

export async function eliminar(req: Request, res: Response, next: NextFunction) {
  try {
    const idArtesania = paramDe(req.params, "id");
    const idFoto = paramDe(req.params, "idFoto");
    const foto = await prisma.fotoArtesania.findFirst({
      where: { idFoto, idArtesania },
    });
    if (!foto) {
      throw new ApiError(404, "La fotografía no existe para esta artesanía");
    }
    // CAM-014: el archivo se conserva en disco para que «Deshacer» pueda restaurar la foto
    await prisma.fotoArtesania.delete({ where: { idFoto } });

    // Mantener siempre una foto principal si quedan fotos (HU-07)
    if (foto.esPrincipal) {
      const primera = await prisma.fotoArtesania.findFirst({
        where: { idArtesania },
        orderBy: { fechaCarga: "asc" },
      });
      if (primera) {
        await prisma.fotoArtesania.update({
          where: { idFoto: primera.idFoto },
          data: { esPrincipal: true },
        });
      }
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/** CAM-014: revierte la eliminación de una fotografía (acción «Deshacer» del Snackbar). */
export async function restaurar(req: Request, res: Response, next: NextFunction) {
  try {
    const idArtesania = paramDe(req.params, "id");
    const body = (req.body ?? {}) as Record<string, unknown>;
    const rutaArchivo = typeof body.rutaArchivo === "string" ? body.rutaArchivo : "";
    if (!rutaArchivo.startsWith("/uploads/")) {
      throw new ApiError(400, "La ruta de la fotografía a restaurar no es válida");
    }
    const artesania = await prisma.artesania.findUnique({ where: { idArtesania } });
    if (!artesania || artesania.eliminado) {
      throw new ApiError(404, "La artesanía no existe");
    }

    const esPrincipal = body.esPrincipal === true;
    const foto = await prisma.$transaction(async (tx) => {
      if (esPrincipal) {
        await tx.fotoArtesania.updateMany({
          where: { idArtesania, esPrincipal: true },
          data: { esPrincipal: false },
        });
      }
      return tx.fotoArtesania.create({
        data: { idArtesania, rutaArchivo, esPrincipal },
      });
    });
    res.status(201).json(foto);
  } catch (err) {
    next(err);
  }
}
