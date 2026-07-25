import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { paramDe } from "../lib/validate.js";
import { ApiError } from "../middlewares/error.js";
import {
  generarArchivosCertificado,
  rutaQrPublica,
  urlVerificacion,
} from "../lib/certificados.js";

/** Campos derivados que acompañan al certificado en todas las respuestas. */
function conDerivados<T extends { idCertificado: string }>(certificado: T) {
  return {
    ...certificado,
    rutaQr: rutaQrPublica(certificado.idCertificado),
    urlVerificacion: urlVerificacion(certificado.idCertificado),
  };
}

/**
 * Emite el certificado de la pieza (HU-10, HU-11): genera el QR único,
 * ensambla el PDF y persiste el registro 1:1 con la artesanía.
 */
export async function emitir(req: Request, res: Response, next: NextFunction) {
  try {
    const idArtesania = paramDe(req.params, "id");
    const pieza = await prisma.artesania.findUnique({
      where: { idArtesania },
      include: {
        tecnica: true,
        categoria: true,
        artesano: true,
        fotos: { orderBy: { fechaCarga: "asc" } },
        certificado: true,
      },
    });
    if (!pieza || pieza.eliminado) {
      throw new ApiError(404, "La artesanía no existe");
    }
    if (pieza.certificado) {
      throw new ApiError(409, "La pieza ya cuenta con un certificado emitido");
    }
    // HU-11: requiere al menos una fotografía y un precio de venta final
    const fotoPrincipal = pieza.fotos.find((f) => f.esPrincipal) ?? pieza.fotos[0];
    if (!fotoPrincipal) {
      throw new ApiError(409, "La pieza necesita al menos una fotografía para emitir el certificado");
    }
    if (!pieza.precioVenta) {
      throw new ApiError(
        409,
        "La pieza necesita un precio de venta final (módulo de costeo) para emitir el certificado",
      );
    }

    // El UUID se genera antes del INSERT para nombrar el PDF y el QR (modelo v3)
    const idCertificado = randomUUID();
    const fechaEmision = new Date();
    const { rutaPdf } = await generarArchivosCertificado({
      idCertificado,
      pieza: {
        nombre: pieza.nombre,
        descripcion: pieza.descripcion,
        tecnica: pieza.tecnica.nombre,
        categoria: pieza.categoria.nombre,
        precioVenta: pieza.precioVenta.toString(),
      },
      artesano: {
        nombreCompleto: [
          pieza.artesano.nombres,
          pieza.artesano.apellidoPaterno,
          pieza.artesano.apellidoMaterno ?? "",
        ]
          .join(" ")
          .trim(),
        nombreTaller: pieza.artesano.nombreTaller,
      },
      rutaFotoPrincipal: fotoPrincipal.rutaArchivo,
      fechaEmision,
    });

    const certificado = await prisma.certificadoQr.create({
      data: { idCertificado, idArtesania, rutaPdf, fechaEmision },
    });
    res.status(201).json(conDerivados(certificado));
  } catch (err) {
    next(err);
  }
}

/** Certificado de una pieza con su bitácora de verificaciones (visible solo al artesano, HU-12). */
export async function obtener(req: Request, res: Response, next: NextFunction) {
  try {
    const certificado = await prisma.certificadoQr.findUnique({
      where: { idArtesania: paramDe(req.params, "id") },
      include: {
        verificaciones: { orderBy: { fechaHora: "desc" } },
        _count: { select: { verificaciones: true } },
      },
    });
    if (!certificado) {
      throw new ApiError(404, "La pieza no tiene certificado emitido");
    }
    res.json(conDerivados(certificado));
  } catch (err) {
    next(err);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verificación pública del certificado (HU-12): sin autenticación.
 * Registra el escaneo (solo fecha/hora, RNF_013) y devuelve la ficha pública.
 *
 * CAM-013: una pieza dada de baja NO se reporta como certificado inválido —
 * el certificado ya fue entregado físicamente al comprador y la pieza es
 * auténtica. Se devuelve estado "BAJA" para que la vista pública informe
 * el cambio de situación sin invalidar el origen de la obra.
 */
export async function verificarPublico(req: Request, res: Response, next: NextFunction) {
  try {
    const idCertificado = paramDe(req.params, "idCertificado");
    if (!UUID_RE.test(idCertificado)) {
      throw new ApiError(404, "El certificado no pudo verificarse: el código no es válido");
    }
    const certificado = await prisma.certificadoQr.findUnique({
      where: { idCertificado },
      include: {
        artesania: {
          include: {
            artesano: { select: { nombres: true, apellidoPaterno: true, apellidoMaterno: true, nombreTaller: true } },
            tecnica: true,
            categoria: true,
            fotos: { where: { esPrincipal: true }, take: 1 },
          },
        },
      },
    });
    if (!certificado) {
      throw new ApiError(
        404,
        "El certificado no pudo verificarse: no corresponde a ninguna pieza registrada",
      );
    }

    await prisma.verificacionCertificado.create({ data: { idCertificado } });

    const { artesania } = certificado;
    const artesano = artesania.artesano;
    res.json({
      idCertificado: certificado.idCertificado,
      fechaEmision: certificado.fechaEmision,
      estado: artesania.eliminado ? "BAJA" : "VALIDO",
      pieza: {
        nombre: artesania.nombre,
        descripcion: artesania.descripcion,
        tecnica: artesania.tecnica.nombre,
        categoria: artesania.categoria.nombre,
        foto: artesania.fotos[0]?.rutaArchivo ?? null,
      },
      artesano: {
        nombre: [artesano.nombres, artesano.apellidoPaterno, artesano.apellidoMaterno ?? ""]
          .join(" ")
          .trim(),
        taller: artesano.nombreTaller,
      },
    });
  } catch (err) {
    next(err);
  }
}
