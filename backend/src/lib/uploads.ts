import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import multer from "multer";
import { ApiError } from "../middlewares/error.js";

export const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
mkdirSync(UPLOADS_DIR, { recursive: true });

const MAX_TAMANO_BYTES = 5 * 1024 * 1024; // 5 MB por archivo (HU-07)

const EXTENSIONES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
};

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    cb(null, `${randomUUID()}${EXTENSIONES[file.mimetype]}`);
  },
});

export const subirFotos = multer({
  storage,
  limits: { fileSize: MAX_TAMANO_BYTES, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (!(file.mimetype in EXTENSIONES)) {
      cb(new ApiError(400, "Solo se aceptan imágenes en formato PNG o JPG"));
      return;
    }
    cb(null, true);
  },
});
