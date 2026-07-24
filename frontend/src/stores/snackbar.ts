import { ref } from 'vue'
import { defineStore } from 'pinia'

/**
 * CAM-014: notificación Snackbar global con acción «Deshacer».
 *
 * - Éxito de altas y ediciones de cualquier módulo, y de eliminaciones sin
 *   justificación (catálogos, fotografías): mensaje + botón «Deshacer».
 * - Eliminaciones con motivo obligatorio (compras y artesanías): solo aviso
 *   del resultado, sin «Deshacer» (la confirmación previa lo sustituye).
 * - Errores: variante de error, sin «Deshacer».
 */
export interface OpcionesSnackbar {
  mensaje: string
  tono?: 'exito' | 'error'
  /** Al proporcionarla, el Snackbar muestra el botón «Deshacer». */
  deshacer?: () => Promise<void> | void
  /** Milisegundos visibles (el documento pide entre 5 y 7 segundos). */
  duracion?: number
}

interface SnackActivo {
  id: number
  mensaje: string
  tono: 'exito' | 'error'
  deshacer?: () => Promise<void> | void
}

const DURACION_PREDETERMINADA = 6000

export const useSnackbarStore = defineStore('snackbar', () => {
  const actual = ref<SnackActivo | null>(null)
  const deshaciendo = ref(false)
  let siguienteId = 1
  let temporizador: ReturnType<typeof setTimeout> | null = null

  function cerrar(): void {
    if (temporizador) clearTimeout(temporizador)
    temporizador = null
    actual.value = null
    deshaciendo.value = false
  }

  function mostrar(opciones: OpcionesSnackbar): void {
    cerrar()
    actual.value = {
      id: siguienteId++,
      mensaje: opciones.mensaje,
      tono: opciones.tono ?? 'exito',
      deshacer: opciones.deshacer,
    }
    temporizador = setTimeout(cerrar, opciones.duracion ?? DURACION_PREDETERMINADA)
  }

  function exito(mensaje: string, deshacer?: () => Promise<void> | void): void {
    mostrar({ mensaje, tono: 'exito', deshacer })
  }

  function error(mensaje: string): void {
    mostrar({ mensaje, tono: 'error' })
  }

  async function ejecutarDeshacer(): Promise<void> {
    const snack = actual.value
    if (!snack?.deshacer || deshaciendo.value) return
    deshaciendo.value = true
    // Mientras se revierte, el aviso no debe desaparecer solo
    if (temporizador) clearTimeout(temporizador)
    try {
      await snack.deshacer()
      mostrar({ mensaje: 'Listo, se deshizo la acción.' })
    } catch {
      mostrar({ mensaje: 'No se pudo deshacer la acción.', tono: 'error' })
    } finally {
      deshaciendo.value = false
    }
  }

  return { actual, deshaciendo, mostrar, exito, error, cerrar, ejecutarDeshacer }
})
