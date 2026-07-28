import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { limpiarBaseDatos } from "../helpers/db.js";
import { api, auth, crearArtesanoAutenticado, crearCatalogosBase, type ArtesanoPrueba } from "../helpers/api.js";
import { PNG_1X1, JPG_1X1, pngDeTamano } from "../helpers/imagenes.js";

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
    .send({ nombre, descripcion: "Pieza torneada a mano", idTecnica, idCategoria });
  return res.body as { idArtesania: string; estado: string };
}

// ---------------------------------------------------------------------------
// HU-06 · Registro de nueva artesanía
// ---------------------------------------------------------------------------
describe("HU-06 · Registro de nueva artesanía (Inventario)", () => {
  it("caso de éxito: registra la pieza con técnica y categoría y aparece en el inventario", async () => {
    const res = await api()
      .post("/api/artesanias")
      .set(...auth(sesion))
      .send({ nombre: "Jarrón ceremonial", descripcion: "Pieza torneada", idTecnica, idCategoria });

    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe("Jarrón ceremonial");
    expect(res.body.tecnica.idTecnica).toBe(idTecnica);
    expect(res.body.categoria.idCategoria).toBe(idCategoria);

    const listado = await api()
      .get("/api/artesanias")
      .set(...auth(sesion));
    expect(listado.body).toHaveLength(1);
  });

  it("CA: toda pieza nueva recibe automáticamente el estado «Disponible»", async () => {
    const pieza = await crearPieza();
    expect(pieza.estado).toBe("DISPONIBLE");

    // El valor lo asigna el DEFAULT de la base de datos, no la aplicación
    const enBd = await prisma.artesania.findUniqueOrThrow({
      where: { idArtesania: pieza.idArtesania },
    });
    expect(enBd.estado).toBe("DISPONIBLE");
  });

  it("caso de fallo: falta el nombre obligatorio (400)", async () => {
    const res = await api()
      .post("/api/artesanias")
      .set(...auth(sesion))
      .send({ idTecnica, idCategoria });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/"nombre" es obligatorio/i);
  });

  it("caso de fallo: falta la técnica o la categoría obligatorias (400)", async () => {
    const sinTecnica = await api()
      .post("/api/artesanias")
      .set(...auth(sesion))
      .send({ nombre: "Pieza sin técnica", idCategoria });
    const sinCategoria = await api()
      .post("/api/artesanias")
      .set(...auth(sesion))
      .send({ nombre: "Pieza sin categoría", idTecnica });

    expect(sinTecnica.status).toBe(400);
    expect(sinTecnica.body.error).toMatch(/"idTecnica"/);
    expect(sinCategoria.status).toBe(400);
    expect(sinCategoria.body.error).toMatch(/"idCategoria"/);
  });

  it("CA: la baja exige justificación, es lógica y retira la pieza de los listados", async () => {
    const pieza = await crearPieza();

    const sinMotivo = await api()
      .delete(`/api/artesanias/${pieza.idArtesania}`)
      .set(...auth(sesion))
      .send({});
    expect(sinMotivo.status).toBe(400);
    expect(sinMotivo.body.error).toMatch(/"motivo" es obligatorio/i);

    const conMotivo = await api()
      .delete(`/api/artesanias/${pieza.idArtesania}`)
      .set(...auth(sesion))
      .send({ motivo: "La pieza se fracturó durante el traslado" });
    expect(conMotivo.status).toBe(204);

    // Borrado lógico: el registro persiste con su motivo y fecha
    const enBd = await prisma.artesania.findUniqueOrThrow({
      where: { idArtesania: pieza.idArtesania },
    });
    expect(enBd.eliminado).toBe(true);
    expect(enBd.motivoEliminacion).toBe("La pieza se fracturó durante el traslado");
    expect(enBd.fechaEliminacion).toBeInstanceOf(Date);

    const listado = await api()
      .get("/api/artesanias")
      .set(...auth(sesion));
    expect(listado.body).toHaveLength(0);
  });

  it("caso de fallo: consultar una pieza dada de baja devuelve 404 en el panel administrativo", async () => {
    const pieza = await crearPieza();
    await api()
      .delete(`/api/artesanias/${pieza.idArtesania}`)
      .set(...auth(sesion))
      .send({ motivo: "Rota" });

    const res = await api()
      .get(`/api/artesanias/${pieza.idArtesania}`)
      .set(...auth(sesion));
    expect(res.status).toBe(404);
  });

  it("RF_009: el inventario se filtra por nombre, técnica, categoría y estado", async () => {
    await crearPieza("Jarrón ceremonial");
    await crearPieza("Olla de barro");

    const porNombre = await api()
      .get("/api/artesanias?busqueda=jarr")
      .set(...auth(sesion));
    expect(porNombre.body).toHaveLength(1);
    expect(porNombre.body[0].nombre).toBe("Jarrón ceremonial");

    const porEstado = await api()
      .get("/api/artesanias?estado=DISPONIBLE")
      .set(...auth(sesion));
    expect(porEstado.body).toHaveLength(2);

    const porTecnica = await api()
      .get(`/api/artesanias?idTecnica=${idTecnica}`)
      .set(...auth(sesion));
    expect(porTecnica.body).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// HU-07 · Subir fotografías de la pieza
// ---------------------------------------------------------------------------
describe("HU-07 · Fotografías de la pieza", () => {
  it("caso de éxito: acepta PNG y JPG y los asocia a la pieza", async () => {
    const pieza = await crearPieza();

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", PNG_1X1, { filename: "pieza.png", contentType: "image/png" })
      .attach("fotos", JPG_1X1, { filename: "pieza.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].rutaArchivo).toMatch(/^\/uploads\/.+\.png$/);
  });

  it("CA: si no se marca ninguna, la primera fotografía cargada queda como principal", async () => {
    const pieza = await crearPieza();

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", PNG_1X1, { filename: "a.png", contentType: "image/png" })
      .attach("fotos", PNG_1X1, { filename: "b.png", contentType: "image/png" });

    expect(res.body[0].esPrincipal).toBe(true);
    expect(res.body[1].esPrincipal).toBe(false);

    const principales = await prisma.fotoArtesania.count({
      where: { idArtesania: pieza.idArtesania, esPrincipal: true },
    });
    expect(principales).toBe(1);
  });

  it("caso de éxito: marcar otra foto como principal deja exactamente una principal", async () => {
    const pieza = await crearPieza();
    const carga = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", PNG_1X1, { filename: "a.png", contentType: "image/png" })
      .attach("fotos", PNG_1X1, { filename: "b.png", contentType: "image/png" });

    const segunda = carga.body[1];
    const res = await api()
      .patch(`/api/artesanias/${pieza.idArtesania}/fotos/${segunda.idFoto}/principal`)
      .set(...auth(sesion));

    expect(res.status).toBe(200);
    const principales = await prisma.fotoArtesania.findMany({
      where: { idArtesania: pieza.idArtesania, esPrincipal: true },
    });
    expect(principales).toHaveLength(1);
    expect(principales[0]!.idFoto).toBe(segunda.idFoto);
  });

  it("CA (caso de fallo): rechaza formatos distintos de PNG/JPG", async () => {
    const pieza = await crearPieza();

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", Buffer.from("%PDF-1.7 documento"), {
        filename: "ficha.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/PNG o JPG/i);
  });

  it("CA (caso de fallo): rechaza archivos de más de 5 MB", async () => {
    const pieza = await crearPieza();

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", pngDeTamano(5 * 1024 * 1024 + 1024), {
        filename: "enorme.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/máximo 5 MB/i);
  });

  it("CA (frontera): el umbral efectivo es 5 MiB exclusivo — 5242879 B se acepta, 5242880 B se rechaza", async () => {
    const pieza = await crearPieza();
    const MIB5 = 5 * 1024 * 1024;

    const justoDebajo = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", pngDeTamano(MIB5 - 1), { filename: "borde.png", contentType: "image/png" });
    expect(justoDebajo.status).toBe(201);

    const enElLimite = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", pngDeTamano(MIB5), { filename: "limite.png", contentType: "image/png" });
    expect(enElLimite.status).toBe(400);

    // Un archivo de 5 MB decimales (5 000 000 B) queda holgadamente dentro del límite
    const cincoMbDecimales = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", pngDeTamano(5_000_000), { filename: "5mb.png", contentType: "image/png" });
    expect(cincoMbDecimales.status).toBe(201);
  });

  it("caso de fallo: subir fotografías a una pieza inexistente devuelve 404", async () => {
    const res = await api()
      .post("/api/artesanias/00000000-0000-4000-8000-000000000000/fotos")
      .set(...auth(sesion))
      .attach("fotos", PNG_1X1, { filename: "a.png", contentType: "image/png" });

    expect(res.status).toBe(404);
  });

  it("caso de éxito: al borrar la foto principal, otra pasa a serlo automáticamente", async () => {
    const pieza = await crearPieza();
    const carga = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", PNG_1X1, { filename: "a.png", contentType: "image/png" })
      .attach("fotos", PNG_1X1, { filename: "b.png", contentType: "image/png" });

    await api()
      .delete(`/api/artesanias/${pieza.idArtesania}/fotos/${carga.body[0].idFoto}`)
      .set(...auth(sesion));

    const restantes = await prisma.fotoArtesania.findMany({
      where: { idArtesania: pieza.idArtesania },
    });
    expect(restantes).toHaveLength(1);
    expect(restantes[0]!.esPrincipal).toBe(true);
  });
});
