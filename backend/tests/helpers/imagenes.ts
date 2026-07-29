/** PNG 1x1 válido (firma + IHDR + IDAT + IEND), suficiente para multer y pdfkit. */
export const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** JPEG 1x1 válido (baseline, gris). */
export const JPG_1X1 = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64",
);

/** Genera un buffer de tamaño arbitrario con cabecera PNG válida (para probar el límite de 5 MB). */
export function pngDeTamano(bytes: number): Buffer {
  const relleno = Buffer.alloc(Math.max(0, bytes - PNG_1X1.length), 0);
  return Buffer.concat([PNG_1X1, relleno]);
}

/**
 * Fotografía JPEG realista de las dimensiones indicadas: degradado con ruido,
 * que se comprime de forma parecida a una fotografía real (a diferencia de un
 * color plano, que comprimiría a unos pocos bytes y falsearía las mediciones).
 */
export async function fotoDePrueba(ancho: number, alto: number): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const pixeles = Buffer.alloc(ancho * alto * 3);
  for (let i = 0; i < pixeles.length; i += 3) {
    const p = i / 3;
    const x = p % ancho;
    const y = Math.floor(p / ancho);
    pixeles[i] = (120 + 80 * Math.sin(x / 50) + Math.random() * 60) & 255;
    pixeles[i + 1] = (90 + 70 * Math.cos(y / 40) + Math.random() * 60) & 255;
    pixeles[i + 2] = (70 + 60 * Math.sin((x + y) / 70) + Math.random() * 60) & 255;
  }
  return sharp(pixeles, { raw: { width: ancho, height: alto, channels: 3 } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

// --- Codificador PNG mínimo, para generar imágenes de dimensiones conocidas ---

const TABLA_CRC = (() => {
  const tabla = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c;
  }
  return tabla;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = TABLA_CRC[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

/**
 * PNG RGB opaco de `ancho`×`alto` píxeles. Permite verificar que el certificado
 * conserva la proporción original de la fotografía (HU-11).
 */
export function pngDeDimensiones(ancho: number, alto: number): Buffer {
  const { deflateSync } = require("node:zlib") as typeof import("node:zlib");

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // profundidad de bits
  ihdr[9] = 2; // color RGB
  ihdr[10] = 0; // compresión
  ihdr[11] = 0; // filtro
  ihdr[12] = 0; // sin entrelazado

  // Cada scanline lleva un byte de filtro (0 = None) seguido de ancho×3 bytes RGB
  const crudo = Buffer.alloc(alto * (1 + ancho * 3));
  for (let y = 0; y < alto; y++) {
    const inicio = y * (1 + ancho * 3);
    crudo[inicio] = 0;
    for (let x = 0; x < ancho; x++) {
      const p = inicio + 1 + x * 3;
      crudo[p] = 180;
      crudo[p + 1] = 120;
      crudo[p + 2] = 60;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(crudo)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
