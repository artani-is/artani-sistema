import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import sharp from "sharp";
import { prisma } from "../../src/lib/prisma.js";
import { limpiarBaseDatos } from "../helpers/db.js";
import { api, auth, crearArtesanoAutenticado, crearCatalogosBase, type ArtesanoPrueba } from "../helpers/api.js";
import { fotoDePrueba } from "../helpers/imagenes.js";
import { textoDelPdf } from "../helpers/pdf.js";
import { UPLOADS_DIR } from "../../src/lib/uploads.js";
import { LADO_MAXIMO_PX } from "../../src/lib/imagenes.js";

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

async function crearPieza(nombre = "Jarrón ceremonial") {
  const res = await api()
    .post("/api/artesanias")
    .set(...auth(sesion))
    .send({ nombre, idTecnica, idCategoria });
  return res.body as { idArtesania: string };
}

/** Ruta en disco de un archivo servido bajo /uploads. */
function enDisco(rutaPublica: string): string {
  return path.join(UPLOADS_DIR, path.basename(rutaPublica));
}

describe("HU-07 / RNF_012 · Compresión y conversión de fotografías", () => {
  it("caso de éxito: una foto de teléfono se reduce y genera los dos derivados", async () => {
    const pieza = await crearPieza();
    // Fotografía de 4000×3000, como la de un teléfono actual
    const original = await fotoDePrueba(4000, 3000);

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", original, { filename: "pieza.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(201);
    const foto = res.body[0] as { rutaWebp: string; rutaJpeg: string };
    expect(foto.rutaWebp).toMatch(/\.webp$/);
    expect(foto.rutaJpeg).toMatch(/\.jpg$/);

    const webp = await sharp(enDisco(foto.rutaWebp)).metadata();
    const jpeg = await sharp(enDisco(foto.rutaJpeg)).metadata();

    // Formatos correctos
    expect(webp.format).toBe("webp");
    expect(jpeg.format).toBe("jpeg");

    // Lado mayor acotado a 1600 px, conservando la proporción 4:3
    expect(Math.max(webp.width!, webp.height!)).toBe(LADO_MAXIMO_PX);
    expect(webp.width! / webp.height!).toBeCloseTo(4 / 3, 2);
    expect(jpeg.width).toBe(webp.width);
    expect(jpeg.height).toBe(webp.height);

    // El resultado pesa mucho menos que la entrada
    const pesoWebp = statSync(enDisco(foto.rutaWebp)).size;
    const pesoJpeg = statSync(enDisco(foto.rutaJpeg)).size;
    console.log(
      `[RNF_012] entrada=${(original.length / 1024 / 1024).toFixed(2)} MB · ` +
        `webp=${(pesoWebp / 1024).toFixed(0)} KB · jpeg=${(pesoJpeg / 1024).toFixed(0)} KB · ` +
        `reducción=${(((original.length - pesoWebp) / original.length) * 100).toFixed(1)} %`,
    );
    expect(pesoWebp).toBeLessThan(original.length);
    expect(pesoJpeg).toBeLessThan(original.length);
  });

  it("CA: una imagen menor que el máximo no se amplía", async () => {
    const pieza = await crearPieza();
    const pequena = await fotoDePrueba(800, 600);

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", pequena, { filename: "chica.jpg", contentType: "image/jpeg" });

    const webp = await sharp(enDisco(res.body[0].rutaWebp)).metadata();
    expect(webp.width).toBe(800);
    expect(webp.height).toBe(600);
  });

  it("CA: la orientación vertical también se acota por su lado mayor", async () => {
    const pieza = await crearPieza();
    const vertical = await fotoDePrueba(2400, 3600);

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", vertical, { filename: "vertical.jpg", contentType: "image/jpeg" });

    const webp = await sharp(enDisco(res.body[0].rutaWebp)).metadata();
    expect(webp.height).toBe(LADO_MAXIMO_PX);
    expect(webp.width).toBe(Math.round((2400 / 3600) * LADO_MAXIMO_PX));
  });

  it("CA: el PNG de entrada también se convierte a los dos derivados", async () => {
    const pieza = await crearPieza();
    // Un PNG de fotografía comprime mal: se usa un tamaño que quepa holgadamente
    // dentro del límite de entrada de 8 MB.
    const png = await sharp(await fotoDePrueba(1200, 900)).png().toBuffer();
    expect(png.length).toBeLessThan(8 * 1024 * 1024);

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", png, { filename: "pieza.png", contentType: "image/png" });

    expect(res.status).toBe(201);
    expect((await sharp(enDisco(res.body[0].rutaWebp)).metadata()).format).toBe("webp");
    expect((await sharp(enDisco(res.body[0].rutaJpeg)).metadata()).format).toBe("jpeg");
  });

  it("CA: el derivado JPEG se incrusta en el certificado sin conversión adicional", async () => {
    const pieza = await crearPieza();
    await api()
      .post(`/api/artesanias/${pieza.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", await fotoDePrueba(3000, 2000), {
        filename: "pieza.jpg",
        contentType: "image/jpeg",
      });
    await api()
      .put(`/api/artesanias/${pieza.idArtesania}/precio`)
      .set(...auth(sesion))
      .send({ precioVenta: 1500 });

    const cert = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/certificado`)
      .set(...auth(sesion));

    expect(cert.status).toBe(201);
    const pdf = readFileSync(
      path.join(UPLOADS_DIR, "certificados", `${cert.body.idCertificado}.pdf`),
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    // El PDF incrusta la imagen: PDFKit la marca con el filtro DCTDecode (JPEG)
    expect(pdf.toString("latin1")).toContain("DCTDecode");
    expect(textoDelPdf(pdf)).toContain("Jarrón ceremonial");
    // Y sigue pesando por debajo del límite de la HU-11
    expect(pdf.length).toBeLessThan(2 * 1024 * 1024);
  });

  it("CA: la ficha pública sirve el WebP, no el JPEG", async () => {
    const pieza = await crearPieza();
    const carga = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", await fotoDePrueba(1200, 900), {
        filename: "pieza.jpg",
        contentType: "image/jpeg",
      });
    await api()
      .put(`/api/artesanias/${pieza.idArtesania}/precio`)
      .set(...auth(sesion))
      .send({ precioVenta: 900 });
    const cert = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/certificado`)
      .set(...auth(sesion));

    const publica = await api().get(`/api/publico/certificados/${cert.body.idCertificado}`);
    expect(publica.body.pieza.foto).toBe(carga.body[0].rutaWebp);
    expect(publica.body.pieza.foto).toMatch(/\.webp$/);
  });

  it("caso de fallo: un archivo dañado no deja derivados huérfanos en disco", async () => {
    const pieza = await crearPieza();

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", Buffer.from("contenido que no es una imagen"), {
        filename: "rota.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/dañada|no es un archivo/i);
    // No se registró ninguna fotografía
    expect(await prisma.fotoArtesania.count({ where: { idArtesania: pieza.idArtesania } })).toBe(0);
  });

  it("caso de fallo: el original sin comprimir no se conserva en el servidor", async () => {
    const pieza = await crearPieza();
    const original = await fotoDePrueba(4000, 3000);

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", original, { filename: "pieza.jpg", contentType: "image/jpeg" });

    // Solo existen los dos derivados; ningún archivo del tamaño del original
    const foto = res.body[0] as { rutaWebp: string; rutaJpeg: string };
    for (const ruta of [foto.rutaWebp, foto.rutaJpeg]) {
      expect(statSync(enDisco(ruta)).size).toBeLessThan(original.length / 2);
    }
  });
});
