import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { limpiarBaseDatos } from "../helpers/db.js";
import { api, auth, crearArtesanoAutenticado, type ArtesanoPrueba } from "../helpers/api.js";

let sesion: ArtesanoPrueba;

beforeEach(async () => {
  await limpiarBaseDatos();
  sesion = await crearArtesanoAutenticado();
});

async function crearProveedor(nombre = "Alfarería Doña Rosa") {
  const res = await api()
    .post("/api/proveedores")
    .set(...auth(sesion))
    .send({ nombre, telefono: "9511111111", ciudad: "Oaxaca de Juárez" });
  return res.body as { idProveedor: string; nombre: string };
}

async function crearMateria(nombre = "Barro crudo") {
  const res = await api()
    .post("/api/materias-primas")
    .set(...auth(sesion))
    .send({ nombre, unidadMedida: "KG" });
  return res.body as { idMateria: string };
}

describe("HU-05 · Gestión de proveedores y registro de compras", () => {
  it("caso de éxito: alta de proveedor solo con nombre (contacto y domicilio opcionales)", async () => {
    const res = await api()
      .post("/api/proveedores")
      .set(...auth(sesion))
      .send({ nombre: "Alfarería Doña Rosa" });

    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe("Alfarería Doña Rosa");
    // CA: los datos de contacto y domicilio son opcionales
    expect(res.body.telefono).toBeNull();
    expect(res.body.calle).toBeNull();
  });

  it("caso de fallo: alta de proveedor sin nombre devuelve 400", async () => {
    const res = await api()
      .post("/api/proveedores")
      .set(...auth(sesion))
      .send({ telefono: "9511111111" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/"nombre" es obligatorio/i);
  });

  it("caso de éxito: registra una compra con detalle y la devuelve en el listado", async () => {
    const proveedor = await crearProveedor();
    const materia = await crearMateria();

    const res = await api()
      .post("/api/compras")
      .set(...auth(sesion))
      .send({
        idProveedor: proveedor.idProveedor,
        folioNota: "A-1024",
        fecha: "2026-03-10",
        detalles: [{ idMateria: materia.idMateria, cantidad: 25, costoUnitario: 18.5 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.detalles).toHaveLength(1);
    expect(Number(res.body.detalles[0].costoUnitario)).toBe(18.5);
    expect(res.body.proveedor.nombre).toBe("Alfarería Doña Rosa");

    const listado = await api()
      .get("/api/compras")
      .set(...auth(sesion));
    expect(listado.body).toHaveLength(1);
  });

  it("CA: el costo unitario debe ser mayor a cero (400)", async () => {
    const proveedor = await crearProveedor();
    const materia = await crearMateria();

    const res = await api()
      .post("/api/compras")
      .set(...auth(sesion))
      .send({
        idProveedor: proveedor.idProveedor,
        detalles: [{ idMateria: materia.idMateria, cantidad: 10, costoUnitario: 0 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mayor a cero/i);
  });

  it("CA: la cantidad debe ser mayor a cero (400) — también con valor negativo", async () => {
    const proveedor = await crearProveedor();
    const materia = await crearMateria();

    for (const cantidad of [0, -5]) {
      const res = await api()
        .post("/api/compras")
        .set(...auth(sesion))
        .send({
          idProveedor: proveedor.idProveedor,
          detalles: [{ idMateria: materia.idMateria, cantidad, costoUnitario: 12 }],
        });
      expect(res.status, `cantidad=${cantidad}`).toBe(400);
    }
  });

  it("CA: bloquea la eliminación de un proveedor con compras asociadas, con mensaje explicativo", async () => {
    const proveedor = await crearProveedor();
    const materia = await crearMateria();
    await api()
      .post("/api/compras")
      .set(...auth(sesion))
      .send({
        idProveedor: proveedor.idProveedor,
        detalles: [{ idMateria: materia.idMateria, cantidad: 5, costoUnitario: 20 }],
      });

    const res = await api()
      .delete(`/api/proveedores/${proveedor.idProveedor}`)
      .set(...auth(sesion));

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/compras registradas asociadas/i);
  });

  it("caso de éxito: un proveedor sin compras sí puede eliminarse (204)", async () => {
    const proveedor = await crearProveedor("Proveedor temporal");

    const res = await api()
      .delete(`/api/proveedores/${proveedor.idProveedor}`)
      .set(...auth(sesion));
    expect(res.status).toBe(204);
  });

  it("CA: una compra puede corregirse sin perder el costo histórico ya usado en costeo", async () => {
    const proveedor = await crearProveedor();
    const materia = await crearMateria();
    const compra = await api()
      .post("/api/compras")
      .set(...auth(sesion))
      .send({
        idProveedor: proveedor.idProveedor,
        detalles: [{ idMateria: materia.idMateria, cantidad: 10, costoUnitario: 100 }],
      });

    // La pieza consume la materia al costo vigente (100)
    const tecnica = await prisma.tecnicaArtesanal.create({ data: { nombre: "Barro negro" } });
    const categoria = await prisma.categoriaPieza.create({ data: { nombre: "Jarrón" } });
    const pieza = await prisma.artesania.create({
      data: {
        nombre: "Jarrón ceremonial",
        idArtesano: sesion.idArtesano,
        idTecnica: tecnica.idTecnica,
        idCategoria: categoria.idCategoria,
      },
    });
    await api()
      .put(`/api/artesanias/${pieza.idArtesania}/insumos`)
      .set(...auth(sesion))
      .send({ insumos: [{ idMateria: materia.idMateria, cantidadUsada: 2 }] });

    // Se corrige la compra: el costo unitario pasa de 100 a 130
    const correccion = await api()
      .put(`/api/compras/${compra.body.idCompra}`)
      .set(...auth(sesion))
      .send({
        idProveedor: proveedor.idProveedor,
        detalles: [{ idMateria: materia.idMateria, cantidad: 10, costoUnitario: 130 }],
      });
    expect(correccion.status).toBe(200);
    expect(Number(correccion.body.detalles[0].costoUnitario)).toBe(130);

    // CA: el costeo ya calculado conserva el valor histórico (100), no el corregido
    const insumos = await api()
      .get(`/api/artesanias/${pieza.idArtesania}/insumos`)
      .set(...auth(sesion));
    expect(Number(insumos.body[0].costoUnitarioUso)).toBe(100);
  });

  it("CA: la baja de una compra es lógica, exige motivo y la excluye de los listados", async () => {
    const proveedor = await crearProveedor();
    const materia = await crearMateria();
    const compra = await api()
      .post("/api/compras")
      .set(...auth(sesion))
      .send({
        idProveedor: proveedor.idProveedor,
        detalles: [{ idMateria: materia.idMateria, cantidad: 10, costoUnitario: 50 }],
      });

    // Sin motivo debe fallar
    const sinMotivo = await api()
      .delete(`/api/compras/${compra.body.idCompra}`)
      .set(...auth(sesion))
      .send({});
    expect(sinMotivo.status).toBe(400);
    expect(sinMotivo.body.error).toMatch(/"motivo" es obligatorio/i);

    // Con motivo, baja lógica
    const conMotivo = await api()
      .delete(`/api/compras/${compra.body.idCompra}`)
      .set(...auth(sesion))
      .send({ motivo: "Nota capturada por duplicado" });
    expect(conMotivo.status).toBe(204);

    // El registro se conserva en base de datos con su motivo
    const persistida = await prisma.compra.findUniqueOrThrow({
      where: { idCompra: compra.body.idCompra },
    });
    expect(persistida.eliminado).toBe(true);
    expect(persistida.motivoEliminacion).toBe("Nota capturada por duplicado");

    // Y queda excluido de listados
    const listado = await api()
      .get("/api/compras")
      .set(...auth(sesion));
    expect(listado.body).toHaveLength(0);
  });

  it("RF_008: el historial de precios por proveedor se conserva y excluye compras dadas de baja", async () => {
    const proveedorA = await crearProveedor("Alfarería Doña Rosa");
    const proveedorB = await crearProveedor("Barros de Atzompa");
    const materia = await crearMateria();

    await api()
      .post("/api/compras")
      .set(...auth(sesion))
      .send({
        idProveedor: proveedorA.idProveedor,
        fecha: "2026-01-15",
        detalles: [{ idMateria: materia.idMateria, cantidad: 10, costoUnitario: 15 }],
      });
    const segunda = await api()
      .post("/api/compras")
      .set(...auth(sesion))
      .send({
        idProveedor: proveedorB.idProveedor,
        fecha: "2026-03-20",
        detalles: [{ idMateria: materia.idMateria, cantidad: 10, costoUnitario: 22 }],
      });

    const historial = await api()
      .get(`/api/materias-primas/${materia.idMateria}/historial-precios`)
      .set(...auth(sesion));

    expect(historial.status).toBe(200);
    expect(historial.body).toHaveLength(2);
    // Ordenado por fecha descendente: la compra más reciente primero
    expect(Number(historial.body[0].costoUnitario)).toBe(22);
    expect(historial.body[0].proveedor.nombre).toBe("Barros de Atzompa");

    await api()
      .delete(`/api/compras/${segunda.body.idCompra}`)
      .set(...auth(sesion))
      .send({ motivo: "Cancelada por el proveedor" });

    const tras = await api()
      .get(`/api/materias-primas/${materia.idMateria}/historial-precios`)
      .set(...auth(sesion));
    expect(tras.body).toHaveLength(1);
    expect(Number(tras.body[0].costoUnitario)).toBe(15);
  });

  it("caso de fallo: una compra sin detalles devuelve 400", async () => {
    const proveedor = await crearProveedor();

    const res = await api()
      .post("/api/compras")
      .set(...auth(sesion))
      .send({ idProveedor: proveedor.idProveedor, detalles: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/al menos un detalle/i);
  });

  it("caso de fallo: bloquea eliminar una materia prima con compras asociadas", async () => {
    const proveedor = await crearProveedor();
    const materia = await crearMateria();
    await api()
      .post("/api/compras")
      .set(...auth(sesion))
      .send({
        idProveedor: proveedor.idProveedor,
        detalles: [{ idMateria: materia.idMateria, cantidad: 3, costoUnitario: 40 }],
      });

    const res = await api()
      .delete(`/api/materias-primas/${materia.idMateria}`)
      .set(...auth(sesion));
    expect(res.status).toBe(409);
  });
});
