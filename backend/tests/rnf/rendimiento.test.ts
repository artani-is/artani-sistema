import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { limpiarBaseDatos } from "../helpers/db.js";
import { api, auth, crearArtesanoAutenticado, crearCatalogosBase, type ArtesanoPrueba } from "../helpers/api.js";
import { PNG_1X1 } from "../helpers/imagenes.js";
import { medirMs, registrar } from "../helpers/medicion.js";

let sesion: ArtesanoPrueba;
let idTecnica: string;
let idCategoria: string;
let idMateria: string;

beforeAll(async () => {
  await limpiarBaseDatos();
  sesion = await crearArtesanoAutenticado();
  const { tecnica, categoria } = await crearCatalogosBase();
  idTecnica = tecnica.idTecnica;
  idCategoria = categoria.idCategoria;

  const proveedor = await prisma.proveedor.create({ data: { nombre: "Alfarería Doña Rosa" } });
  const materia = await prisma.materiaPrima.create({
    data: { nombre: "Barro crudo", unidadMedida: "KG" },
  });
  idMateria = materia.idMateria;
  await api()
    .post("/api/compras")
    .set(...auth(sesion))
    .send({
      idProveedor: proveedor.idProveedor,
      detalles: [{ idMateria, cantidad: 100, costoUnitario: 22.5 }],
    });
});

async function nuevaPieza(nombre: string) {
  const res = await api()
    .post("/api/artesanias")
    .set(...auth(sesion))
    .send({ nombre, idTecnica, idCategoria });
  return res.body.idArtesania as string;
}

const REPETICIONES = 12; // > 10 muestras, según el criterio de medición

describe("RNF_003 · Tiempo de respuesta (umbral: 3 s)", () => {
  it("el cálculo del precio sugerido no excede 3 s (promedio y máximo sobre 12 corridas)", async () => {
    const piezas: string[] = [];
    for (let i = 0; i < REPETICIONES; i++) piezas.push(await nuevaPieza(`Costeo ${i}`));

    const tiempos = await medirMs(REPETICIONES, async (i) => {
      const id = piezas[i]!;
      // El precio sugerido resulta de registrar los insumos (que resuelven su
      // costo contra el historial de compras) y las horas/tarifa de la pieza.
      const insumos = await api()
        .put(`/api/artesanias/${id}/insumos`)
        .set(...auth(sesion))
        .send({ insumos: [{ idMateria, cantidadUsada: 3 }] });
      const costeo = await api()
        .put(`/api/artesanias/${id}/costeo`)
        .set(...auth(sesion))
        .send({ horasTrabajadas: 8, tarifaHora: 75 });
      expect(insumos.status).toBe(200);
      expect(costeo.status).toBe(200);
    });

    const m = registrar("RNF_003", "Cálculo del precio sugerido", tiempos, { umbral: 3000 });
    expect(m.promedio).toBeLessThan(3000);
    expect(m.maximo).toBeLessThan(3000);
  });

  it("la generación del certificado PDF no excede 3 s (promedio y máximo sobre 12 corridas)", async () => {
    const piezas: string[] = [];
    for (let i = 0; i < REPETICIONES; i++) {
      const id = await nuevaPieza(`Certificado ${i}`);
      await api()
        .post(`/api/artesanias/${id}/fotos`)
        .set(...auth(sesion))
        .attach("fotos", PNG_1X1, { filename: "p.png", contentType: "image/png" });
      await api()
        .put(`/api/artesanias/${id}/precio`)
        .set(...auth(sesion))
        .send({ precioVenta: 1500 });
      piezas.push(id);
    }

    const tiempos = await medirMs(REPETICIONES, async (i) => {
      const res = await api()
        .post(`/api/artesanias/${piezas[i]}/certificado`)
        .set(...auth(sesion));
      expect(res.status).toBe(201);
    });

    const m = registrar("RNF_003", "Generación del certificado PDF (QR + PDF)", tiempos, {
      umbral: 3000,
    });
    expect(m.promedio).toBeLessThan(3000);
    expect(m.maximo).toBeLessThan(3000);
  });

  it("la generación del reporte de ventas en PDF no excede 3 s", async () => {
    // Ventas para alimentar el reporte
    for (let i = 0; i < 10; i++) {
      const id = await nuevaPieza(`Vendida ${i}`);
      await api()
        .post(`/api/artesanias/${id}/venta`)
        .set(...auth(sesion))
        .send({ montoCobrado: 1000 + i, fechaVenta: "2026-03-10" });
    }

    const tiempos = await medirMs(REPETICIONES, async () => {
      const res = await api()
        .post("/api/reportes")
        .set(...auth(sesion))
        .send({ fechaInicio: "2026-03-01", fechaFin: "2026-03-31" });
      expect(res.status).toBe(201);
    });

    const m = registrar("RNF_003", "Generación del reporte de ventas en PDF", tiempos, {
      umbral: 3000,
    });
    expect(m.promedio).toBeLessThan(3000);
    expect(m.maximo).toBeLessThan(3000);
  });

  it("la verificación pública del certificado responde muy por debajo del umbral", async () => {
    const id = await nuevaPieza("Pieza verificable");
    await api()
      .post(`/api/artesanias/${id}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", PNG_1X1, { filename: "p.png", contentType: "image/png" });
    await api()
      .put(`/api/artesanias/${id}/precio`)
      .set(...auth(sesion))
      .send({ precioVenta: 1500 });
    const cert = await api()
      .post(`/api/artesanias/${id}/certificado`)
      .set(...auth(sesion));

    const tiempos = await medirMs(REPETICIONES, async () => {
      const res = await api().get(`/api/publico/certificados/${cert.body.idCertificado}`);
      expect(res.status).toBe(200);
    });

    const m = registrar("RNF_003", "Verificación pública del QR", tiempos, { umbral: 3000 });
    expect(m.maximo).toBeLessThan(3000);
  });
});

describe("RNF_007 · Escalabilidad (10 000 piezas sin degradación)", () => {
  it("el inventario responde dentro del umbral con 10 000 piezas cargadas", async () => {
    const artesano = await prisma.artesano.findFirstOrThrow();

    // Carga masiva directa en base de datos (createMany) para poblar el volumen
    const LOTE = 1000;
    const TOTAL = 10_000;
    for (let inicio = 0; inicio < TOTAL; inicio += LOTE) {
      await prisma.artesania.createMany({
        data: Array.from({ length: LOTE }, (_, k) => ({
          nombre: `Pieza de volumen ${inicio + k}`,
          idArtesano: artesano.idArtesano,
          idTecnica,
          idCategoria,
        })),
      });
    }

    const total = await prisma.artesania.count();
    expect(total).toBeGreaterThanOrEqual(TOTAL);

    // Consulta filtrada, que es la que sirve el panel de inventario
    const tiemposFiltro = await medirMs(REPETICIONES, async () => {
      const res = await api()
        .get("/api/artesanias?estado=DISPONIBLE&busqueda=volumen%205")
        .set(...auth(sesion));
      expect(res.status).toBe(200);
    });
    const mFiltro = registrar(
      "RNF_007",
      `Consulta filtrada del inventario con ${total} piezas`,
      tiemposFiltro,
      { umbral: 3000 },
    );

    // Conteo agregado del panel
    const tiemposConteo = await medirMs(REPETICIONES, async () => {
      await prisma.artesania.count({ where: { eliminado: false, estado: "DISPONIBLE" } });
    });
    const mConteo = registrar(
      "RNF_007",
      `Conteo de piezas disponibles con ${total} piezas`,
      tiemposConteo,
      { umbral: 3000 },
    );

    expect(mFiltro.promedio).toBeLessThan(3000);
    expect(mConteo.promedio).toBeLessThan(3000);
  }, 180_000);
});
