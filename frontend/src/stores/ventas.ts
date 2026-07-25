import { reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/lib/api'
import type { ReporteVentas, Venta } from '@/types'

export interface FiltrosVentas {
  inicio: string
  fin: string
  canal: 'DIRECTA' | 'CONSIGNACION' | ''
}

export const useVentasStore = defineStore('ventas', () => {
  const ventas = ref<Venta[]>([])
  const reportes = ref<ReporteVentas[]>([])
  const cargando = ref(false)
  const filtros = reactive<FiltrosVentas>({ inicio: '', fin: '', canal: '' })

  async function cargar(): Promise<void> {
    cargando.value = true
    try {
      const parametros = new URLSearchParams()
      if (filtros.inicio) parametros.set('inicio', filtros.inicio)
      if (filtros.fin) parametros.set('fin', filtros.fin)
      if (filtros.canal) parametros.set('canal', filtros.canal)
      const consulta = parametros.toString()
      ventas.value = await api.get<Venta[]>(consulta ? `/ventas?${consulta}` : '/ventas')
    } finally {
      cargando.value = false
    }
  }

  async function cargarReportes(): Promise<void> {
    reportes.value = await api.get<ReporteVentas[]>('/reportes')
  }

  /** HU-16: genera el PDF del periodo y registra la generación en la bitácora. */
  async function generarReporte(fechaInicio: string, fechaFin: string): Promise<ReporteVentas> {
    const reporte = await api.post<ReporteVentas>('/reportes', { fechaInicio, fechaFin })
    await cargarReportes()
    return reporte
  }

  return { ventas, reportes, cargando, filtros, cargar, cargarReportes, generarReporte }
})
