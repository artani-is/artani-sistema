import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/lib/api'
import type { Proveedor } from '@/types'

export const useProveedoresStore = defineStore('proveedores', () => {
  const proveedores = ref<Proveedor[]>([])
  const cargando = ref(false)

  async function cargar(): Promise<void> {
    cargando.value = true
    try {
      proveedores.value = await api.get<Proveedor[]>('/proveedores')
    } finally {
      cargando.value = false
    }
  }

  async function crear(datos: Partial<Proveedor>): Promise<void> {
    await api.post('/proveedores', datos)
    await cargar()
  }

  async function actualizar(id: string, datos: Partial<Proveedor>): Promise<void> {
    await api.put(`/proveedores/${id}`, datos)
    await cargar()
  }

  async function eliminar(id: string): Promise<void> {
    await api.del(`/proveedores/${id}`)
    await cargar()
  }

  return { proveedores, cargando, cargar, crear, actualizar, eliminar }
})
