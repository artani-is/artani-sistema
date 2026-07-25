import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api, guardarToken, obtenerToken } from '@/lib/api'
import type { Artesano, Sesion } from '@/types'

const ARTESANO_KEY = 'artani_artesano'

function artesanoGuardado(): Artesano | null {
  const crudo = localStorage.getItem(ARTESANO_KEY) ?? sessionStorage.getItem(ARTESANO_KEY)
  if (!crudo) return null
  try {
    return JSON.parse(crudo) as Artesano
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(obtenerToken())
  const artesano = ref<Artesano | null>(artesanoGuardado())
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const autenticado = computed(() => token.value !== null)
  const nombreCompleto = computed(() =>
    artesano.value
      ? `${artesano.value.nombres} ${artesano.value.apellidoPaterno}`
      : '',
  )

  async function iniciarSesion(
    correo: string,
    contrasena: string,
    recordar = true,
  ): Promise<void> {
    cargando.value = true
    error.value = null
    try {
      const sesion = await api.post<Sesion>('/auth/login', { correo, contrasena })
      token.value = sesion.token
      artesano.value = sesion.artesano
      guardarToken(sesion.token, recordar)
      localStorage.removeItem(ARTESANO_KEY)
      sessionStorage.removeItem(ARTESANO_KEY)
      ;(recordar ? localStorage : sessionStorage).setItem(
        ARTESANO_KEY,
        JSON.stringify(sesion.artesano),
      )
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'No se pudo iniciar sesión'
      throw err
    } finally {
      cargando.value = false
    }
  }

  /** HU-17: los cambios se reflejan de inmediato, sin cerrar sesión. */
  async function actualizarPerfil(datos: {
    nombres: string
    apellidoPaterno: string
    apellidoMaterno?: string | null
    telefono?: string | null
    nombreTaller?: string | null
  }): Promise<void> {
    const actualizado = await api.put<Artesano>('/auth/perfil', datos)
    artesano.value = actualizado
    const almacen = localStorage.getItem(ARTESANO_KEY) !== null ? localStorage : sessionStorage
    almacen.setItem(ARTESANO_KEY, JSON.stringify(actualizado))
  }

  function cerrarSesion(): void {
    token.value = null
    artesano.value = null
    guardarToken(null)
    localStorage.removeItem(ARTESANO_KEY)
    sessionStorage.removeItem(ARTESANO_KEY)
  }

  return {
    token,
    artesano,
    cargando,
    error,
    autenticado,
    nombreCompleto,
    iniciarSesion,
    actualizarPerfil,
    cerrarSesion,
  }
})
