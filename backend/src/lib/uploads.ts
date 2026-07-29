import { mkdirSync } from "node:fs";
import path from "node:path";
import multer from "multer";
import { ApiError } from "../middlewares/error.js";
import { MAX_TAMANO_BYTES } from "./constantes.js";

export { MAX_TAMANO_BYTES };

export const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
mkdirSync(UPLOADS_DIR, { recursive: true });

const FORMATOS_ACEPTADOS = new Set(["image/png", "image/jpeg"]);

/**
 * Las fotografías se reciben en memoria porque no se conservan tal cual: sharp
 * las procesa y en disco solo se escriben los derivados (WebP y JPEG).
 */
export const subirFotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TAMANO_BYTES, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (!FORMATOS_ACEPTADOS.has(file.mimetype)) {
      cb(new ApiError(400, "Solo se aceptan imágenes en formato PNG o JPG"));
      return;
    }
    cb(null, true);
  },
});
