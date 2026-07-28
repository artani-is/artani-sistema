import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { enviarCorreo } from "../lib/correo.js";
import { ApiError } from "../middlewares/error.js";
import { COSTE_BCRYPT, validarContrasena, ErrorAlta } from "../lib/artesanos.js";

/**
 * Recuperación de contraseña por correo (HU-1).
 *
 * El token viaja en claro únicamente dentro del correo; en la base de datos se
 * guarda su hash SHA-256. Caduca a los 30 minutos y es de un solo uso.
 */

/** Vigencia del enlace de recuperación. */
export const VIGENCIA_MINUTOS = 30;

/** Solicitudes admitidas por cuenta dentro de una hora. */
export const MAX_SOLICITUDES_POR_HORA = 3;

const VENTANA_LIMITE_MS = 60 * 60 * 1000;

/** Hash con el que se almacena y se busca el token. */
export function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function basePublica(): string {
  return (process.env.PUBLIC_BASE_URL ?? "http://localhost:5173").replace(/\/$/, "");
}

export interface ResultadoSolicitud {
  /** Verdadero solo si se generó y envió un enlace. */
  enviado: boolean;
  /** Motivo por el que no se envió; para bitácora interna, no para el usuario. */
  motivo?: "correo-desconocido" | "limite-alcanzado";
}

/**
 * Genera el enlace de recuperación y lo envía al correo registrado.
 *
 * Devuelve siempre un resultado, nunca lanza por correo desconocido: quien
 * llama responde lo mismo exista o no la cuenta, para no revelar qué correos
 * están dados de alta (mismo criterio que el mensaje genérico del inicio de
 * sesión en la HU-1).
 */
export async function solicitarRecuperacion(correo: string): Promise<ResultadoSolicitud> {
  const artesano = await prisma.artesano.findUnique({
    where: { correo: correo.trim().toLowerCase() },
    select: { idArtesano: true, correo: true, nombres: true },
  });
  if (!artesano) {
    return { enviado: false, motivo: "correo-desconocido" };
  }

  // Límite por hora y por cuenta: evita convertir el buzón del artesano en
  // destino de un envío masivo.
  const recientes = await prisma.tokenRecuperacion.count({
    where: {
      idArtesano: artesano.idArtesano,
      fechaSolicitud: { gte: new Date(Date.now() - VENTANA_LIMITE_MS) },
    },
  });
  if (recientes >= MAX_SOLICITUDES_POR_HORA) {
    return { enviado: false, motivo: "limite-alcanzado" };
  }

  const token = randomBytes(32).toString("base64url");
  const fechaExpiracion = new Date(Date.now() + VIGENCIA_MINUTOS * 60 * 1000);

  await prisma.tokenRecuperacion.create({
    data: { tokenHash: hashDeToken(token), idArtesano: artesano.idArtesano, fechaExpiracion },
  });

  const enlace = `${basePublica()}/restablecer/${token}`;
  await enviarCorreo({
    para: artesano.correo,
    asunto: "Restablece tu contraseña de Artani",
    texto:
      `Hola ${artesano.nombres}:\n\n` +
      `Recibimos una solicitud para restablecer la contraseña de tu cuenta de Artani.\n` +
      `Abre este enlace para elegir una nueva. Vence en ${VIGENCIA_MINUTOS} minutos y ` +
      `solo puede usarse una vez:\n\n${enlace}\n\n` +
      `Si no fuiste tú, ignora este mensaje: tu contraseña actual sigue siendo válida.\n`,
    html:
      `<p>Hola ${artesano.nombres}:</p>` +
      `<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta de Artani.</p>` +
      `<p><a href="${enlace}">Elegir una nueva contraseña</a></p>` +
      `<p>El enlace vence en ${VIGENCIA_MINUTOS} minutos y solo puede usarse una vez.</p>` +
      `<p>Si no fuiste tú, ignora este mensaje: tu contraseña actual sigue siendo válida.</p>`,
  });

  return { enviado: true };
}

/**
 * Consume el token y establece la contraseña nueva.
 *
 * Rechaza tokens inexistentes, vencidos o ya usados con el mismo mensaje, para
 * no distinguir entre esos casos ante quien prueba valores al azar.
 */
export async function confirmarRecuperacion(
  token: string,
  contrasenaNueva: string,
): Promise<void> {
  const invalido = new ApiError(
    400,
    "El enlace de recuperación no es válido, ya se usó o venció. Solicita uno nuevo",
  );

  if (typeof token !== "string" || token.trim().length === 0) {
    throw invalido;
  }

  try {
    validarContrasena(contrasenaNueva ?? "");
  } catch (err) {
    throw new ApiError(400, err instanceof ErrorAlta ? err.message : "La contraseña no es válida");
  }

  const registro = await prisma.tokenRecuperacion.findUnique({
    where: { tokenHash: hashDeToken(token) },
    select: { idToken: true, idArtesano: true, fechaExpiracion: true, fechaUso: true },
  });
  if (!registro || registro.fechaUso !== null || registro.fechaExpiracion <= new Date()) {
    throw invalido;
  }

  const contrasenaHash = await bcrypt.hash(contrasenaNueva, COSTE_BCRYPT);

  await prisma.$transaction([
    prisma.artesano.update({
      where: { idArtesano: registro.idArtesano },
      data: { contrasenaHash },
    }),
    // Uso único
    prisma.tokenRecuperacion.update({
      where: { idToken: registro.idToken },
      data: { fechaUso: new Date() },
    }),
    // Cambiar la contraseña invalida cualquier otro enlace pendiente
    prisma.tokenRecuperacion.updateMany({
      where: { idArtesano: registro.idArtesano, fechaUso: null },
      data: { fechaUso: new Date() },
    }),
  ]);
}
