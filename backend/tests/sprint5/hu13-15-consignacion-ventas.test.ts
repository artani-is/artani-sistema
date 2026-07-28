import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { limpiarBaseDatos } from "../helpers/db.js";
import { api, auth, crearArtesanoAutenticado, crearCatalogosBase, type ArtesanoPrueba } from "../helpers/api.js";

let sesion: ArtesanoPrueba;
let idTecnica: string;
let idCategoria: string;
let idGaleria: string;

beforeEach(async () => {
  await limpiarBaseDatos();
  sesion = await crearArtesanoAutenticado();
  const { tecnica, categoria } = await crearCatalogosBase();
  idTecnica = tecnica.idTecnica;
  idCategoria = categoria.idCategoria;
  const galeria = await prisma.galeria.create({ data: { nombre: "Galería Quetzalli" } });
  idGaleria = galeria.idGaleria;
});

async function crearPieza(nombre = "Jarrón ceremonial") {
  const res = await api()
    .post("/api/artesanias")
    .set(...auth(sesion))
    .send({ nombre, idTecnica, idCategoria });
  return res.body as { idArtesania: string };
}

// ---------------------------------------------------------------------------
// HU-13 · Registro de salida a consignación
// ---------------------------------------------------------------------------
describe("HU-13 · Registro de salida a consignación", () => {
  it("caso de éxito: envía una pieza Disponible y su estado pasa a En consignación", async () => {
    const pieza = await crearPieza();

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/consignacion`)
      .set(...auth(sesion))
      .send({ idGaleria, porcentajeComision: 30 });

    expect(res.status).toBe(201);
    expect(res.body.galeria.nombre).toBe("Galería Quetzalli");
    expect(res.body.estado).toBe("ACTIVA");

    const detalle = await api()
      .get(`/api/artesanias/${pieza.idArtesania}`)
      .set(...auth(sesion));
    expect(detalle.body.estado).toBe("EN_CONSIGNACION");
  });

  it("CA (caso de fallo): solo las piezas Disponibles pueden enviarse a consignación", async () => {
    const pieza = await crearPieza();
    await api()
      .post(`/api/artesanias/${pieza.idArtesania}/consignacion`)
      .set(...auth(sesion))
      .send({ idGaleria });

    // Segundo envío sobre una pieza ya consignada
    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/consignacion`)
      .set(...auth(sesion))
      .send({ idGaleria });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/solo las piezas disponibles/i);
  });

  it("CA (caso de fallo): una pieza VENDIDA no puede enviarse a consignación", async () => {
    const pieza = await crearPieza();
    await api()
      .post(`/api/artesanias/${pieza.idArtesania}/venta`)
      .set(...auth(sesion))
      .send({ montoCobrado: 1500 });

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/consignacion`)
      .set(...auth(sesion))
      .send({ idGaleria });

    expect(res.status).toBe(409);
  });

  it("CA (caso de fallo): la galería es obligatoria", async () => {
    const pieza = await crearPieza();

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/consignacion`)
      .set(...auth(sesion))
      .send({ porcentajeComision: 30 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/"idGaleria"/);
  });

  it("CA: la galería debe existir en los catálogos maestros", async () => {
    const pieza = await crearPieza();

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/consignacion`)
      .set(...auth(sesion))
      .send({ idGaleria: "00000000-0000-4000-8000-000000000000" });

    expect(res.status).toBe(409);
  });

  it("caso de fallo: la comisión fuera del rango 0–100 se rechaza (400)", async () => {
    const pieza = await crearPieza();

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/consignacion`)
      .set(...auth(sesion))
      .send({ idGaleria, porcentajeComision: 150 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/entre 0 y 100/i);
  });

  it("caso de éxito: la devolución regresa la pieza a Disponible", async () => {
    const pieza = await crearPieza();
    const consignacion = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/consignacion`)
      .set(...auth(sesion))
      .send({ idGaleria });

    const res = await api()
      .patch(`/api/consignaciones/${consignacion.body.idConsignacion}/devolucion`)
      .set(...auth(sesion));

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("DEVUELTA");

    const detalle = await api()
      .get(`/api/artesanias/${pieza.idArtesania}`)
      .set(...auth(sesion));
    expect(detalle.body.estado).toBe("DISPONIBLE");
  });
});

// ---------------------------------------------------------------------------
// HU-14 · Registro de venta final
// ---------------------------------------------------------------------------
describe("HU-14 · Registro de venta final", () => {
  it("CA (caso de éxito): venta DIRECTA desde el estado Disponible", async () => {
    const pieza = await crearPieza();

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/venta`)
      .set(...auth(sesion))
      .send({ montoCobrado: 1850 });

    expect(res.status).toBe(201);
    expect(res.body.canal).toBe("DIRECTA");
    expect(Number(res.body.montoCobrado)).toBe(1850);

    const detalle = await api()
      .get(`/api/artesanias/${pieza.idArtesania}`)
      .set(...auth(sesion));
    expect(detalle.body.estado).toBe("VENDIDA");
  });

  it("CA (caso de éxito): venta reportada por la galería desde En consignación", async () => {
    const pieza = await crearPieza();
    await api()
      .post(`/api/artesanias/${pieza.idArtesania}/consignacion`)
      .set(...auth(sesion))
      .send({ idGaleria, porcentajeComision: 30 });

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/venta`)
      .set(...auth(sesion))
      .send({ montoCobrado: 2400 });

    expect(res.status).toBe(201);
    expect(res.body.canal).toBe("CONSIGNACION");
    expect(res.body.consignacion.galeria.nombre).toBe("Galería Quetzalli");

    // La consignación queda cerrada como VENDIDA y la pieza como VENDIDA
    const consignacion = await prisma.consignacion.findFirstOrThrow({
      where: { idArtesania: pieza.idArtesania },
    });
    expect(consignacion.estado).toBe("VENDIDA");
    const enBd = await prisma.artesania.findUniqueOrThrow({
      where: { idArtesania: pieza.idArtesania },
    });
    expect(enBd.estado).toBe("VENDIDA");
  });

  it("CA (caso de fallo): el monto cobrado debe ser un número positivo", async () => {
    const pieza = await crearPieza();

    for (const montoCobrado of [0, -50]) {
      const res = await api()
        .post(`/api/artesanias/${pieza.idArtesania}/venta`)
        .set(...auth(sesion))
        .send({ montoCobrado });
      expect(res.status, `monto=${montoCobrado}`).toBe(400);
      expect(res.body.error).toMatch(/mayor a cero/i);
    }
  });

  it("CA (caso de fallo): una pieza Vendida no puede editarse en sus datos técnicos", async () => {
    const pieza = await crearPieza();
    await api()
      .post(`/api/artesanias/${pieza.idArtesania}/venta`)
      .set(...auth(sesion))
      .send({ montoCobrado: 1500 });

    const res = await api()
      .put(`/api/artesanias/${pieza.idArtesania}`)
      .set(...auth(sesion))
      .send({ nombre: "Nombre cambiado", idTecnica, idCategoria });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no se puede modificar una pieza vendida/i);
  });

  it("caso de fallo: una pieza no puede venderse dos veces (RF_005)", async () => {
    const pieza = await crearPieza();
    await api()
      .post(`/api/artesanias/${pieza.idArtesania}/venta`)
      .set(...auth(sesion))
      .send({ montoCobrado: 1500 });

    const res = await api()
      .post(`/api/artesanias/${pieza.idArtesania}/venta`)
      .set(...auth(sesion))
      .send({ montoCobrado: 1800 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ya fue vendida/i);
    expect(await prisma.venta.count({ where: { idArtesania: pieza.idArtesania } })).toBe(1);
  });

  it("RNF (integridad): la restricción CHECK de la base de datos rechaza montos no positivos", async () => {
    const pieza = await crearPieza();
    await expect(
      prisma.venta.create({ data: { idArtesania: pieza.idArtesania, montoCobrado: "0" } }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// HU-15 · Filtrado automático de piezas disponibles
// ---------------------------------------------------------------------------
describe("HU-15 · Filtrado automático de piezas disponibles", () => {
  it("CA (caso de éxito): el listado de Disponibles excluye vendidas y consignadas", async () => {
    const disponible = await crearPieza("Pieza disponible");
    const consignada = await crearPieza("Pieza consignada");
    const vendida = await crearPieza("Pieza vendida");

    await api()
      .post(`/api/artesanias/${consignada.idArtesania}/consignacion`)
      .set(...auth(sesion))
      .send({ idGaleria });
    await api()
      .post(`/api/artesanias/${vendida.idArtesania}/venta`)
      .set(...auth(sesion))
      .send({ montoCobrado: 1200 });

    const res = await api()
      .get("/api/artesanias?estado=DISPONIBLE")
      .set(...auth(sesion));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].idArtesania).toBe(disponible.idArtesania);
  });

  it("CA: el cambio de estado se refleja de inmediato en la siguiente consulta del listado", async () => {
    const pieza = await crearPieza();

    const antes = await api()
      .get("/api/artesanias?estado=DISPONIBLE")
      .set(...auth(sesion));
    expect(antes.body).toHaveLength(1);

    await api()
      .post(`/api/artesanias/${pieza.idArtesania}/consignacion`)
      .set(...auth(sesion))
      .send({ idGaleria });

    const despues = await api()
      .get("/api/artesanias?estado=DISPONIBLE")
      .set(...auth(sesion));
    expect(despues.body).toHaveLength(0);
  });

  it("CA: el conteo del panel refleja el filtro aplicado", async () => {
    await crearPieza("A");
    await crearPieza("B");
    const vendida = await crearPieza("C");
    await api()
      .post(`/api/artesanias/${vendida.idArtesania}/venta`)
      .set(...auth(sesion))
      .send({ montoCobrado: 900 });

    const disponibles = await api()
      .get("/api/artesanias?estado=DISPONIBLE")
      .set(...auth(sesion));
    const todas = await api()
      .get("/api/artesanias")
      .set(...auth(sesion));

    expect(disponibles.body).toHaveLength(2);
    expect(todas.body).toHaveLength(3);
  });

  it("CA: restablecer el filtro a la opción general devuelve el listado completo", async () => {
    await crearPieza("A");
    const consignada = await crearPieza("B");
    await api()
      .post(`/api/artesanias/${consignada.idArtesania}/consignacion`)
      .set(...auth(sesion))
      .send({ idGaleria });

    const filtrado = await api()
      .get("/api/artesanias?estado=EN_CONSIGNACION")
      .set(...auth(sesion));
    expect(filtrado.body).toHaveLength(1);

    // Filtro vacío = opción general: sin restricción de estado
    const general = await api()
      .get("/api/artesanias?estado=")
      .set(...auth(sesion));
    expect(general.body).toHaveLength(2);
  });

  it("caso de fallo: un valor de estado no reconocido no rompe el listado (se ignora)", async () => {
    await crearPieza("A");

    const res = await api()
      .get("/api/artesanias?estado=ESTADO_INEXISTENTE")
      .set(...auth(sesion));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("caso de éxito: las piezas dadas de baja quedan fuera de todos los listados", async () => {
    await crearPieza("Activa");
    const baja = await crearPieza("De baja");
    await api()
      .delete(`/api/artesanias/${baja.idArtesania}`)
      .set(...auth(sesion))
      .send({ motivo: "Fracturada" });

    const todas = await api()
      .get("/api/artesanias")
      .set(...auth(sesion));
    expect(todas.body).toHaveLength(1);
    expect(todas.body[0].nombre).toBe("Activa");
  });
});
