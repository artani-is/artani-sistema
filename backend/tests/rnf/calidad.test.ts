import { statSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { limpiarBaseDatos } from "../helpers/db.js";
import { api, auth, crearArtesanoAutenticado, crearCatalogosBase, type ArtesanoPrueba } from "../helpers/api.js";
import { UPLOADS_DIR } from "../../src/lib/uploads.js";

let sesion: ArtesanoPrueba;
let idTecnica: string;
let idCategoria: string;

beforeAll(async () => {
  await limpiarBaseDatos();
  sesion = await crearArtesanoAutenticado();
  const { tecnica, categoria } = await crearCatalogosBase();
  idTecnica = tecnica.idTecnica;
  idCategoria = categoria.idCategoria;
});

async function nuevaPieza(nombre: string) {
  const res = await api()
    .post("/api/artesanias")
    .set(...auth(sesion))
    .send({ nombre, idTecnica, idCategoria });
  return res.body.idArtesania as string;
}

describe("RNF_014 · Localización (español mexicano)", () => {
  it("los mensajes de error de la API están redactados en español", async () => {
    const respuestas = await Promise.all([
      api().post("/api/auth/login").send({ correo: "x@y.mx" }),
      api().post("/api/auth/login").send({ correo: "x@y.mx", contrasena: "z" }),
      api().get("/api/artesanias"),
      api().get("/api/publico/certificados/codigo-invalido"),
    ]);

    const mensajes = respuestas.map((r) => r.body.error as string);
    for (const mensaje of mensajes) {
      expect(mensaje, "mensaje ausente").toBeTruthy();
      // Ninguna cadena de error debe quedar en inglés
      expect(mensaje).not.toMatch(
        /\b(error|invalid|required|not found|unauthorized|forbidden|failed)\b/i,
      );
    }

    expect(mensajes[0]).toMatch(/contraseña es obligatoria/i);
    expect(mensajes[1]).toMatch(/correo o contraseña incorrectos/i);
    expect(mensajes[2]).toMatch(/se requiere autenticación/i);
    expect(mensajes[3]).toMatch(/no pudo verificarse/i);
  });

  it("los mensajes usan acentuación y signos del español", async () => {
    const res = await api().get("/api/artesanias");
    expect(res.body.error).toContain("ó"); // «autenticación»
  });
});

describe("RNF_010 · Integridad entre certificado y base de datos", () => {
  it("la ficha pública devuelve exactamente lo almacenado en la base de datos", async () => {
    const { PNG_1X1 } = await import("../helpers/imagenes.js");
    const id = await nuevaPieza("Jarrón de integridad");
    await api()
      .post(`/api/artesanias/${id}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", PNG_1X1, { filename: "p.png", contentType: "image/png" });
    await api()
      .put(`/api/artesanias/${id}/precio`)
      .set(...auth(sesion))
      .send({ precioVenta: 2100 });
    const cert = await api()
      .post(`/api/artesanias/${id}/certificado`)
      .set(...auth(sesion));

    const publica = await api().get(`/api/publico/certificados/${cert.body.idCertificado}`);
    const enBd = await prisma.artesania.findUniqueOrThrow({
      where: { idArtesania: id },
      include: { tecnica: true, categoria: true, artesano: true, certificado: true },
    });

    expect(publica.body.pieza.nombre).toBe(enBd.nombre);
    expect(publica.body.pieza.tecnica).toBe(enBd.tecnica.nombre);
    expect(publica.body.pieza.categoria).toBe(enBd.categoria.nombre);
    expect(publica.body.idCertificado).toBe(enBd.certificado!.idCertificado);
    expect(new Date(publica.body.fechaEmision).toISOString()).toBe(
      enBd.certificado!.fechaEmision.toISOString(),
    );
  });
});

describe("RNF_012 · Eficiencia (compresión automática de fotografías)", () => {
  it("la fotografía almacenada se comprime respecto del archivo recibido", async () => {
    const { fotoDePrueba } = await import("../helpers/imagenes.js");
    const id = await nuevaPieza("Pieza con foto de teléfono");
    // Entrada equivalente a la de un teléfono actual
    const original = await fotoDePrueba(4000, 3000);

    const carga = await api()
      .post(`/api/artesanias/${id}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", original, { filename: "grande.jpg", contentType: "image/jpeg" });
    expect(carga.status).toBe(201);

    const { rutaWebp, rutaJpeg } = carga.body[0] as { rutaWebp: string; rutaJpeg: string };
    const pesoWebp = statSync(path.join(UPLOADS_DIR, path.basename(rutaWebp))).size;
    const pesoJpeg = statSync(path.join(UPLOADS_DIR, path.basename(rutaJpeg))).size;

    const reduccion = ((original.length - pesoWebp) / original.length) * 100;
    console.log(
      `[RNF_012] recibido=${(original.length / 1024).toFixed(0)} KB · ` +
        `webp=${(pesoWebp / 1024).toFixed(0)} KB · jpeg=${(pesoJpeg / 1024).toFixed(0)} KB · ` +
        `reducción=${reduccion.toFixed(1)} %`,
    );

    // La compresión es efectiva: el archivo servido pesa una fracción del recibido
    expect(pesoWebp).toBeLessThan(original.length * 0.2);
    expect(pesoJpeg).toBeLessThan(original.length * 0.2);
    // Y ambos derivados quedan dentro del orden de magnitud previsto
    expect(pesoWebp).toBeLessThan(400 * 1024);
    expect(pesoJpeg).toBeLessThan(400 * 1024);
  });

  it("el límite de entrada por archivo es de 8 MB", async () => {
    const { pngDeTamano } = await import("../helpers/imagenes.js");
    const id = await nuevaPieza("Pieza límite");

    const res = await api()
      .post(`/api/artesanias/${id}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", pngDeTamano(9 * 1024 * 1024), {
        filename: "pesada.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/máximo 8 MB/i);
  });
});
