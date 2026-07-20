import { reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/lib/api'

export type CatalogoKey = 'tiposMaterial' | 'tecnicas' | 'categorias' | 'galerias'

export interface ElementoCatalogo {
  nombre: string
  [campo: string]: unknown
}

interface ConfigCatalogo {
  endpoint: string
  idCampo: string
}

export const CONFIG_CATALOGOS: Record<CatalogoKey, ConfigCatalogo> = {
  tiposMaterial: { endpoint: '/catalogos/tipos-material', idCampo: 'idTipoMaterial' },
  tecnicas: { endpoint: '/catalogos/tecnicas', idCampo: 'idTecnica' },
  categorias: { endpoint: '/catalogos/categorias', idCampo: 'idCategoria' },
  galerias: { endpoint: '/catalogos/galerias', idCampo: 'idGaleria' },
}

export function idDe(catalogo: CatalogoKey, elemento: ElementoCatalogo): string {
  return elemento[CONFIG_CATALOGOS[catalogo].idCampo] as string
}

export const useCatalogosStore = defineStore('catalogos', () => {
  const listas = reactive<Record<CatalogoKey, ElementoCatalogo[]>>({
    tiposMaterial: [],
    tecnicas: [],
    categorias: [],
    galerias: [],
  })
  const cargando = ref(false)

  async function cargar(catalogo: CatalogoKey): Promise<void> {
    cargando.value = true
    try {
      listas[catalogo] = await api.get<ElementoCatalogo[]>(CONFIG_CATALOGOS[catalogo].endpoint)
    } finally {
      cargando.value = false
    }
  }

  async function cargarTodos(): Promise<void> {
    await Promise.all((Object.keys(CONFIG_CATALOGOS) as CatalogoKey[]).map(cargar))
  }

  async function crear(catalogo: CatalogoKey, datos: Record<string, unknown>): Promise<void> {
    await api.post(CONFIG_CATALOGOS[catalogo].endpoint, datos)
    await cargar(catalogo)
  }

  async function actualizar(
    catalogo: CatalogoKey,
    id: string,
    datos: Record<string, unknown>,
  ): Promise<void> {
    await api.put(`${CONFIG_CATALOGOS[catalogo].endpoint}/${id}`, datos)
    await cargar(catalogo)
  }

  async function eliminar(catalogo: CatalogoKey, id: string): Promise<void> {
    await api.del(`${CONFIG_CATALOGOS[catalogo].endpoint}/${id}`)
    await cargar(catalogo)
  }

  return { listas, cargando, cargar, cargarTodos, crear, actualizar, eliminar }
})
