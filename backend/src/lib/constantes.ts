/**
 * Constantes compartidas que no dependen de ningún otro módulo.
 *
 * El límite de carga lo necesitan tanto el middleware que lo aplica
 * (`lib/uploads.ts`) como el que redacta el mensaje de error
 * (`middlewares/error.ts`); vive aquí para que ambos lean el mismo valor y no
 * puedan quedar desfasados.
 */

/**
 * Tamaño máximo de ENTRADA por fotografía (HU-07). Es holgado a propósito: el
 * artesano sube la imagen tal como sale de su teléfono y el servidor la
 * comprime (RNF_012), de modo que lo almacenado pesa una fracción de esto.
 */
export const MAX_TAMANO_BYTES = 8 * 1024 * 1024;

/** Representación legible del límite, para los mensajes al usuario. */
export const MAX_TAMANO_MB = MAX_TAMANO_BYTES / 1024 / 1024;
