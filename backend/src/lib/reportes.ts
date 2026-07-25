import { createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { UPLOADS_DIR } from "./uploads.js";

export const REPORTES_DIR = path.join(UPLOADS_DIR, "reportes");
mkdirSync(REPORTES_DIR, { recursive: true });

export function rutaReportePublica(idReporte: string): string {
  return `/uploads/reportes/${idReporte}.pdf`;
}

interface VentaReporte {
  fechaVenta: Date;
  montoCobrado: string;
  pieza: string;
  canal: "DIRECTA" | "CONSIGNACION";
  galeria: string | null;
}

interface DatosReporte {
  idReporte: string;
  artesano: { nombreCompleto: string; nombreTaller: string | null };
  fechaInicio: Date;
  fechaFin: Date;
  ventas: VentaReporte[];
}

const fmtFecha = (d: Date) =>
  d.toLocaleDateString("es-MX", { dateStyle: "medium", timeZone: "UTC" });
const fmtMoneda = (n: number) =>
  "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Ensambla el PDF del reporte de ventas (HU-16). Devuelve la ruta pública. */
export async function generarPdfReporte(datos: DatosReporte): Promise<string> {
  const archivo = path.join(REPORTES_DIR, `${datos.idReporte}.pdf`);

  const total = datos.ventas.reduce((s, v) => s + Number(v.montoCobrado), 0);
  const directas = datos.ventas
    .filter((v) => v.canal === "DIRECTA")
    .reduce((s, v) => s + Number(v.montoCobrado), 0);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 0 });
    const salida = createWriteStream(archivo);
    salida.on("finish", resolve);
    salida.on("error", reject);
    doc.pipe(salida);

    const ancho = doc.page.width;
    const verde900 = "#16301f";
    const verde700 = "#2e5c3f";
    const crema = "#faf6ee";
    const arcilla = "#6f5b4c";
    const ambar = "#d99a2b";
    const margen = 48;

    // Encabezado
    doc.rect(0, 0, ancho, 96).fill(verde700);
    doc.fill(crema).font("Times-Bold").fontSize(26).text("Artani", margen, 26);
    doc
      .font("Helvetica")
      .fontSize(11)
      .text("REPORTE DE VENTAS", margen, 62, { characterSpacing: 1.5 });
    doc.rect(0, 96, ancho, 5).fill(ambar);

    doc
      .font("Helvetica")
      .fontSize(11)
      .fill(arcilla)
      .text(
        `${datos.artesano.nombreTaller ?? datos.artesano.nombreCompleto} · Periodo: ${fmtFecha(datos.fechaInicio)} — ${fmtFecha(datos.fechaFin)} · Generado: ${new Date().toLocaleDateString("es-MX", { dateStyle: "long" })}`,
        margen,
        120,
        { width: ancho - margen * 2 },
      );

    // Totales (derivados, no almacenados)
    const yTot = 150;
    const tarjetas = [
      ["INGRESOS TOTALES", fmtMoneda(total)],
      ["VENTA DIRECTA", fmtMoneda(directas)],
      ["CONSIGNACIÓN", fmtMoneda(total - directas)],
      ["PIEZAS VENDIDAS", String(datos.ventas.length)],
    ] as const;
    const anchoTarjeta = (ancho - margen * 2 - 12 * 3) / 4;
    tarjetas.forEach(([etiqueta, valor], i) => {
      const x = margen + i * (anchoTarjeta + 12);
      doc.rect(x, yTot, anchoTarjeta, 64).fill(crema);
      doc.font("Helvetica-Bold").fontSize(8).fill(arcilla).text(etiqueta, x + 10, yTot + 12, {
        width: anchoTarjeta - 20,
        characterSpacing: 0.5,
      });
      doc.font("Times-Bold").fontSize(16).fill(verde900).text(valor, x + 10, yTot + 32, {
        width: anchoTarjeta - 20,
      });
    });

    // Tabla de ventas
    let y = yTot + 96;
    const columnas = [
      { titulo: "FECHA", x: margen, ancho: 90 },
      { titulo: "PIEZA", x: margen + 96, ancho: 200 },
      { titulo: "CANAL", x: margen + 302, ancho: 130 },
      { titulo: "MONTO", x: margen + 438, ancho: ancho - margen - (margen + 438) },
    ] as const;

    const encabezadoTabla = () => {
      doc.rect(margen, y, ancho - margen * 2, 24).fill(verde900);
      for (const col of columnas) {
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fill(crema)
          .text(col.titulo, col.x + 6, y + 8, {
            width: col.ancho - 12,
            align: col.titulo === "MONTO" ? "right" : "left",
          });
      }
      y += 24;
    };
    encabezadoTabla();

    for (const [i, venta] of datos.ventas.entries()) {
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = margen;
        encabezadoTabla();
      }
      if (i % 2 === 1) {
        doc.rect(margen, y, ancho - margen * 2, 22).fill(crema);
      }
      const canal = venta.canal === "DIRECTA" ? "Venta directa" : `Consignación${venta.galeria ? ` · ${venta.galeria}` : ""}`;
      const celdas = [
        fmtFecha(venta.fechaVenta),
        venta.pieza,
        canal,
        fmtMoneda(Number(venta.montoCobrado)),
      ];
      columnas.forEach((col, j) => {
        doc
          .font("Helvetica")
          .fontSize(10)
          .fill(j === 3 ? verde700 : arcilla)
          .text(celdas[j] ?? "", col.x + 6, y + 6, {
            width: col.ancho - 12,
            align: j === 3 ? "right" : "left",
            lineBreak: false,
            ellipsis: true,
          });
      });
      y += 22;
    }

    doc
      .font("Helvetica")
      .fontSize(9)
      .fill(arcilla)
      .text(
        `Reporte ${datos.idReporte} · Los totales se calculan sobre las ventas registradas en el periodo.`,
        margen,
        doc.page.height - 56,
        { width: ancho - margen * 2, align: "center" },
      );

    doc.end();
  });

  return rutaReportePublica(datos.idReporte);
}
