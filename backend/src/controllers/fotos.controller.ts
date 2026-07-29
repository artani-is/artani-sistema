import { unlink } from "node:fs/promises";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { UPLOADS_DIR } from "../lib/uploads.js";
import { procesarFotografia } from "../lib/imagenes.js";
import { ApiError } from "../middlewares/error.js";
import { paramDe } from "../lib/validate.js";

async function borrarArchivo(rutaPublica: string) {
  const nombre = path.basename(rutaPublica);
  await unlink(path.join(UPLOADS_DIR, nombre)).catch(() => {
    // El registro en BD es la fuente de verdad; un archivo ya ausente no debe romper la operación
  });
}

/** Borra los dos derivados de una fotografía. */
async function borrarDerivados(foto: { rutaWebp: string; rutaJpeg: string }) {
  await Promise.all([borrarArchivo(foto.rutaWebp), borrarArchivo(foto.rutaJpeg)]);
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
      throw new ApiError(404, "La artesanía no existe");
    }

    // RNF_012: se redimensiona y comprime antes de tocar la base de datos; lo
    // que llegó en memoria no se conserva tal cual en ningún momento.
    const derivados = await Promise.all(
      archivos.map((archivo) => procesarFotografia(archivo.buffer)),
    );

    // Si la pieza no tiene fotos, la primera cargada se marca como principal (HU-07)
    const sinFotos = artesania._count.fotos === 0;
    try {
      const fotos = await prisma.$transaction(
        derivados.map((rutas, indice) =>
          prisma.fotoArtesania.create({
            data: {
              idArtesania,
              rutaWebp: rutas.rutaWebp,
              rutaJpeg: rutas.rutaJpeg,
              esPrincipal: sinFotos && indice === 0,
            },
          }),
        ),
      );
      res.status(201).json(fotos);
    } catch (err) {
      // Si el registro falla, los derivados ya escritos quedarían huérfanos
      await Promise.all(derivados.map(borrarDerivados));
      throw err;
    }
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
    // CAM-014: los archivos se conservan en disco para que «Deshacer» pueda restaurar la foto
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
    const rutaWebp = typeof body.rutaWebp === "string" ? body.rutaWebp : "";
    const rutaJpeg = typeof body.rutaJpeg === "string" ? body.rutaJpeg : "";
    if (!rutaWebp.startsWith("/uploads/") || !rutaJpeg.startsWith("/uploads/")) {
      throw new ApiError(400, "Las rutas de la fotografía a restaurar no son válidas");
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
        data: { idArtesania, rutaWebp, rutaJpeg, esPrincipal },
      });
    });
    res.status(201).json(foto);
  } catch (err) {
    next(err);
  }
}
