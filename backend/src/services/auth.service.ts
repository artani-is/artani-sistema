import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middlewares/error.js";

const MAX_INTENTOS_FALLIDOS = 5;
const VENTANA_BLOQUEO_MS = 15 * 60 * 1000;

export interface SesionArtesano {
  token: string;
  artesano: {
    idArtesano: string;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string | null;
    correo: string;
    nombreTaller: string | null;
  };
}

async function verificarBloqueo(idArtesano: string): Promise<void> {
  const desde = new Date(Date.now() - VENTANA_BLOQUEO_MS);
  const recientes = await prisma.intentoAcceso.findMany({
    where: { idArtesano, fechaHora: { gte: desde } },
    orderBy: { fechaHora: "desc" },
    take: MAX_INTENTOS_FALLIDOS,
    select: { exitoso: true },
  });

  const bloqueada =
    recientes.length === MAX_INTENTOS_FALLIDOS &&
    recientes.every((intento) => !intento.exitoso);

  if (bloqueada) {
    throw new ApiError(
      423,
      "Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en 15 minutos",
    );
  }
}

export async function login(correo: string, contrasena: string): Promise<SesionArtesano> {
  const artesano = await prisma.artesano.findUnique({ where: { correo } });

  // Mensaje genérico: no revelar si falló el correo o la contraseña (HU-01)
  const credencialesInvalidas = new ApiError(401, "Correo o contraseña incorrectos");

  if (!artesano) {
    throw credencialesInvalidas;
  }

  await verificarBloqueo(artesano.idArtesano);

  const coincide = await bcrypt.compare(contrasena, artesano.contrasenaHash);
  await prisma.intentoAcceso.create({
    data: { idArtesano: artesano.idArtesano, exitoso: coincide },
  });

  if (!coincide) {
    throw credencialesInvalidas;
  }

  const token = jwt.sign(
    { correo: artesano.correo },
    process.env.JWT_SECRET as string,
    {
      subject: artesano.idArtesano,
      expiresIn: (process.env.JWT_EXPIRES_IN ?? "8h") as jwt.SignOptions["expiresIn"],
    },
  );

  return {
    token,
    artesano: {
      idArtesano: artesano.idArtesano,
      nombres: artesano.nombres,
      apellidoPaterno: artesano.apellidoPaterno,
      apellidoMaterno: artesano.apellidoMaterno,
      correo: artesano.correo,
      nombreTaller: artesano.nombreTaller,
    },
  };
}

/**
 * Actualiza los datos de contacto del taller (HU-17). El correo (usuario de
 * acceso) no es editable desde esta pantalla.
 */
export async function actualizarPerfil(
  idArtesano: string,
  datos: {
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string | null;
    telefono: string | null;
    nombreTaller: string | null;
  },
) {
  await prisma.artesano.update({ where: { idArtesano }, data: datos });
  return perfil(idArtesano);
}

export async function perfil(idArtesano: string) {
  const artesano = await prisma.artesano.findUnique({
    where: { idArtesano },
    select: {
      idArtesano: true,
      curp: true,
      nombres: true,
      apellidoPaterno: true,
      apellidoMaterno: true,
      correo: true,
      telefono: true,
      nombreTaller: true,
    },
  });
  if (!artesano) {
    throw new ApiError(404, "El artesano no existe");
  }
  return artesano;
}
