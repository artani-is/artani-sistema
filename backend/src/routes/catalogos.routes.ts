import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { textoDe } from "../lib/validate.js";
import { crearCatalogoRouter } from "../controllers/catalogos.controller.js";

export const catalogosRouter = Router();

catalogosRouter.use(
  "/tipos-material",
  crearCatalogoRouter({
    etiqueta: "el tipo de material",
    listar: () =>
      prisma.tipoMaterial.findMany({
        orderBy: { nombre: "asc" },
        include: { _count: { select: { materiasPrimas: true } } },
      }),
    crear: (data) => prisma.tipoMaterial.create({ data: { nombre: data.nombre as string } }),
    actualizar: (id, data) =>
      prisma.tipoMaterial.update({
        where: { idTipoMaterial: id },
        data: { nombre: data.nombre as string },
      }),
    eliminar: async (id) => {
      await prisma.tipoMaterial.delete({ where: { idTipoMaterial: id } });
    },
    enUso: async (id) =>
      (await prisma.materiaPrima.count({ where: { idTipoMaterial: id } })) > 0,
    parseBody: (body) => ({ nombre: textoDe(body, "nombre", { obligatorio: true, max: 100 }) }),
  }),
);

catalogosRouter.use(
  "/tecnicas",
  crearCatalogoRouter({
    etiqueta: "la técnica artesanal",
    listar: () =>
      prisma.tecnicaArtesanal.findMany({
        orderBy: { nombre: "asc" },
        include: { _count: { select: { artesanias: true } } },
      }),
    crear: (data) =>
      prisma.tecnicaArtesanal.create({
        data: { nombre: data.nombre as string, descripcion: data.descripcion as string | null },
      }),
    actualizar: (id, data) =>
      prisma.tecnicaArtesanal.update({
        where: { idTecnica: id },
        data: { nombre: data.nombre as string, descripcion: data.descripcion as string | null },
      }),
    eliminar: async (id) => {
      await prisma.tecnicaArtesanal.delete({ where: { idTecnica: id } });
    },
    enUso: async (id) => (await prisma.artesania.count({ where: { idTecnica: id } })) > 0,
    parseBody: (body) => ({
      nombre: textoDe(body, "nombre", { obligatorio: true, max: 100 }),
      descripcion: textoDe(body, "descripcion", { max: 2000 }),
    }),
  }),
);

catalogosRouter.use(
  "/categorias",
  crearCatalogoRouter({
    etiqueta: "la categoría de pieza",
    listar: () =>
      prisma.categoriaPieza.findMany({
        orderBy: { nombre: "asc" },
        include: { _count: { select: { artesanias: true } } },
      }),
    crear: (data) => prisma.categoriaPieza.create({ data: { nombre: data.nombre as string } }),
    actualizar: (id, data) =>
      prisma.categoriaPieza.update({
        where: { idCategoria: id },
        data: { nombre: data.nombre as string },
      }),
    eliminar: async (id) => {
      await prisma.categoriaPieza.delete({ where: { idCategoria: id } });
    },
    enUso: async (id) => (await prisma.artesania.count({ where: { idCategoria: id } })) > 0,
    parseBody: (body) => ({ nombre: textoDe(body, "nombre", { obligatorio: true, max: 100 }) }),
  }),
);

function parseGaleria(body: Record<string, unknown>) {
  return {
    nombre: textoDe(body, "nombre", { obligatorio: true, max: 150 }) as string,
    nombreContacto: textoDe(body, "nombreContacto", { max: 100 }),
    telefono: textoDe(body, "telefono", { max: 20 }),
    correo: textoDe(body, "correo", { max: 254 }),
    calle: textoDe(body, "calle", { max: 100 }),
    numero: textoDe(body, "numero", { max: 10 }),
    colonia: textoDe(body, "colonia", { max: 100 }),
    codigoPostal: textoDe(body, "codigoPostal", { max: 10 }),
    ciudad: textoDe(body, "ciudad", { max: 100 }),
    estado: textoDe(body, "estado", { max: 100 }),
    pais: textoDe(body, "pais", { max: 60 }) ?? "Mexico",
  };
}

catalogosRouter.use(
  "/galerias",
  crearCatalogoRouter({
    etiqueta: "la galería",
    listar: () => prisma.galeria.findMany({ orderBy: { nombre: "asc" } }),
    crear: (data) => prisma.galeria.create({ data: parseGaleria(data) }),
    actualizar: (id, data) =>
      prisma.galeria.update({ where: { idGaleria: id }, data: parseGaleria(data) }),
    eliminar: async (id) => {
      await prisma.galeria.delete({ where: { idGaleria: id } });
    },
    // Las consignaciones llegan en el Sprint 5; hoy no hay vínculos que bloqueen la baja
    enUso: async () => false,
    parseBody: (body) => body,
  }),
);
