import { reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/lib/api'
import type {
  Artesania,
  CertificadoQr,
  Consignacion,
  EstadoArtesania,
  FotoArtesania,
  InsumoArtesania,
  Venta,
} from '@/types'

export interface FiltrosArtesania {
  busqueda: string
  estado: EstadoArtesania | ''
  idTecnica: string
  idCategoria: string
}

export interface DatosArtesania {
  nombre: string
  descripcion?: string | null
  idTecnica: string
  idCategoria: string
}

export const useArtesaniasStore = defineStore('artesanias', () => {
  const artesanias = ref<Artesania[]>([])
  const cargando = ref(false)
  const filtros = reactive<FiltrosArtesania>({
    busqueda: '',
    estado: '',
    idTecnica: '',
    idCategoria: '',
  })

  async function cargar(): Promise<void> {
    cargando.value = true
    try {
      const parametros = new URLSearchParams()
      if (filtros.busqueda) parametros.set('busqueda', filtros.busqueda)
      if (filtros.estado) parametros.set('estado', filtros.estado)
      if (filtros.idTecnica) parametros.set('idTecnica', filtros.idTecnica)
      if (filtros.idCategoria) parametros.set('idCategoria', filtros.idCategoria)
      const consulta = parametros.toString()
      artesanias.value = await api.get<Artesania[]>(
        consulta ? `/artesanias?${consulta}` : '/artesanias',
      )
    } finally {
      cargando.value = false
    }
  }

  function obtener(id: string): Promise<Artesania> {
    return api.get<Artesania>(`/artesanias/${id}`)
  }

  function crear(datos: DatosArtesania): Promise<Artesania> {
    return api.post<Artesania>('/artesanias', datos)
  }

  function actualizar(id: string, datos: DatosArtesania): Promise<Artesania> {
    return api.put<Artesania>(`/artesanias/${id}`, datos)
  }

  async function eliminar(id: string): Promise<void> {
    await api.del(`/artesanias/${id}`)
    await cargar()
  }

  function subirFotos(id: string, archivos: File[]): Promise<FotoArtesania[]> {
    const formulario = new FormData()
    for (const archivo of archivos) {
      formulario.append('fotos', archivo)
    }
    return api.subirArchivos<FotoArtesania[]>(`/artesanias/${id}/fotos`, formulario)
  }

  function marcarFotoPrincipal(id: string, idFoto: string): Promise<FotoArtesania> {
    return api.patch<FotoArtesania>(`/artesanias/${id}/fotos/${idFoto}/principal`)
  }

  function eliminarFoto(id: string, idFoto: string): Promise<void> {
    return api.del(`/artesanias/${id}/fotos/${idFoto}`)
  }

  // Sprint 3 — costeo (HU-8, HU-9)

  function guardarInsumos(
    id: string,
    insumos: { idMateria: string; cantidadUsada: string; costoUnitarioUso?: string }[],
  ): Promise<InsumoArtesania[]> {
    return api.put<InsumoArtesania[]>(`/artesanias/${id}/insumos`, { insumos })
  }

  function guardarCosteo(
    id: string,
    datos: { horasTrabajadas: string; tarifaHora: string },
  ): Promise<Artesania> {
    return api.put<Artesania>(`/artesanias/${id}/costeo`, datos)
  }

  function asignarPrecio(id: string, precioVenta: string): Promise<Artesania> {
    return api.put<Artesania>(`/artesanias/${id}/precio`, { precioVenta })
  }

  // Sprint 4 — certificación digital (HU-10, HU-11)

  function emitirCertificado(id: string): Promise<CertificadoQr> {
    return api.post<CertificadoQr>(`/artesanias/${id}/certificado`, {})
  }

  function obtenerCertificado(id: string): Promise<CertificadoQr> {
    return api.get<CertificadoQr>(`/artesanias/${id}/certificado`)
  }

  // Sprint 5 — consignación y ventas (HU-13, HU-14)

  function enviarConsignacion(
    id: string,
    datos: { idGaleria: string; porcentajeComision?: string },
  ): Promise<Consignacion> {
    return api.post<Consignacion>(`/artesanias/${id}/consignacion`, datos)
  }

  function registrarVenta(
    id: string,
    datos: { montoCobrado: string; fechaVenta?: string },
  ): Promise<Venta> {
    return api.post<Venta>(`/artesanias/${id}/venta`, datos)
  }

  function registrarDevolucion(idConsignacion: string): Promise<Consignacion> {
    return api.patch<Consignacion>(`/consignaciones/${idConsignacion}/devolucion`)
  }

  return {
    artesanias,
    cargando,
    filtros,
    cargar,
    obtener,
    crear,
    actualizar,
    eliminar,
    subirFotos,
    marcarFotoPrincipal,
    eliminarFoto,
    guardarInsumos,
    guardarCosteo,
    asignarPrecio,
    emitirCertificado,
    obtenerCertificado,
    enviarConsignacion,
    registrarVenta,
    registrarDevolucion,
  }
})
