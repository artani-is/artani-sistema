import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { limpiarBaseDatos } from "../helpers/db.js";
import { api, auth, crearArtesanoAutenticado, crearCatalogosBase, type ArtesanoPrueba } from "../helpers/api.js";
import { pngDeDimensiones } from "../helpers/imagenes.js";
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
  it("mide si la fotografía almacenada se comprime respecto del archivo recibido", async () => {
    const id = await nuevaPieza("Pieza con foto pesada");
    // PNG sin comprimir en contenido: 800×600 de color plano
    const original = pngDeDimensiones(800, 600);

    const carga = await api()
      .post(`/api/artesanias/${id}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", original, { filename: "grande.png", contentType: "image/png" });
    expect(carga.status).toBe(201);

    const rutaAlmacenada = carga.body[0].rutaArchivo as string;
    const archivo = path.join(UPLOADS_DIR, path.basename(rutaAlmacenada));
    const almacenado = statSync(archivo).size;

    console.log(
      `[RNF_012] recibido=${original.length} B · almacenado=${almacenado} B · ` +
        `reducción=${(((original.length - almacenado) / original.length) * 100).toFixed(1)} %`,
    );

    // Resultado observado: el archivo se guarda tal cual, byte a byte. No existe
    // ninguna etapa de recompresión ni redimensionado en la carga de fotografías,
    // por lo que el RNF_012 NO se satisface en el estado actual del sistema.
    expect(almacenado).toBe(original.length);
    expect(readFileSync(archivo).equals(original)).toBe(true);
  });

  it("el único control de peso existente es el límite de 5 MB por archivo", async () => {
    const { pngDeTamano } = await import("../helpers/imagenes.js");
    const id = await nuevaPieza("Pieza límite");

    const res = await api()
      .post(`/api/artesanias/${id}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", pngDeTamano(6 * 1024 * 1024), {
        filename: "pesada.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/máximo 5 MB/i);
  });
});
