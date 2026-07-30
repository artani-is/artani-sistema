import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { limpiarBaseDatos } from "../helpers/db.js";
import {
  api,
  auth,
  crearArtesanoAutenticado,
  crearCatalogosBase,
  CORREO_PRUEBA,
  CONTRASENA_PRUEBA,
  type ArtesanoPrueba,
} from "../helpers/api.js";
import { textoDelPdf } from "../helpers/pdf.js";
import { UPLOADS_DIR } from "../../src/lib/uploads.js";

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

/**
 * Registra una venta en la fecha indicada y devuelve el monto cobrado.
 * `precioLista` asigna el precio de venta final de la pieza (HU-09), que puede
 * diferir de lo efectivamente cobrado en la transacción.
 */
async function venderPieza(
  nombre: string,
  monto: number,
  fechaVenta: string,
  porGaleria = false,
  precioLista?: number,
) {
  const pieza = await api()
    .post("/api/artesanias")
    .set(...auth(sesion))
    .send({ nombre, idTecnica, idCategoria });

  if (precioLista !== undefined) {
    await api()
      .put(`/api/artesanias/${pieza.body.idArtesania}/precio`)
      .set(...auth(sesion))
      .send({ precioVenta: precioLista });
  }
  if (porGaleria) {
    await api()
      .post(`/api/artesanias/${pieza.body.idArtesania}/consignacion`)
      .set(...auth(sesion))
      .send({ idGaleria });
  }
  await api()
    .post(`/api/artesanias/${pieza.body.idArtesania}/venta`)
    .set(...auth(sesion))
    .send({ montoCobrado: monto, fechaVenta });
  return monto;
}

// ---------------------------------------------------------------------------
// HU-16 · Generación de reporte de ventas
// ---------------------------------------------------------------------------
describe("HU-16 · Generación de reporte de ventas", () => {
  it("CA (caso de éxito): calcula la suma total de las ventas del rango de fechas", async () => {
    await venderPieza("Pieza A", 1500, "2026-03-05");
    await venderPieza("Pieza B", 2300, "2026-03-18");
    await venderPieza("Pieza C", 900, "2026-05-02"); // fuera del rango

    const res = await api()
      .post("/api/reportes")
      .set(...auth(sesion))
      .send({ fechaInicio: "2026-03-01", fechaFin: "2026-03-31" });

    expect(res.status).toBe(201);
    expect(res.body.totalVentas).toBe(3800);
    expect(res.body.totalPiezas).toBe(2);
  });

  it("CA (caso de éxito): el reporte se exporta en formato PDF", async () => {
    await venderPieza("Pieza A", 1500, "2026-03-05");

    const res = await api()
      .post("/api/reportes")
      .set(...auth(sesion))
      .send({ fechaInicio: "2026-03-01", fechaFin: "2026-03-31" });

    expect(res.body.rutaExportacion).toMatch(/\.pdf$/);
    const archivo = path.join(UPLOADS_DIR, path.relative("/uploads", res.body.rutaExportacion));
    expect(existsSync(archivo)).toBe(true);

    const pdf = readFileSync(archivo);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    // El PDF refleja la pieza y el total del periodo
    const texto = textoDelPdf(pdf);
    expect(texto).toContain("Pieza A");
  });

  it("CA HU-09: el PDF muestra el precio de lista junto al monto cobrado", async () => {
    // Precio final de la pieza 1 500; se cobró 1 200 (descuento en la transacción)
    await venderPieza("Vasija de barro", 1200, "2026-03-05", false, 1500);

    const res = await api()
      .post("/api/reportes")
      .set(...auth(sesion))
      .send({ fechaInicio: "2026-03-01", fechaFin: "2026-03-31" });

    const pdf = readFileSync(
      path.join(UPLOADS_DIR, path.relative("/uploads", res.body.rutaExportacion)),
    );
    const texto = textoDelPdf(pdf);

    expect(texto).toContain("PRECIO LISTA");
    expect(texto).toContain("COBRADO");
    // Ambos importes conviven en el renglón de la venta
    expect(texto).toContain("$1,500.00");
    expect(texto).toContain("$1,200.00");

    // Los totales de la HU-16 siguen derivándose del monto cobrado, no del de lista
    expect(res.body.totalVentas).toBe(1200);
    expect(res.body.totalPiezas).toBe(1);
  });

  it("una pieza vendida sin precio final asignado no inventa un precio de lista", async () => {
    await venderPieza("Sin precio final", 800, "2026-03-07");

    const res = await api()
      .post("/api/reportes")
      .set(...auth(sesion))
      .send({ fechaInicio: "2026-03-01", fechaFin: "2026-03-31" });

    const pdf = readFileSync(
      path.join(UPLOADS_DIR, path.relative("/uploads", res.body.rutaExportacion)),
    );
    const texto = textoDelPdf(pdf);

    expect(texto).toContain("Sin precio final");
    expect(texto).toContain("$800.00");
    // El precio de lista ausente se declara como tal en lugar de inventar un importe
    expect(texto).toContain("Sin asignar");
    expect(res.body.totalVentas).toBe(800);
  });

  it("CA HU-09: el listado de ventas expone el precio final de cada pieza", async () => {
    await venderPieza("Olla ceremonial", 950, "2026-03-09", false, 1100);

    const res = await api()
      .get("/api/ventas?inicio=2026-03-01&fin=2026-03-31")
      .set(...auth(sesion));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(Number(res.body[0].artesania.precioVenta)).toBe(1100);
    expect(Number(res.body[0].montoCobrado)).toBe(950);
  });

  it("CA (caso de fallo): sin ventas en el rango, el sistema lo indica explícitamente", async () => {
    await venderPieza("Pieza A", 1500, "2026-03-05");

    const res = await api()
      .post("/api/reportes")
      .set(...auth(sesion))
      .send({ fechaInicio: "2026-07-01", fechaFin: "2026-07-31" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no hay ventas registradas en el periodo/i);
    // No se genera un reporte vacío
    expect(await prisma.reporteVentas.count()).toBe(0);
  });

  it("caso de fallo: un periodo invertido (fin anterior a inicio) se rechaza", async () => {
    const res = await api()
      .post("/api/reportes")
      .set(...auth(sesion))
      .send({ fechaInicio: "2026-03-31", fechaFin: "2026-03-01" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/posterior o igual a la inicial/i);
  });

  it("caso de fallo: fechas con formato inválido se rechazan (400)", async () => {
    const res = await api()
      .post("/api/reportes")
      .set(...auth(sesion))
      .send({ fechaInicio: "no-es-fecha", fechaFin: "tampoco" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no son válidas/i);
  });

  it("caso de éxito: distingue ventas directas de ventas por consignación", async () => {
    await venderPieza("Directa", 1000, "2026-03-05", false);
    await venderPieza("Por galería", 2000, "2026-03-06", true);

    const directas = await api()
      .get("/api/ventas?canal=DIRECTA")
      .set(...auth(sesion));
    const consignacion = await api()
      .get("/api/ventas?canal=CONSIGNACION")
      .set(...auth(sesion));

    expect(directas.body).toHaveLength(1);
    expect(directas.body[0].canal).toBe("DIRECTA");
    expect(consignacion.body).toHaveLength(1);
    expect(consignacion.body[0].consignacion.galeria.nombre).toBe("Galería Quetzalli");
  });

  it("caso de éxito: la bitácora de reportes conserva los totales del periodo", async () => {
    await venderPieza("Pieza A", 1500, "2026-03-05");
    await venderPieza("Pieza B", 500, "2026-03-08");
    await api()
      .post("/api/reportes")
      .set(...auth(sesion))
      .send({ fechaInicio: "2026-03-01", fechaFin: "2026-03-31" });

    const res = await api()
      .get("/api/reportes")
      .set(...auth(sesion));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].totalVentas).toBe(2000);
    expect(res.body[0].totalPiezas).toBe(2);
  });

  it("caso de fallo: el reporte exige autenticación (401)", async () => {
    const res = await api()
      .post("/api/reportes")
      .send({ fechaInicio: "2026-03-01", fechaFin: "2026-03-31" });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// HU-17 · Actualización de perfil y datos del taller
// ---------------------------------------------------------------------------
describe("HU-17 · Actualización de perfil y datos del taller", () => {
  it("CA (caso de éxito): actualiza nombre del taller, teléfono y nombre de contacto", async () => {
    const res = await api()
      .put("/api/auth/perfil")
      .set(...auth(sesion))
      .send({
        nombres: "Fernando",
        apellidoPaterno: "González",
        apellidoMaterno: "Miguel",
        telefono: "9515553344",
        nombreTaller: "Taller Artani del Valle",
      });

    expect(res.status).toBe(200);
    expect(res.body.nombreTaller).toBe("Taller Artani del Valle");
    expect(res.body.telefono).toBe("9515553344");
    expect(res.body.apellidoPaterno).toBe("González");
  });

  it("CA: el correo de acceso NO es editable desde esta pantalla", async () => {
    const res = await api()
      .put("/api/auth/perfil")
      .set(...auth(sesion))
      .send({
        nombres: "Fernando",
        apellidoPaterno: "González",
        correo: "otro@artani.mx",
        nombreTaller: "Taller nuevo",
      });

    expect(res.status).toBe(200);
    // El correo enviado se ignora: sigue siendo el de la sesión
    expect(res.body.correo).toBe(CORREO_PRUEBA);

    const enBd = await prisma.artesano.findUniqueOrThrow({
      where: { idArtesano: sesion.idArtesano },
    });
    expect(enBd.correo).toBe(CORREO_PRUEBA);
  });

  it("CA: los cambios se reflejan de inmediato sin cerrar sesión (mismo token)", async () => {
    await api()
      .put("/api/auth/perfil")
      .set(...auth(sesion))
      .send({
        nombres: "Fernando",
        apellidoPaterno: "González",
        nombreTaller: "Taller Artani del Valle",
      });

    // El MISMO token sigue siendo válido y devuelve los datos actualizados
    const perfil = await api()
      .get("/api/auth/me")
      .set(...auth(sesion));

    expect(perfil.status).toBe(200);
    expect(perfil.body.nombreTaller).toBe("Taller Artani del Valle");
  });

  it("CA: el correo de acceso sigue funcionando para iniciar sesión tras el cambio", async () => {
    await api()
      .put("/api/auth/perfil")
      .set(...auth(sesion))
      .send({ nombres: "Fernando", apellidoPaterno: "González", nombreTaller: "Otro taller" });

    const login = await api()
      .post("/api/auth/login")
      .send({ correo: CORREO_PRUEBA, contrasena: CONTRASENA_PRUEBA });

    expect(login.status).toBe(200);
    expect(login.body.artesano.nombreTaller).toBe("Otro taller");
  });

  it("caso de fallo: el nombre y el apellido paterno son obligatorios (400)", async () => {
    const res = await api()
      .put("/api/auth/perfil")
      .set(...auth(sesion))
      .send({ nombres: "", apellidoPaterno: "", nombreTaller: "Taller" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/obligatorio/i);
  });

  it("caso de fallo: actualizar el perfil sin autenticación devuelve 401", async () => {
    const res = await api().put("/api/auth/perfil").send({ nombres: "X", apellidoPaterno: "Y" });
    expect(res.status).toBe(401);
  });

  it("CA: los datos actualizados del taller se propagan al certificado emitido después", async () => {
    await api()
      .put("/api/auth/perfil")
      .set(...auth(sesion))
      .send({
        nombres: "Fernando",
        apellidoPaterno: "González",
        nombreTaller: "Taller Artani del Valle",
      });

    const pieza = await api()
      .post("/api/artesanias")
      .set(...auth(sesion))
      .send({ nombre: "Jarrón", idTecnica, idCategoria });
    const { PNG_1X1 } = await import("../helpers/imagenes.js");
    await api()
      .post(`/api/artesanias/${pieza.body.idArtesania}/fotos`)
      .set(...auth(sesion))
      .attach("fotos", PNG_1X1, { filename: "p.png", contentType: "image/png" });
    await api()
      .put(`/api/artesanias/${pieza.body.idArtesania}/precio`)
      .set(...auth(sesion))
      .send({ precioVenta: 1200 });

    const cert = await api()
      .post(`/api/artesanias/${pieza.body.idArtesania}/certificado`)
      .set(...auth(sesion));

    const pdf = readFileSync(
      path.join(UPLOADS_DIR, "certificados", `${cert.body.idCertificado}.pdf`),
    );
    expect(textoDelPdf(pdf)).toContain("Taller Artani del Valle");
  });
});
