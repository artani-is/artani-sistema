/**
 * Reglas de contraseña, en espejo de las que aplica el servidor
 * (`backend/src/lib/artesanos.ts`).
 *
 * Existen para poder guiar al usuario mientras escribe, no para sustituir la
 * validación del servidor: la API vuelve a comprobarlas en cada petición.
 */

export const MIN_LONGITUD = 12

export interface Requisito {
  clave: string
  etiqueta: string
  cumple: (contrasena: string) => boolean
}

export const REQUISITOS: Requisito[] = [
  {
    clave: 'longitud',
    etiqueta: `Al menos ${MIN_LONGITUD} caracteres`,
    cumple: (c) => c.length >= MIN_LONGITUD,
  },
  {
    clave: 'letras',
    etiqueta: 'Incluye al menos una letra',
    cumple: (c) => /[a-záéíóúñ]/i.test(c),
  },
  {
    clave: 'numeros',
    etiqueta: 'Incluye al menos un número',
    cumple: (c) => /\d/.test(c),
  },
  {
    clave: 'variedad',
    etiqueta: 'No es un mismo carácter repetido',
    cumple: (c) => c.length > 0 && !/^(.)\1+$/.test(c),
  },
]

export function contrasenaValida(contrasena: string): boolean {
  return REQUISITOS.every((r) => r.cumple(contrasena))
}
