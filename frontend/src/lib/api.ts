const BASE_URL = '/api'
const TOKEN_KEY = 'artani_token'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function obtenerToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
}

/** Guarda el token; con `persistente` en false dura solo la sesión del navegador. */
export function guardarToken(token: string | null, persistente = true): void {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  if (token) {
    ;(persistente ? localStorage : sessionStorage).setItem(TOKEN_KEY, token)
  }
}

async function ejecutar<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = obtenerToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (init.body !== undefined && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  let respuesta: Response
  try {
    respuesta = await fetch(`${BASE_URL}${ruta}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'No hay conexión con el servidor. Verifica tu conexión a internet')
  }

  if (respuesta.status === 204) {
    return undefined as T
  }

  const cuerpo = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    const mensaje =
      cuerpo && typeof cuerpo.error === 'string'
        ? cuerpo.error
        : 'Ocurrió un error inesperado en el servidor'
    throw new ApiError(respuesta.status, mensaje)
  }
  return cuerpo as T
}

export const api = {
  get<T>(ruta: string): Promise<T> {
    return ejecutar<T>(ruta)
  },
  post<T>(ruta: string, datos: unknown): Promise<T> {
    return ejecutar<T>(ruta, { method: 'POST', body: JSON.stringify(datos) })
  },
  put<T>(ruta: string, datos: unknown): Promise<T> {
    return ejecutar<T>(ruta, { method: 'PUT', body: JSON.stringify(datos) })
  },
  patch<T>(ruta: string, datos: unknown = {}): Promise<T> {
    return ejecutar<T>(ruta, { method: 'PATCH', body: JSON.stringify(datos) })
  },
  del(ruta: string): Promise<void> {
    return ejecutar<void>(ruta, { method: 'DELETE' })
  },
  subirArchivos<T>(ruta: string, formulario: FormData): Promise<T> {
    return ejecutar<T>(ruta, { method: 'POST', body: formulario })
  },
}
