import bcrypt from "bcryptjs";
import { prisma } from "./prisma.js";

/**
 * Alta de la cuenta del artesano.
 *
 * Es el único camino admitido para crear una cuenta: recibe la contraseña en
 * claro, la hashea con bcrypt y persiste solo el hash. No existe ninguna vía
 * para inyectar un hash ya calculado ni para guardar la contraseña tal cual.
 */

/** Coste de bcrypt; el mismo que emplea el inicio de sesión. */
export const COSTE_BCRYPT = 12;

/** Longitud mínima exigida a la contraseña inicial. */
export const MIN_LONGITUD_CONTRASENA = 12;

export interface DatosAltaArtesano {
  curp: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  correo: string;
  telefono?: string | null;
  nombreTaller?: string | null;
  /** Contraseña en claro; nunca se almacena ni se registra en bitácora. */
  contrasena: string;
}

export class ErrorAlta extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorAlta";
  }
}

const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function obligatorio(valor: string | undefined | null, campo: string): string {
  const limpio = (valor ?? "").trim();
  if (!limpio) {
    throw new ErrorAlta(`El campo "${campo}" es obligatorio`);
  }
  return limpio;
}

/** Comprueba que la contraseña no sea trivialmente adivinable. */
export function validarContrasena(contrasena: string): void {
  if (contrasena.length < MIN_LONGITUD_CONTRASENA) {
    throw new ErrorAlta(
      `La contraseña debe tener al menos ${MIN_LONGITUD_CONTRASENA} caracteres`,
    );
  }
  if (!/[a-záéíóúñ]/i.test(contrasena) || !/\d/.test(contrasena)) {
    throw new ErrorAlta("La contraseña debe combinar al menos letras y números");
  }
  if (/^(.)\1+$/.test(contrasena)) {
    throw new ErrorAlta("La contraseña no puede ser un mismo carácter repetido");
  }
}

export interface ArtesanoCreado {
  idArtesano: string;
  correo: string;
  nombreCompleto: string;
}

/**
 * Valida los datos, hashea la contraseña y da de alta al artesano.
 * Devuelve únicamente datos no sensibles: el hash no sale de esta función.
 */
export async function crearArtesano(datos: DatosAltaArtesano): Promise<ArtesanoCreado> {
  const curp = obligatorio(datos.curp, "curp").toUpperCase();
  if (!CURP_RE.test(curp)) {
    throw new ErrorAlta("La CURP no tiene un formato válido (18 caracteres)");
  }

  const correo = obligatorio(datos.correo, "correo").toLowerCase();
  if (!CORREO_RE.test(correo)) {
    throw new ErrorAlta("El correo electrónico no tiene un formato válido");
  }

  const nombres = obligatorio(datos.nombres, "nombres");
  const apellidoPaterno = obligatorio(datos.apellidoPaterno, "apellidoPaterno");

  // La contraseña se valida ANTES de tocar la base de datos
  validarContrasena(obligatorio(datos.contrasena, "contrasena"));

  const yaExiste = await prisma.artesano.findFirst({
    where: { OR: [{ correo }, { curp }] },
    select: { correo: true, curp: true },
  });
  if (yaExiste) {
    const campo = yaExiste.correo === correo ? "correo" : "CURP";
    throw new ErrorAlta(`Ya existe un artesano registrado con ese ${campo}`);
  }

  const contrasenaHash = await bcrypt.hash(datos.contrasena, COSTE_BCRYPT);

  const artesano = await prisma.artesano.create({
    data: {
      curp,
      nombres,
      apellidoPaterno,
      apellidoMaterno: datos.apellidoMaterno?.trim() || null,
      correo,
      contrasenaHash,
      telefono: datos.telefono?.trim() || null,
      nombreTaller: datos.nombreTaller?.trim() || null,
    },
    select: { idArtesano: true, correo: true, nombres: true, apellidoPaterno: true },
  });

  return {
    idArtesano: artesano.idArtesano,
    correo: artesano.correo,
    nombreCompleto: `${artesano.nombres} ${artesano.apellidoPaterno}`,
  };
}
