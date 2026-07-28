/**
 * Envío de correo transaccional a través de Resend.
 *
 * La API key se lee de RESEND_API_KEY y nunca se registra en bitácora ni se
 * devuelve en ninguna respuesta. El transporte es sustituible para que las
 * pruebas no dependan de la red ni de una cuenta real.
 */

export interface Correo {
  para: string;
  asunto: string;
  html: string;
  texto: string;
}

export type Transporte = (correo: Correo) => Promise<void>;

/** Remitente fijo del sistema. El dominio debe estar verificado en Resend. */
export const REMITENTE = process.env.CORREO_REMITENTE ?? "Artani <no-reply@artani.app>";

const URL_RESEND = "https://api.resend.com/emails";

/** Transporte real: publica el correo en la API de Resend. */
const transporteResend: Transporte = async (correo) => {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) {
    // No se inventa un valor por omisión: sin clave, el envío no ocurre.
    throw new Error(
      "Falta la variable de entorno RESEND_API_KEY; no se puede enviar el correo",
    );
  }

  const respuesta = await fetch(URL_RESEND, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: REMITENTE,
      to: [correo.para],
      subject: correo.asunto,
      html: correo.html,
      text: correo.texto,
    }),
  });

  if (!respuesta.ok) {
    // El cuerpo de Resend puede incluir el motivo; la clave jamás se registra.
    const detalle = await respuesta.text().catch(() => "");
    throw new Error(
      `Resend rechazó el envío (HTTP ${respuesta.status}): ${detalle.slice(0, 200)}`,
    );
  }
};

let transporteActual: Transporte = transporteResend;

/** Sustituye el transporte (solo para pruebas); devuelve el anterior. */
export function usarTransporte(nuevo: Transporte): Transporte {
  const previo = transporteActual;
  transporteActual = nuevo;
  return previo;
}

export function restablecerTransporte(): void {
  transporteActual = transporteResend;
}

export function enviarCorreo(correo: Correo): Promise<void> {
  return transporteActual(correo);
}
