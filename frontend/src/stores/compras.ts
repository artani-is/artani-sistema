import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/lib/api'
import type { Compra } from '@/types'

export interface NuevaCompra {
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

  async function crear(datos: NuevaCompra): Promise<void> {
    await api.post('/compras', datos)
    await cargar()
  }

  async function eliminar(id: string): Promise<void> {
    await api.del(`/compras/${id}`)
    await cargar()
  }

  return { compras, cargando, cargar, crear, eliminar }
})
