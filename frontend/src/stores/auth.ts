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
    cerrarSesion,
  }
})
