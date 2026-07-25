import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { UPLOADS_DIR } from "./uploads.js";

export const CERTIFICADOS_DIR = path.join(UPLOADS_DIR, "certificados");
mkdirSync(CERTIFICADOS_DIR, { recursive: true });

/** Base pública del frontend; el QR apunta a la ficha de verificación (HU-10). */
function basePublica(): string {
  return (process.env.PUBLIC_BASE_URL ?? "http://localhost:5173").replace(/\/$/, "");
}

export function urlVerificacion(idCertificado: string): string {
  return `${basePublica()}/verificar/${idCertificado}`;
}

export function rutaQrPublica(idCertificado: string): string {
  return `/uploads/certificados/${idCertificado}-qr.png`;
}

export function rutaPdfPublica(idCertificado: string): string {
  return `/uploads/certificados/${idCertificado}.pdf`;
}

interface DatosCertificado {
  idCertificado: string;
  pieza: {
    nombre: string;
    descripcion: string | null;
    tecnica: string;
    categoria: string;
    precioVenta: string;
  };
  artesano: {
    nombreCompleto: string;
    nombreTaller: string | null;
  };
  /** Ruta pública de la foto principal (p. ej. "/uploads/xxx.jpg"). */
  rutaFotoPrincipal: string;
  fechaEmision: Date;
}

/**
 * Genera el PNG del QR y ensambla el certificado PDF (HU-10, HU-11).
 * Devuelve las rutas públicas de ambos archivos.
 */
export async function generarArchivosCertificado(datos: DatosCertificado) {
  const archivoQr = path.join(CERTIFICADOS_DIR, `${datos.idCertificado}-qr.png`);
  const archivoPdf = path.join(CERTIFICADOS_DIR, `${datos.idCertificado}.pdf`);
  const url = urlVerificacion(datos.idCertificado);

  await QRCode.toFile(archivoQr, url, { width: 480, margin: 1 });

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 0 });
    const salida = createWriteStream(archivoPdf);
    salida.on("finish", resolve);
    salida.on("error", reject);
    doc.pipe(salida);

    const ancho = doc.page.width; // 612 pt

    // Paleta Artani (tokens del sistema de diseño)
    const verde900 = "#16301f";
    const verde700 = "#2e5c3f";
    const crema = "#faf6ee";
    const arcilla = "#6f5b4c";
    const ambar = "#d99a2b";

    // Encabezado
    doc.rect(0, 0, ancho, 110).fill(verde700);
    doc.fill(crema).font("Times-Bold").fontSize(30).text("Artani", 48, 32);
    doc
      .font("Helvetica")
      .fontSize(11)
      .fill(crema)
      .text("CERTIFICADO DE AUTENTICIDAD ARTESANAL", 48, 72, { characterSpacing: 1.5 });
    doc.rect(0, 110, ancho, 6).fill(ambar);

    // Título de la pieza
    doc.fill(verde900).font("Times-Bold").fontSize(26).text(datos.pieza.nombre, 48, 150, {
      width: ancho - 96,
    });

    const yDatos = doc.y + 18;

    // Foto principal (izquierda). CAM-006: el recuadro responde al tamaño real de la
    // fotografía — se conserva la proporción original (sin deformar ni recortar) y el
    // recuadro se ajusta a la imagen, acotado entre un mínimo y un máximo.
    const MAX_FOTO = { ancho: 210, alto: 270 };
    const MIN_FOTO = 140;
    let altoRecuadro = 0;
    const archivoFoto = path.join(UPLOADS_DIR, path.basename(datos.rutaFotoPrincipal));
    if (existsSync(archivoFoto)) {
      const imagen = (
        doc as unknown as { openImage(src: string): { width: number; height: number } }
      ).openImage(archivoFoto);
      const escala = Math.min(MAX_FOTO.ancho / imagen.width, MAX_FOTO.alto / imagen.height);
      const anchoImagen = imagen.width * escala;
      const altoImagen = imagen.height * escala;
      // El recuadro nunca baja del mínimo; si la proporción deja espacio, la imagen se centra
      const anchoRecuadro = Math.max(anchoImagen, MIN_FOTO);
      altoRecuadro = Math.max(altoImagen, MIN_FOTO);
      const xRecuadro = 48 + (MAX_FOTO.ancho - anchoRecuadro) / 2;
      doc.image(
        archivoFoto,
        xRecuadro + (anchoRecuadro - anchoImagen) / 2,
        yDatos + (altoRecuadro - altoImagen) / 2,
        { width: anchoImagen, height: altoImagen },
      );
      doc.rect(xRecuadro, yDatos, anchoRecuadro, altoRecuadro).lineWidth(1.5).stroke(verde700);
    }

    // Ficha (derecha)
    const xFicha = 290;
    let y = yDatos;
    const campo = (etiqueta: string, valor: string) => {
      doc.font("Helvetica-Bold").fontSize(9).fill(arcilla).text(etiqueta.toUpperCase(), xFicha, y, {
        characterSpacing: 1,
      });
      doc.font("Helvetica").fontSize(13).fill(verde900).text(valor, xFicha, y + 13, {
        width: ancho - xFicha - 48,
      });
      y = doc.y + 14;
    };
    campo("Artesano", datos.artesano.nombreCompleto);
    if (datos.artesano.nombreTaller) campo("Taller", datos.artesano.nombreTaller);
    campo("Técnica", datos.pieza.tecnica);
    campo("Categoría", datos.pieza.categoria);
    campo(
      "Fecha de emisión",
      datos.fechaEmision.toLocaleDateString("es-MX", { dateStyle: "long" }),
    );
    campo("Folio del certificado", datos.idCertificado);

    // Bloque de verificación con QR (debajo de la ficha y del recuadro de la foto)
    const yQr = Math.max(y, yDatos + altoRecuadro + 20);
    doc.rect(48, yQr, ancho - 96, 170).fill(crema);
    doc.image(archivoQr, 68, yQr + 20, { width: 130 });
    doc
      .font("Times-Bold")
      .fontSize(16)
      .fill(verde900)
      .text("Verificación pública", 220, yQr + 28);
    doc
      .font("Helvetica")
      .fontSize(11)
      .fill(arcilla)
      .text(
        "Escanea el código QR o visita la dirección siguiente para confirmar la autenticidad de esta pieza contra el registro del taller:",
        220,
        yQr + 54,
        { width: ancho - 220 - 68, lineGap: 2 },
      );
    doc.font("Courier").fontSize(10).fill(verde700).text(url, 220, doc.y + 8, {
      width: ancho - 220 - 68,
    });

    // Pie
    doc
      .font("Helvetica")
      .fontSize(9)
      .fill(arcilla)
      .text(
        "La verificación confirma que el código QR corresponde a un registro auténtico en Artani.",
        48,
        doc.page.height - 60,
        { width: ancho - 96, align: "center" },
      );

    doc.end();
  });

  return {
    rutaQr: rutaQrPublica(datos.idCertificado),
    rutaPdf: rutaPdfPublica(datos.idCertificado),
  };
}
