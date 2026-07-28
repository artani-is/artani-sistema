import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { limpiarBaseDatos } from "../helpers/db.js";
import { api, auth, crearArtesanoAutenticado, crearCatalogosBase, type ArtesanoPrueba } from "../helpers/api.js";
import { PNG_1X1, pngDeDimensiones } from "../helpers/imagenes.js";
import { imagenesColocadas, textoDelPdf } from "../helpers/pdf.js";
import { UPLOADS_DIR } from "../../src/lib/uploads.js";

let sesion: ArtesanoPrueba;
let idTecnica: string;
let idCategoria: string;

beforeEach(async () => {
  await limpiarBaseDatos();
  sesion = await crearArtesanoAutenticado();
  const { tecnica, categoria } = await crearCatalogosBase();
  idTecnica = tecnica.idTecnica;
  idCategoria = categoria.idCategoria;
});

/** Pieza lista para certificar: con fotografía y precio de venta final. */
async function piezaCertificable(opciones: { foto?: Buffer; precio?: number; nombre?: string } = {}) {
  const { foto = PNG_1X1, precio = 1850, nombre = "Jarrón ceremonial" } = opciones;
  const pieza = await api()
    .post("/api/artesanias")
    .set(...auth(sesion))
    .send({ nombre, descripcion: "Pieza torneada a mano", idTecnica, idCategoria });

  await api()
    .post(`/api/artesanias/${pieza.body.idArtesania}/fotos`)
    .set(...auth(sesion))
    .attach("fotos", foto, { filename: "pieza.png", contentType: "image/png" });

  await api()
    .put(`/api/artesanias/${pieza.body.idArtesania}/precio`)
    .set(...auth(sesion))
    .send({ precioVenta: precio });

  return pieza.body as { idArtesania: string };
}

// ---------------------------------------------------------------------------
// HU-10 · Generación de código QR único
// ---------------------------------------------------------------------------
describe("HU-10 · Generación de código QR único", () => {
  it("caso de éxito: emite el certificado con su QR y su URL de verificación", async () => {
    const pieza = await piezaCertificable();

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/certificado`)
      .set(...auth(sesion));

    expect(res.status).toBe(201);
    expect(res.body.idCertificado).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    // CA: el QR apunta exclusivamente a la ficha pública de la pieza
    expect(res.body.urlVerificacion).toBe(
      `http://localhost:5173/verificar/${res.body.idCertificado}`,
    );
    expect(res.body.rutaQr).toBe(`/uploads/certificados/${res.body.idCertificado}-qr.png`);
    expect(existsSync(path.join(UPLOADS_DIR, "certificados", `${res.body.idCertificado}-qr.png`))).toBe(true);
  });

  it("RNF_006: el identificador del certificado es UNIQUE a nivel de base de datos", async () => {
    const pieza = await piezaCertificable();
    const emitido = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/certificado`)
      .set(...auth(sesion));
    const idCertificado = emitido.body.idCertificado as string;

    // Intento de insertar un segundo certificado con el MISMO id, saltándose la
    // aplicación: la restricción de la base de datos debe rechazarlo.
    const otra = await piezaCertificable({ nombre: "Olla de barro" });
    await expect(
      prisma.certificadoQr.create({
        data: { idCertificado, idArtesania: otra.idArtesania, rutaPdf: "/uploads/x.pdf" },
      }),
    ).rejects.toThrow();

    const total = await prisma.certificadoQr.count({ where: { idCertificado } });
    expect(total).toBe(1);
  });

  it("RNF_006: la relación pieza–certificado es 1:1; no se emiten dos QR para la misma pieza", async () => {
    const pieza = await piezaCertificable();
    const primero = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/certificado`)
      .set(...auth(sesion));
    expect(primero.status).toBe(201);

    const segundo = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/certificado`)
      .set(...auth(sesion));
    expect(segundo.status).toBe(409);
    expect(segundo.body.error).toMatch(/ya cuenta con un certificado/i);
  });

  it("RNF_006: 25 certificados emitidos producen 25 identificadores distintos", async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const pieza = await piezaCertificable({ nombre: `Pieza ${i}` });
      const res = await api()
        .post(`/api/artesanias/${pieza.idArtesania}/certificado`)
        .set(...auth(sesion));
      ids.add(res.body.idCertificado);
    }
    expect(ids.size).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// HU-11 · Ensamblado de certificado PDF
// ---------------------------------------------------------------------------
describe("HU-11 · Ensamblado de certificado PDF", () => {
  it("caso de éxito: genera un PDF válido de menos de 2 MB", async () => {
    const pieza = await piezaCertificable();

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/certificado`)
      .set(...auth(sesion));

    const archivo = path.join(UPLOADS_DIR, "certificados", `${res.body.idCertificado}.pdf`);
    expect(existsSync(archivo)).toBe(true);

    const pdf = readFileSync(archivo);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    // CA: el certificado debe pesar menos de 2 MB
    expect(pdf.length).toBeLessThan(2 * 1024 * 1024);
  });

  it("CA (caso de fallo): sin fotografía no puede emitirse el certificado (409)", async () => {
    const pieza = await api()
      .post("/api/artesanias")
      .set(...auth(sesion))
      .send({ nombre: "Sin foto", idTecnica, idCategoria });
    await api()
      .put(`/api/artesanias/${pieza.body.idArtesania}/precio`)
      .set(...auth(sesion))
      .send({ precioVenta: 500 });

    const res = await api()
      .post(`/api/artesanias/${pieza.body.idArtesania}/certificado`)
      .set(...auth(sesion));

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/al menos una fotografía/i);
  });

  it("CA (caso de fallo): sin precio de venta final no puede emitirse el certificado (409)", async () => {
    const pieza = await api()
      .post("/api/artesanias")
      .set(...auth(sesion))
      .send({ nombre: "Sin precio", idTecnica, idCategoria });
    await api()
      .post(`/api/artesanias/${pieza.body.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", PNG_1X1, { filename: "p.png", contentType: "image/png" });

    const res = await api()
      .post(`/api/artesanias/${pieza.body.idArtesania}/certificado`)
      .set(...auth(sesion));

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/precio de venta final/i);
  });

  it("CA: la fotografía conserva su proporción original (apaisada y vertical, sin deformar)", async () => {
    // Foto apaisada 400×200 (2:1)
    const apaisada = await piezaCertificable({
      foto: pngDeDimensiones(400, 200),
      nombre: "Pieza apaisada",
    });
    const certA = await api()
      .post(`/api/artesanias/${apaisada.idArtesania}/certificado`)
      .set(...auth(sesion));
    const pdfA = readFileSync(
      path.join(UPLOADS_DIR, "certificados", `${certA.body.idCertificado}.pdf`),
    );

    // Foto vertical 200×400 (1:2)
    const vertical = await piezaCertificable({
      foto: pngDeDimensiones(200, 400),
      nombre: "Pieza vertical",
    });
    const certV = await api()
      .post(`/api/artesanias/${vertical.idArtesania}/certificado`)
      .set(...auth(sesion));
    const pdfV = readFileSync(
      path.join(UPLOADS_DIR, "certificados", `${certV.body.idCertificado}.pdf`),
    );

    // El QR es cuadrado (130×130); la fotografía es la imagen no cuadrada
    const fotoA = imagenesColocadas(pdfA).find((i) => Math.abs(i.ancho - i.alto) > 1);
    const fotoV = imagenesColocadas(pdfV).find((i) => Math.abs(i.ancho - i.alto) > 1);

    expect(fotoA, "no se localizó la fotografía apaisada en el PDF").toBeDefined();
    expect(fotoV, "no se localizó la fotografía vertical en el PDF").toBeDefined();

    // CA: proporción original conservada (2:1 y 1:2), sin deformar ni recortar
    expect(fotoA!.ancho / fotoA!.alto).toBeCloseTo(2, 2);
    expect(fotoV!.ancho / fotoV!.alto).toBeCloseTo(0.5, 2);

    // Escalado por el lado que primero topa con el máximo (210×270 pt):
    //  · apaisada: limita el ancho  → 400×200 × (210/400) = 210×105
    //  · vertical: limita el alto   → 200×400 × (270/400) = 135×270
    expect(fotoA!.ancho).toBeCloseTo(210, 1);
    expect(fotoA!.alto).toBeCloseTo(105, 1);
    expect(fotoV!.ancho).toBeCloseTo(135, 1);
    expect(fotoV!.alto).toBeCloseTo(270, 1);
  });

  it("CA: la fotografía queda centrada dentro del recuadro del certificado", async () => {
    const apaisada = await piezaCertificable({
      foto: pngDeDimensiones(400, 200),
      nombre: "Pieza",
    });
    const certA = await api()
      .post(`/api/artesanias/${apaisada.idArtesania}/certificado`)
      .set(...auth(sesion));
    const vertical = await piezaCertificable({ foto: pngDeDimensiones(200, 400), nombre: "Pieza" });
    const certV = await api()
      .post(`/api/artesanias/${vertical.idArtesania}/certificado`)
      .set(...auth(sesion));

    const leer = (id: string) =>
      imagenesColocadas(
        readFileSync(path.join(UPLOADS_DIR, "certificados", `${id}.pdf`)),
      ).find((i) => Math.abs(i.ancho - i.alto) > 1)!;

    const fotoA = leer(certA.body.idCertificado);
    const fotoV = leer(certV.body.idCertificado);

    // Centrado HORIZONTAL: el recuadro se ajusta a la imagen con un mínimo de
    // 140 pt y se centra en la columna de 210 pt que arranca en x = 48.
    //  · apaisada (210 pt de ancho): recuadro 210 → x = 48
    //  · vertical (135 pt de ancho): recuadro 140 → x = 48 + (210-140)/2 + (140-135)/2 = 85.5
    expect(fotoA.x).toBeCloseTo(48, 1);
    expect(fotoV.x).toBeCloseTo(85.5, 1);

    // Centrado VERTICAL: ambas piezas se titulan igual, así que el recuadro
    // arranca a la misma altura (y0). La apaisada (105 pt) se centra en el
    // recuadro mínimo de 140 pt → 17.5 pt de margen arriba y abajo; la vertical
    // (270 pt) llena su recuadro y no deja margen.
    // PDFKit dibuja sobre un sistema volteado (`1 0 0 -1 0 792 cm`) en el que la
    // `y` de la matriz crece hacia abajo, de modo que el borde inferior es:
    //   apaisada → y0 + 17.5 + 105 = y0 + 122.5
    //   vertical → y0 +  0   + 270 = y0 + 270
    // La diferencia comprueba que el margen de centrado aplicado es de 17.5 pt.
    expect(fotoV.y - fotoA.y).toBeCloseTo(147.5, 1);
  });

  it("RNF_010: los datos del PDF coinciden con lo almacenado en base de datos", async () => {
    const pieza = await piezaCertificable({ nombre: "Jarrón ceremonial" });
    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/certificado`)
      .set(...auth(sesion));

    const pdf = readFileSync(
      path.join(UPLOADS_DIR, "certificados", `${res.body.idCertificado}.pdf`),
    );
    const texto = textoDelPdf(pdf);

    const enBd = await prisma.artesania.findUniqueOrThrow({
      where: { idArtesania: pieza.idArtesania },
      include: { tecnica: true, categoria: true, artesano: true },
    });

    expect(texto).toContain(enBd.nombre);
    expect(texto).toContain(enBd.tecnica.nombre);
    expect(texto).toContain(enBd.categoria.nombre);
    expect(texto).toContain(enBd.artesano.nombres);
    expect(texto).toContain(res.body.idCertificado);
    expect(texto).toContain(`/verificar/${res.body.idCertificado}`);
  });
});

// ---------------------------------------------------------------------------
// HU-12 · Verificación pública
// ---------------------------------------------------------------------------
describe("HU-12 · Verificación pública (escaneo del comprador)", () => {
  it("CA (caso de éxito): la vista pública NO requiere inicio de sesión", async () => {
    const pieza = await piezaCertificable();
    const cert = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/certificado`)
      .set(...auth(sesion));

    // Petición SIN encabezado Authorization
    const res = await api().get(`/api/publico/certificados/${cert.body.idCertificado}`);

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("VALIDO");
    expect(res.body.pieza.nombre).toBe("Jarrón ceremonial");
    expect(res.body.artesano.nombre).toMatch(/Fernando/);
  });

  it("CA (caso de fallo): un código inexistente devuelve un mensaje claro de no verificable", async () => {
    const res = await api().get(
      "/api/publico/certificados/00000000-0000-4000-8000-000000000000",
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no pudo verificarse/i);
  });

  it("CA (caso de fallo): un código con formato inválido devuelve mensaje claro, no error interno", async () => {
    const res = await api().get("/api/publico/certificados/codigo-falsificado");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no pudo verificarse/i);
    expect(res.body.error).not.toMatch(/interno/i);
  });

  it("CA: una pieza dada de baja sigue resolviendo, con estado BAJA (no como inexistente)", async () => {
    const pieza = await piezaCertificable();
    const cert = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/certificado`)
      .set(...auth(sesion));

    await api()
      .delete(`/api/artesanias/${pieza.idArtesania}`)
      .set(...auth(sesion))
      .send({ motivo: "Pieza fracturada durante el traslado" });

    const res = await api().get(`/api/publico/certificados/${cert.body.idCertificado}`);

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("BAJA");
    expect(res.body.pieza.nombre).toBe("Jarrón ceremonial");
  });

  it("CA: cada verificación exitosa queda registrada con fecha y hora", async () => {
    const pieza = await piezaCertificable();
    const cert = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/certificado`)
      .set(...auth(sesion));

    await api().get(`/api/publico/certificados/${cert.body.idCertificado}`);
    await api().get(`/api/publico/certificados/${cert.body.idCertificado}`);
    await api().get(`/api/publico/certificados/${cert.body.idCertificado}`);

    const registros = await prisma.verificacionCertificado.findMany({
      where: { idCertificado: cert.body.idCertificado },
    });
    expect(registros).toHaveLength(3);
    expect(registros[0]!.fechaHora).toBeInstanceOf(Date);
  });

  it("CA: la bitácora de verificaciones es visible para el artesano, no para el comprador", async () => {
    const pieza = await piezaCertificable();
    const cert = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/certificado`)
      .set(...auth(sesion));
    await api().get(`/api/publico/certificados/${cert.body.idCertificado}`);

    // La respuesta pública no expone la bitácora
    const publica = await api().get(`/api/publico/certificados/${cert.body.idCertificado}`);
    expect(publica.body).not.toHaveProperty("verificaciones");

    // El artesano autenticado sí la consulta
    const privada = await api()
      .get(`/api/artesanias/${pieza.idArtesania}/certificado`)
      .set(...auth(sesion));
    expect(privada.status).toBe(200);
    expect(privada.body.verificaciones.length).toBeGreaterThanOrEqual(2);
    expect(privada.body._count.verificaciones).toBeGreaterThanOrEqual(2);
  });

  it("RNF_013: la bitácora registra solo fecha y hora, sin datos personales del comprador", async () => {
    const pieza = await piezaCertificable();
    const cert = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/certificado`)
      .set(...auth(sesion));
    await api()
      .get(`/api/publico/certificados/${cert.body.idCertificado}`)
      .set("User-Agent", "Mozilla/5.0 (iPhone)")
      .set("X-Forwarded-For", "189.203.44.12");

    const registro = await prisma.verificacionCertificado.findFirstOrThrow({
      where: { idCertificado: cert.body.idCertificado },
    });

    // El modelo solo conserva identificador, certificado y marca temporal
    expect(Object.keys(registro).sort()).toEqual(
      ["fechaHora", "idCertificado", "idVerificacion"].sort(),
    );
  });
});
