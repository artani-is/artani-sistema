import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { UPLOADS_DIR } from "./uploads.js";
import { ApiError } from "../middlewares/error.js";

/** Lado mayor al que se reduce toda fotografía antes de comprimirla. */
export const LADO_MAXIMO_PX = 1600;

/** Calidad de compresión de ambos derivados. */
export const CALIDAD = 80;

export interface DerivadosFoto {
  /** WebP: el que se sirve en galería, inventario y ficha pública. */
  rutaWebp: string;
  /** JPEG: existe solo para incrustarse en el certificado PDF (PDFKit no lee WebP). */
  rutaJpeg: string;
}

/**
 * Redimensiona la fotografía recibida y genera sus dos derivados (RNF_012).
 *
 * El artesano puede subir la imagen tal como sale de su teléfono; aquí se
 * reduce a {@link LADO_MAXIMO_PX} por el lado mayor —conservando la proporción
 * y sin ampliar las imágenes que ya sean menores— y se escriben las dos
 * versiones que el sistema necesita.
 */
export async function procesarFotografia(archivo: Buffer): Promise<DerivadosFoto> {
  const base = randomUUID();
  const archivoWebp = path.join(UPLOADS_DIR, `${base}.webp`);
  const archivoJpeg = path.join(UPLOADS_DIR, `${base}.jpg`);

  try {
    const redimensionada = sharp(archivo)
      // Las cámaras de teléfono guardan la orientación en EXIF en lugar de rotar
      // los píxeles; sin esto, la foto se vería acostada.
      .rotate()
      .resize({
        width: LADO_MAXIMO_PX,
        height: LADO_MAXIMO_PX,
        fit: "inside",
        withoutEnlargement: true,
      });

    await redimensionada.clone().webp({ quality: CALIDAD }).toFile(archivoWebp);
    // mozjpeg comprime mejor a igual calidad percibida; el resultado es un JPEG
    // de línea base que PDFKit incrusta sin conversión adicional.
    await redimensionada
      .clone()
      .jpeg({ quality: CALIDAD, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toFile(archivoJpeg);
  } catch (err) {
    // Un archivo con extensión válida pero contenido corrupto llega hasta aquí:
    // se limpia lo que haya alcanzado a escribirse y se informa al usuario.
    await Promise.all([
      unlink(archivoWebp).catch(() => {}),
      unlink(archivoJpeg).catch(() => {}),
    ]);
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, "La imagen está dañada o no es un archivo PNG o JPG válido");
  }

  return { rutaWebp: `/uploads/${base}.webp`, rutaJpeg: `/uploads/${base}.jpg` };
}
