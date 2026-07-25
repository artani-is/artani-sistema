import { ApiError } from "../middlewares/error.js";

interface OpcionesTexto {
  obligatorio?: boolean;
  max?: number;
}

export function textoDe(
  body: Record<string, unknown>,
  campo: string,
  { obligatorio = false, max = 255 }: OpcionesTexto = {},
): string | null {
  const valor = body[campo];
  if (valor === undefined || valor === null || (typeof valor === "string" && !valor.trim())) {
    if (obligatorio) {
      throw new ApiError(400, `El campo "${campo}" es obligatorio`);
    }
    return null;
  }
  if (typeof valor !== "string") {
    throw new ApiError(400, `El campo "${campo}" debe ser texto`);
  }
  const limpio = valor.trim();
  if (limpio.length > max) {
    throw new ApiError(400, `El campo "${campo}" no debe exceder ${max} caracteres`);
  }
  return limpio;
}

export function decimalPositivoDe(
  body: Record<string, unknown>,
  campo: string,
): string {
  const valor = body[campo];
  const numero = typeof valor === "string" ? Number(valor) : valor;
  if (typeof numero !== "number" || !Number.isFinite(numero) || numero <= 0) {
    throw new ApiError(400, `El campo "${campo}" debe ser un número mayor a cero`);
  }
  return String(numero);
}

/** Decimal >= 0 (HU-8 permite horas/tarifa en cero sin bloquear). */
export function decimalNoNegativoDe(
  body: Record<string, unknown>,
  campo: string,
): string {
  const valor = body[campo];
  const numero = typeof valor === "string" ? Number(valor) : valor;
  if (typeof numero !== "number" || !Number.isFinite(numero) || numero < 0) {
    throw new ApiError(400, `El campo "${campo}" debe ser un número mayor o igual a cero`);
  }
  return String(numero);
}

/** Extrae un parámetro de ruta como string (Express 5 lo tipa como string | string[]). */
export function paramDe(params: Record<string, unknown>, nombre: string): string {
  const valor = params[nombre];
  if (typeof valor !== "string" || !valor) {
    throw new ApiError(400, `Falta el parámetro de ruta "${nombre}"`);
  }
  return valor;
}

export function uuidDe(body: Record<string, unknown>, campo: string): string {
  const valor = body[campo];
  if (typeof valor !== "string" || !/^[0-9a-f-]{36}$/i.test(valor)) {
    throw new ApiError(400, `El campo "${campo}" es obligatorio y debe ser un identificador válido`);
  }
  return valor;
}
