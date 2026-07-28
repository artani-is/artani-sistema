import { inflateSync } from "node:zlib";

/**
 * Extrae los flujos de contenido (no las imágenes) de un PDF.
 *
 * El recorrido se apoya en el `/Length` declarado en el diccionario de cada
 * objeto, en lugar de buscar la marca «endstream»: los datos binarios de las
 * imágenes contienen esa secuencia por azar y desalinearían el análisis.
 */
export function flujosDeContenido(pdf: Buffer): string {
  const texto = pdf.toString("latin1");
  const partes: string[] = [];

  for (const m of texto.matchAll(/<<([^]*?)>>\s*stream\r?\n/g)) {
    const dicc = m[1]!;
    if (/\/Subtype\s*\/Image/.test(dicc)) continue;
    if (!/\/Filter\s*\/FlateDecode/.test(dicc)) continue;

    const largo = /\/Length\s+(\d+)/.exec(dicc);
    if (!largo) continue;

    const inicio = m.index! + m[0].length;
    const datos = pdf.subarray(inicio, inicio + Number(largo[1]));
    try {
      partes.push(inflateSync(datos).toString("latin1"));
    } catch {
      // Un flujo que no descomprime no aporta operadores de dibujo
    }
  }
  return partes.join("\n");
}

/**
 * Texto legible del PDF. PDFKit codifica las cadenas como hexadecimales dentro
 * de los arreglos `TJ`; aquí se decodifican a caracteres (WinAnsi/latin1).
 */
export function textoDelPdf(pdf: Buffer): string {
  const contenido = flujosDeContenido(pdf);
  const trozos: string[] = [];
  for (const m of contenido.matchAll(/<([0-9A-Fa-f]+)>/g)) {
    trozos.push(Buffer.from(m[1]!, "hex").toString("latin1"));
  }
  return trozos.join("");
}

export interface ImagenColocada {
  ancho: number;
  alto: number;
  x: number;
  y: number;
}

/**
 * Imágenes dibujadas en el PDF, leídas de la matriz de transformación
 * `a 0 0 d e f cm` que precede a cada operador `Do`.
 *
 * PDFKit invierte el eje vertical (`d` es negativo) para trabajar con el origen
 * arriba a la izquierda: las dimensiones se devuelven en valor absoluto y `y`
 * corresponde al borde inferior de la imagen en coordenadas PDF.
 */
export function imagenesColocadas(pdf: Buffer): ImagenColocada[] {
  const contenido = flujosDeContenido(pdf);
  const patron = /([\d.-]+) 0 0 ([\d.-]+) ([\d.-]+) ([\d.-]+) cm\s*\/\w+ Do/g;
  const encontradas: ImagenColocada[] = [];
  for (const m of contenido.matchAll(patron)) {
    encontradas.push({
      ancho: Math.abs(Number(m[1])),
      alto: Math.abs(Number(m[2])),
      x: Number(m[3]),
      y: Number(m[4]),
    });
  }
  return encontradas;
}
