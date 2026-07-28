import bcrypt from "bcryptjs";
import request from "supertest";
import { crearServidor } from "../../src/server.js";
import { prisma } from "../../src/lib/prisma.js";

export const app = crearServidor();
export const api = () => request(app);

export const CORREO_PRUEBA = "artesano@artani.mx";
export const CONTRASENA_PRUEBA = "Artani#2026";

export interface ArtesanoPrueba {
  idArtesano: string;
  correo: string;
  token: string;
}

/**
 * Crea el artesano de pruebas con la contraseña hasheada por bcrypt (RNF_005)
 * e inicia sesión para obtener el token JWT que autoriza el resto de rutas.
 */
export async function crearArtesanoAutenticado(
  correo: string = CORREO_PRUEBA,
  contrasena: string = CONTRASENA_PRUEBA,
): Promise<ArtesanoPrueba> {
  const artesano = await prisma.artesano.create({
    data: {
      curp: `AAHF80010${Math.floor(Math.random() * 9)}HOCRRL09`,
      nombres: "Fernando",
      apellidoPaterno: "Artesano",
      apellidoMaterno: "Hule",
      correo,
      contrasenaHash: await bcrypt.hash(contrasena, 12),
      telefono: "9510000000",
      nombreTaller: "Taller El Árbol del Hule",
    },
  });

  const respuesta = await api().post("/api/auth/login").send({ correo, contrasena });
  return {
    idArtesano: artesano.idArtesano,
    correo,
    token: respuesta.body.token as string,
  };
}

/** Encabezado Authorization con el token del artesano autenticado. */
export function auth(sesion: ArtesanoPrueba): [string, string] {
  return ["Authorization", `Bearer ${sesion.token}`];
}

/** Crea técnica y categoría, mínimos indispensables para registrar una pieza. */
export async function crearCatalogosBase(sufijo = "") {
  const tecnica = await prisma.tecnicaArtesanal.create({
    data: { nombre: `Barro negro${sufijo}`, descripcion: "Alfarería de San Bartolo" },
  });
  const categoria = await prisma.categoriaPieza.create({
    data: { nombre: `Jarrón${sufijo}` },
  });
  return { tecnica, categoria };
}
