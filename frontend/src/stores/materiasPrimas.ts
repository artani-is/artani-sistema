import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/lib/api'
import type { MateriaPrima, PrecioHistorico } from '@/types'

export const useMateriasPrimasStore = defineStore('materiasPrimas', () => {
  const materias = ref<MateriaPrima[]>([])
  const cargando = ref(false)

  async function cargar(): Promise<void> {
    cargando.value = true
    try {
      materias.value = await api.get<MateriaPrima[]>('/materias-primas')
    } finally {
      cargando.value = false
    }
  }

  async function crear(datos: Partial<MateriaPrima>): Promise<MateriaPrima> {
    const creada = await api.post<MateriaPrima>('/materias-primas', datos)
    await cargar()
    return creada
  }

  async function actualizar(id: string, datos: Partial<MateriaPrima>): Promise<void> {
    await api.put(`/materias-primas/${id}`, datos)
    await cargar()
  }

  async function eliminar(id: string): Promise<void> {
    await api.del(`/materias-primas/${id}`)
    await cargar()
  }

  function historialPrecios(id: string): Promise<PrecioHistorico[]> {
    return api.get<PrecioHistorico[]>(`/materias-primas/${id}/historial-precios`)
  }

  return { materias, cargando, cargar, crear, actualizar, eliminar, historialPrecios }
})
