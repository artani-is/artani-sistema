import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { limpiarBaseDatos } from "../helpers/db.js";
import { api, auth, crearArtesanoAutenticado, type ArtesanoPrueba } from "../helpers/api.js";

let sesion: ArtesanoPrueba;

beforeEach(async () => {
  await limpiarBaseDatos();
  sesion = await crearArtesanoAutenticado();
});

// ---------------------------------------------------------------------------
// HU-02 · Agregar nuevos elementos a catálogos maestros
// ---------------------------------------------------------------------------
describe("HU-02 · Alta en catálogos maestros", () => {
  it("caso de éxito: crea técnica, categoría y galería y las devuelve en el listado", async () => {
    const tecnica = await api()
      .post("/api/catalogos/tecnicas")
      .set(...auth(sesion))
      .send({ nombre: "Barro negro", descripcion: "Alfarería de San Bartolo Coyotepec" });
    const categoria = await api()
      .post("/api/catalogos/categorias")
      .set(...auth(sesion))
      .send({ nombre: "Jarrón" });
    const galeria = await api()
      .post("/api/catalogos/galerias")
      .set(...auth(sesion))
      .send({ nombre: "Galería Quetzalli", ciudad: "Oaxaca de Juárez" });

    expect(tecnica.status).toBe(201);
    expect(categoria.status).toBe(201);
    expect(galeria.status).toBe(201);
    expect(tecnica.body.nombre).toBe("Barro negro");

    const listado = await api()
      .get("/api/catalogos/tecnicas")
      .set(...auth(sesion));
    expect(listado.status).toBe(200);
    expect(listado.body.map((t: { nombre: string }) => t.nombre)).toContain("Barro negro");
  });

  it("caso de fallo: nombre vacío u omitido devuelve 400 en los tres catálogos", async () => {
    for (const recurso of ["tecnicas", "categorias", "galerias"]) {
      const res = await api()
        .post(`/api/catalogos/${recurso}`)
        .set(...auth(sesion))
        .send({ nombre: "   " });
      expect(res.status, `catálogo ${recurso}`).toBe(400);
      expect(res.body.error).toMatch(/obligatorio/i);
    }
  });

  it("CA: no se permite guardar una TÉCNICA con nombre duplicado (409)", async () => {
    await api()
      .post("/api/catalogos/tecnicas")
      .set(...auth(sesion))
      .send({ nombre: "Barro negro" });

    const duplicado = await api()
      .post("/api/catalogos/tecnicas")
      .set(...auth(sesion))
      .send({ nombre: "Barro negro" });

    expect(duplicado.status).toBe(409);
  });

  it("CA: no se permite guardar una CATEGORÍA con nombre duplicado (409)", async () => {
    await api()
      .post("/api/catalogos/categorias")
      .set(...auth(sesion))
      .send({ nombre: "Jarrón" });

    const duplicado = await api()
      .post("/api/catalogos/categorias")
      .set(...auth(sesion))
      .send({ nombre: "Jarrón" });

    expect(duplicado.status).toBe(409);
  });

  it("CA: no se permite guardar una GALERÍA con nombre duplicado (409)", async () => {
    await api()
      .post("/api/catalogos/galerias")
      .set(...auth(sesion))
      .send({ nombre: "Galería Quetzalli" });

    const duplicado = await api()
      .post("/api/catalogos/galerias")
      .set(...auth(sesion))
      .send({ nombre: "Galería Quetzalli" });

    // La unicidad la impone la restricción de base de datos, igual que en
    // técnicas y categorías, no una comprobación de la aplicación.
    expect(duplicado.status).toBe(409);
  });

  it("caso de fallo: sin autenticación el catálogo no es accesible (401)", async () => {
    const res = await api().post("/api/catalogos/tecnicas").send({ nombre: "Telar de cintura" });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// HU-03 · Editar elementos de catálogos maestros
// ---------------------------------------------------------------------------
describe("HU-03 · Edición de catálogos maestros", () => {
  it("caso de éxito: la edición se refleja en el listado y en las piezas que la usan", async () => {
    const tecnica = await prisma.tecnicaArtesanal.create({ data: { nombre: "Barro neggro" } });
    const categoria = await prisma.categoriaPieza.create({ data: { nombre: "Jarrón" } });
    const pieza = await prisma.artesania.create({
      data: {
        nombre: "Jarrón ceremonial",
        idArtesano: sesion.idArtesano,
        idTecnica: tecnica.idTecnica,
        idCategoria: categoria.idCategoria,
      },
    });

    const res = await api()
      .put(`/api/catalogos/tecnicas/${tecnica.idTecnica}`)
      .set(...auth(sesion))
      .send({ nombre: "Barro negro" });

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Barro negro");

    // CA: la actualización se refleja donde el elemento está siendo utilizado
    const detalle = await api()
      .get(`/api/artesanias/${pieza.idArtesania}`)
      .set(...auth(sesion));
    expect(detalle.body.tecnica.nombre).toBe("Barro negro");
  });

  it("caso de fallo: editar una TÉCNICA hacia un nombre ya existente devuelve 409", async () => {
    await prisma.tecnicaArtesanal.create({ data: { nombre: "Barro negro" } });
    const otra = await prisma.tecnicaArtesanal.create({ data: { nombre: "Telar de cintura" } });

    const res = await api()
      .put(`/api/catalogos/tecnicas/${otra.idTecnica}`)
      .set(...auth(sesion))
      .send({ nombre: "Barro negro" });

    expect(res.status).toBe(409);
  });

  it("CA: editar una GALERÍA hacia un nombre ya existente debe devolver 409", async () => {
    await prisma.galeria.create({ data: { nombre: "Galería Quetzalli" } });
    const otra = await prisma.galeria.create({ data: { nombre: "Casa Oaxaca" } });

    const res = await api()
      .put(`/api/catalogos/galerias/${otra.idGaleria}`)
      .set(...auth(sesion))
      .send({ nombre: "Galería Quetzalli" });

    expect(res.status).toBe(409);
  });

  it("caso de fallo: editar un elemento inexistente devuelve 404", async () => {
    const res = await api()
      .put("/api/catalogos/tecnicas/00000000-0000-4000-8000-000000000000")
      .set(...auth(sesion))
      .send({ nombre: "Inexistente" });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// HU-04 · Eliminar elementos de catálogos maestros
// ---------------------------------------------------------------------------
describe("HU-04 · Eliminación de catálogos maestros", () => {
  it("caso de éxito: elimina un elemento sin vínculos (204) y desaparece del listado", async () => {
    const tecnica = await prisma.tecnicaArtesanal.create({ data: { nombre: "Hojalata" } });

    const res = await api()
      .delete(`/api/catalogos/tecnicas/${tecnica.idTecnica}`)
      .set(...auth(sesion));
    expect(res.status).toBe(204);

    const listado = await api()
      .get("/api/catalogos/tecnicas")
      .set(...auth(sesion));
    expect(listado.body).toHaveLength(0);
  });

  it("CA: bloquea la eliminación de una TÉCNICA vinculada a una artesanía, con mensaje explicativo", async () => {
    const tecnica = await prisma.tecnicaArtesanal.create({ data: { nombre: "Barro negro" } });
    const categoria = await prisma.categoriaPieza.create({ data: { nombre: "Jarrón" } });
    await prisma.artesania.create({
      data: {
        nombre: "Jarrón ceremonial",
        idArtesano: sesion.idArtesano,
        idTecnica: tecnica.idTecnica,
        idCategoria: categoria.idCategoria,
      },
    });

    const res = await api()
      .delete(`/api/catalogos/tecnicas/${tecnica.idTecnica}`)
      .set(...auth(sesion));

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no se puede eliminar/i);
    expect(res.body.error).toMatch(/vinculado a registros activos/i);
  });

  it("CA: bloquea la eliminación de una CATEGORÍA vinculada a una artesanía", async () => {
    const tecnica = await prisma.tecnicaArtesanal.create({ data: { nombre: "Barro negro" } });
    const categoria = await prisma.categoriaPieza.create({ data: { nombre: "Jarrón" } });
    await prisma.artesania.create({
      data: {
        nombre: "Jarrón ceremonial",
        idArtesano: sesion.idArtesano,
        idTecnica: tecnica.idTecnica,
        idCategoria: categoria.idCategoria,
      },
    });

    const res = await api()
      .delete(`/api/catalogos/categorias/${categoria.idCategoria}`)
      .set(...auth(sesion));

    expect(res.status).toBe(409);
  });

  it("CA: bloquea la eliminación de una GALERÍA vinculada a una consignación activa", async () => {
    const tecnica = await prisma.tecnicaArtesanal.create({ data: { nombre: "Barro negro" } });
    const categoria = await prisma.categoriaPieza.create({ data: { nombre: "Jarrón" } });
    const galeria = await prisma.galeria.create({ data: { nombre: "Galería Quetzalli" } });
    const pieza = await prisma.artesania.create({
      data: {
        nombre: "Jarrón ceremonial",
        idArtesano: sesion.idArtesano,
        idTecnica: tecnica.idTecnica,
        idCategoria: categoria.idCategoria,
      },
    });
    await prisma.consignacion.create({
      data: { idArtesania: pieza.idArtesania, idGaleria: galeria.idGaleria },
    });

    const res = await api()
      .delete(`/api/catalogos/galerias/${galeria.idGaleria}`)
      .set(...auth(sesion));

    expect(res.status).toBe(409);
    // CA: el criterio exige explicar por qué no se puede eliminar, no un error crudo
    expect(res.body.error).toMatch(/no se puede eliminar/i);
    expect(res.body.error).toMatch(/galería/i);

    // La galería sigue existiendo: la baja no se ejecutó a medias
    expect(await prisma.galeria.count({ where: { idGaleria: galeria.idGaleria } })).toBe(1);
  });

  it("caso de éxito: una GALERÍA sin consignaciones sí puede eliminarse (204)", async () => {
    const galeria = await prisma.galeria.create({ data: { nombre: "Casa Oaxaca" } });

    const res = await api()
      .delete(`/api/catalogos/galerias/${galeria.idGaleria}`)
      .set(...auth(sesion));

    expect(res.status).toBe(204);
    expect(await prisma.galeria.count({ where: { idGaleria: galeria.idGaleria } })).toBe(0);
  });

  it("el listado de galerías informa cuántas consignaciones tiene cada una", async () => {
    const tecnica = await prisma.tecnicaArtesanal.create({ data: { nombre: "Barro negro" } });
    const categoria = await prisma.categoriaPieza.create({ data: { nombre: "Jarrón" } });
    const usada = await prisma.galeria.create({ data: { nombre: "Galería Quetzalli" } });
    await prisma.galeria.create({ data: { nombre: "Casa Oaxaca" } });
    const pieza = await prisma.artesania.create({
      data: {
        nombre: "Jarrón ceremonial",
        idArtesano: sesion.idArtesano,
        idTecnica: tecnica.idTecnica,
        idCategoria: categoria.idCategoria,
      },
    });
    await prisma.consignacion.create({
      data: { idArtesania: pieza.idArtesania, idGaleria: usada.idGaleria },
    });

    const res = await api()
      .get("/api/catalogos/galerias")
      .set(...auth(sesion));

    // La interfaz necesita el conteo para deshabilitar la baja antes de intentarla
    const porNombre = Object.fromEntries(
      (res.body as { nombre: string; _count: { consignaciones: number } }[]).map((g) => [
        g.nombre,
        g._count.consignaciones,
      ]),
    );
    expect(porNombre["Galería Quetzalli"]).toBe(1);
    expect(porNombre["Casa Oaxaca"]).toBe(0);
  });
});
