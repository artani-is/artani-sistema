import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { limpiarBaseDatos } from "../helpers/db.js";
import { api, auth, crearArtesanoAutenticado, crearCatalogosBase, type ArtesanoPrueba } from "../helpers/api.js";

let sesion: ArtesanoPrueba;
let idTecnica: string;
let idCategoria: string;
let idProveedor: string;

beforeEach(async () => {
  await limpiarBaseDatos();
  sesion = await crearArtesanoAutenticado();
  const { tecnica, categoria } = await crearCatalogosBase();
  idTecnica = tecnica.idTecnica;
  idCategoria = categoria.idCategoria;
  const proveedor = await prisma.proveedor.create({ data: { nombre: "Alfarería Doña Rosa" } });
  idProveedor = proveedor.idProveedor;
});

async function crearPieza(nombre = "Jarrón ceremonial") {
  const res = await api()
    .post("/api/artesanias")
    .set(...auth(sesion))
    .send({ nombre, idTecnica, idCategoria });
  return res.body as { idArtesania: string };
}

async function crearMateriaConCompra(nombre: string, costoUnitario: number, fecha = "2026-03-01") {
  const materia = await prisma.materiaPrima.create({
    data: { nombre, unidadMedida: "KG" },
  });
  await api()
    .post("/api/compras")
    .set(...auth(sesion))
    .send({
      idProveedor,
      fecha,
      detalles: [{ idMateria: materia.idMateria, cantidad: 50, costoUnitario }],
    });
  return materia;
}

/** Réplica de la fórmula de costeo para contrastar el resultado esperado. */
function precioSugerido(
  insumos: { cantidadUsada: number; costoUnitarioUso: number }[],
  horas: number,
  tarifa: number,
) {
  const materiales = insumos.reduce((s, i) => s + i.cantidadUsada * i.costoUnitarioUso, 0);
  return materiales + horas * tarifa;
}

// ---------------------------------------------------------------------------
// HU-08 · Cálculo de precio sugerido
// ---------------------------------------------------------------------------
describe("HU-08 · Cálculo de precio sugerido (Costeo)", () => {
  it("caso de éxito: suma insumos y mano de obra según la fórmula de costeo", async () => {
    const pieza = await crearPieza();
    const barro = await crearMateriaConCompra("Barro crudo", 20);
    const esmalte = await crearMateriaConCompra("Esmalte", 45);

    await api()
      .put(`/api/artesanias/${pieza.idArtesania}/insumos`)
      .set(...auth(sesion))
      .send({
        insumos: [
          { idMateria: barro.idMateria, cantidadUsada: 3 },
          { idMateria: esmalte.idMateria, cantidadUsada: 2 },
        ],
      });
    const costeo = await api()
      .put(`/api/artesanias/${pieza.idArtesania}/costeo`)
      .set(...auth(sesion))
      .send({ horasTrabajadas: 8, tarifaHora: 75 });

    expect(costeo.status).toBe(200);

    const insumos = await api()
      .get(`/api/artesanias/${pieza.idArtesania}/insumos`)
      .set(...auth(sesion));
    const filas = insumos.body.map((i: { cantidadUsada: string; costoUnitarioUso: string }) => ({
      cantidadUsada: Number(i.cantidadUsada),
      costoUnitarioUso: Number(i.costoUnitarioUso),
    }));

    // 3×20 + 2×45 = 150 de materiales; 8×75 = 600 de mano de obra; total 750
    expect(precioSugerido(filas, 8, 75)).toBe(750);
    expect(Number(costeo.body.horasTrabajadas)).toBe(8);
    expect(Number(costeo.body.tarifaHora)).toBe(75);
  });

  it("CA: el costo del insumo se toma del historial de compras MÁS RECIENTE", async () => {
    const pieza = await crearPieza();
    const materia = await prisma.materiaPrima.create({
      data: { nombre: "Barro crudo", unidadMedida: "KG" },
    });

    // Compra antigua a 15 y compra reciente a 28
    await api()
      .post("/api/compras")
      .set(...auth(sesion))
      .send({
        idProveedor,
        fecha: "2026-01-10",
        detalles: [{ idMateria: materia.idMateria, cantidad: 50, costoUnitario: 15 }],
      });
    await api()
      .post("/api/compras")
      .set(...auth(sesion))
      .send({
        idProveedor,
        fecha: "2026-04-05",
        detalles: [{ idMateria: materia.idMateria, cantidad: 50, costoUnitario: 28 }],
      });

    const res = await api()
      .put(`/api/artesanias/${pieza.idArtesania}/insumos`)
      .set(...auth(sesion))
      .send({ insumos: [{ idMateria: materia.idMateria, cantidadUsada: 4 }] });

    expect(res.status).toBe(200);
    expect(Number(res.body[0].costoUnitarioUso)).toBe(28);
  });

  it("CA: el recálculo refleja cambios en cantidades, horas y tarifa", async () => {
    const pieza = await crearPieza();
    const materia = await crearMateriaConCompra("Barro crudo", 20);

    await api()
      .put(`/api/artesanias/${pieza.idArtesania}/insumos`)
      .set(...auth(sesion))
      .send({ insumos: [{ idMateria: materia.idMateria, cantidadUsada: 2 }] });
    await api()
      .put(`/api/artesanias/${pieza.idArtesania}/costeo`)
      .set(...auth(sesion))
      .send({ horasTrabajadas: 5, tarifaHora: 50 });
    // 2×20 + 5×50 = 290

    // Se modifica la cantidad usada y la tarifa
    const nuevos = await api()
      .put(`/api/artesanias/${pieza.idArtesania}/insumos`)
      .set(...auth(sesion))
      .send({ insumos: [{ idMateria: materia.idMateria, cantidadUsada: 6 }] });
    const nuevoCosteo = await api()
      .put(`/api/artesanias/${pieza.idArtesania}/costeo`)
      .set(...auth(sesion))
      .send({ horasTrabajadas: 5, tarifaHora: 90 });

    const filas = nuevos.body.map((i: { cantidadUsada: string; costoUnitarioUso: string }) => ({
      cantidadUsada: Number(i.cantidadUsada),
      costoUnitarioUso: Number(i.costoUnitarioUso),
    }));
    // 6×20 + 5×90 = 570
    expect(precioSugerido(filas, Number(nuevoCosteo.body.horasTrabajadas), Number(nuevoCosteo.body.tarifaHora))).toBe(570);
  });

  it("CA: horas o tarifa en cero NO bloquean el cálculo (advertencia, no error)", async () => {
    const pieza = await crearPieza();
    const materia = await crearMateriaConCompra("Barro crudo", 20);
    await api()
      .put(`/api/artesanias/${pieza.idArtesania}/insumos`)
      .set(...auth(sesion))
      .send({ insumos: [{ idMateria: materia.idMateria, cantidadUsada: 3 }] });

    const res = await api()
      .put(`/api/artesanias/${pieza.idArtesania}/costeo`)
      .set(...auth(sesion))
      .send({ horasTrabajadas: 0, tarifaHora: 0 });

    expect(res.status).toBe(200);
    expect(Number(res.body.horasTrabajadas)).toBe(0);
    // El precio sugerido queda reducido al costo de materiales (3×20 = 60)
    const insumos = await api()
      .get(`/api/artesanias/${pieza.idArtesania}/insumos`)
      .set(...auth(sesion));
    const filas = insumos.body.map((i: { cantidadUsada: string; costoUnitarioUso: string }) => ({
      cantidadUsada: Number(i.cantidadUsada),
      costoUnitarioUso: Number(i.costoUnitarioUso),
    }));
    expect(precioSugerido(filas, 0, 0)).toBe(60);
  });

  it("caso de fallo: horas o tarifa negativas se rechazan (400)", async () => {
    const pieza = await crearPieza();

    const horas = await api()
      .put(`/api/artesanias/${pieza.idArtesania}/costeo`)
      .set(...auth(sesion))
      .send({ horasTrabajadas: -1, tarifaHora: 50 });
    const tarifa = await api()
      .put(`/api/artesanias/${pieza.idArtesania}/costeo`)
      .set(...auth(sesion))
      .send({ horasTrabajadas: 5, tarifaHora: -20 });

    expect(horas.status).toBe(400);
    expect(horas.body.error).toMatch(/mayor o igual a cero/i);
    expect(tarifa.status).toBe(400);
  });

  it("caso de fallo: insumo sin compras registradas y sin costo manual devuelve 400 explicativo", async () => {
    const pieza = await crearPieza();
    const materia = await prisma.materiaPrima.create({
      data: { nombre: "Pigmento sin compras", unidadMedida: "GRAMO" },
    });

    const res = await api()
      .put(`/api/artesanias/${pieza.idArtesania}/insumos`)
      .set(...auth(sesion))
      .send({ insumos: [{ idMateria: materia.idMateria, cantidadUsada: 5 }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no tiene compras registradas/i);
  });

  it("caso de fallo: cantidad usada en cero se rechaza (400)", async () => {
    const pieza = await crearPieza();
    const materia = await crearMateriaConCompra("Barro crudo", 20);

    const res = await api()
      .put(`/api/artesanias/${pieza.idArtesania}/insumos`)
      .set(...auth(sesion))
      .send({ insumos: [{ idMateria: materia.idMateria, cantidadUsada: 0 }] });

    expect(res.status).toBe(400);
  });

  it("CA (HU-05): una compra dada de baja deja de alimentar el costo del insumo", async () => {
    const pieza = await crearPieza();
    const materia = await prisma.materiaPrima.create({
      data: { nombre: "Barro crudo", unidadMedida: "KG" },
    });
    await api()
      .post("/api/compras")
      .set(...auth(sesion))
      .send({
        idProveedor,
        fecha: "2026-01-10",
        detalles: [{ idMateria: materia.idMateria, cantidad: 50, costoUnitario: 15 }],
      });
    const reciente = await api()
      .post("/api/compras")
      .set(...auth(sesion))
      .send({
        idProveedor,
        fecha: "2026-04-05",
        detalles: [{ idMateria: materia.idMateria, cantidad: 50, costoUnitario: 99 }],
      });

    await api()
      .delete(`/api/compras/${reciente.body.idCompra}`)
      .set(...auth(sesion))
      .send({ motivo: "Nota duplicada" });

    const res = await api()
      .put(`/api/artesanias/${pieza.idArtesania}/insumos`)
      .set(...auth(sesion))
      .send({ insumos: [{ idMateria: materia.idMateria, cantidadUsada: 2 }] });

    // Vuelve a tomarse el costo de la compra vigente (15), no el de la compra dada de baja
    expect(Number(res.body[0].costoUnitarioUso)).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// HU-09 · Asignación de precio de venta final
// ---------------------------------------------------------------------------
describe("HU-09 · Asignación de precio de venta final", () => {
  it("caso de éxito: guarda el precio final capturado por el artesano", async () => {
    const pieza = await crearPieza();

    const res = await api()
      .put(`/api/artesanias/${pieza.idArtesania}/precio`)
      .set(...auth(sesion))
      .send({ precioVenta: 1850.5 });

    expect(res.status).toBe(200);
    expect(Number(res.body.precioVenta)).toBe(1850.5);
  });

  it("CA (caso de fallo): el precio debe ser un número positivo", async () => {
    const pieza = await crearPieza();

    for (const precioVenta of [0, -100, "abc"]) {
      const res = await api()
        .put(`/api/artesanias/${pieza.idArtesania}/precio`)
        .set(...auth(sesion))
        .send({ precioVenta });
      expect(res.status, `precioVenta=${precioVenta}`).toBe(400);
      expect(res.body.error).toMatch(/mayor a cero/i);
    }
  });

  it("CA: el precio FINAL (no el sugerido) es el que se propaga al catálogo y al certificado", async () => {
    const pieza = await crearPieza();
    const materia = await crearMateriaConCompra("Barro crudo", 20);

    // Precio sugerido por el sistema: 3×20 + 4×50 = 260
    await api()
      .put(`/api/artesanias/${pieza.idArtesania}/insumos`)
      .set(...auth(sesion))
      .send({ insumos: [{ idMateria: materia.idMateria, cantidadUsada: 3 }] });
    await api()
      .put(`/api/artesanias/${pieza.idArtesania}/costeo`)
      .set(...auth(sesion))
      .send({ horasTrabajadas: 4, tarifaHora: 50 });

    // El artesano decide un precio final distinto
    await api()
      .put(`/api/artesanias/${pieza.idArtesania}/precio`)
      .set(...auth(sesion))
      .send({ precioVenta: 900 });

    const detalle = await api()
      .get(`/api/artesanias/${pieza.idArtesania}`)
      .set(...auth(sesion));
    expect(Number(detalle.body.precioVenta)).toBe(900);
    // El costeo se conserva como insumo del cálculo, pero no sustituye al precio final
    expect(Number(detalle.body.horasTrabajadas)).toBe(4);
  });

  it("caso de fallo: no se puede recostear ni reprecificar una pieza vendida (409)", async () => {
    const pieza = await crearPieza();
    await api()
      .put(`/api/artesanias/${pieza.idArtesania}/precio`)
      .set(...auth(sesion))
      .send({ precioVenta: 500 });
    await api()
      .post(`/api/artesanias/${pieza.idArtesania}/venta`)
      .set(...auth(sesion))
      .send({ montoCobrado: 500 });

    const precio = await api()
      .put(`/api/artesanias/${pieza.idArtesania}/precio`)
      .set(...auth(sesion))
      .send({ precioVenta: 700 });
    const costeo = await api()
      .put(`/api/artesanias/${pieza.idArtesania}/costeo`)
      .set(...auth(sesion))
      .send({ horasTrabajadas: 9, tarifaHora: 80 });

    expect(precio.status).toBe(409);
    expect(precio.body.error).toMatch(/ya fue vendida/i);
    expect(costeo.status).toBe(409);
  });

  it("caso de fallo: asignar precio a una pieza inexistente devuelve 404", async () => {
    const res = await api()
      .put("/api/artesanias/00000000-0000-4000-8000-000000000000/precio")
      .set(...auth(sesion))
      .send({ precioVenta: 100 });

    expect(res.status).toBe(404);
  });
});
