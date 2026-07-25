import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/lib/api'
import type { Compra } from '@/types'

export interface DatosCompra {
  idProveedor: string
  folioNota?: string
  fecha?: string
  detalles: Array<{ idMateria: string; cantidad: number; costoUnitario: number }>
}

export const useComprasStore = defineStore('compras', () => {
  const compras = ref<Compra[]>([])
  const cargando = ref(false)

  async function cargar(): Promise<void> {
    cargando.value = true
    try {
      compras.value = await api.get<Compra[]>('/compras')
    } finally {
      cargando.value = false
    }
  }

  async function crear(datos: DatosCompra): Promise<Compra> {
    const compra = await api.post<Compra>('/compras', datos)
    await cargar()
    return compra
  }

  /** CAM-010: corrección de una compra capturada con datos erróneos. */
  async function actualizar(id: string, datos: DatosCompra): Promise<Compra> {
    const compra = await api.put<Compra>(`/compras/${id}`, datos)
    await cargar()
    return compra
  }

  /** CAM-012: borrado lógico; el motivo es obligatorio y queda registrado. */
  async function eliminar(id: string, motivo: string): Promise<void> {
    await api.del(`/compras/${id}`, { motivo })
    await cargar()
  }

  return { compras, cargando, cargar, crear, actualizar, eliminar }
})
