import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import ReportesView from '@/views/ReportesView.vue'

/** Doble de la capa HTTP: la vista se prueba sin backend. */
const respuestas = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  subirArchivos: vi.fn(),
}))

vi.mock('@/lib/api', async () => {
  const real = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...real, api: respuestas }
})

/** Precio de lista 1 500 y cobrado 1 200: la transacción se cerró por debajo. */
const VENTA_CON_DESCUENTO = {
  idVenta: 'v1',
  fechaVenta: '2026-03-05',
  montoCobrado: '1200',
  idArtesania: 'p1',
  idConsignacion: null,
  canal: 'DIRECTA',
  artesania: { idArtesania: 'p1', nombre: 'Vasija de barro', precioVenta: '1500' },
}

/** Pieza vendida sin precio final asignado: no hay precio de lista que mostrar. */
const VENTA_SIN_PRECIO_LISTA = {
  idVenta: 'v2',
  fechaVenta: '2026-03-09',
  montoCobrado: '800',
  idArtesania: 'p2',
  idConsignacion: null,
  canal: 'DIRECTA',
  artesania: { idArtesania: 'p2', nombre: 'Cántaro pequeño', precioVenta: null },
}

async function montarReportes(ventas: unknown[]): Promise<VueWrapper> {
  respuestas.get.mockImplementation((ruta: string) => {
    if (ruta.startsWith('/ventas')) return Promise.resolve(ventas)
    if (ruta === '/reportes') return Promise.resolve([])
    return Promise.resolve([])
  })

  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/reportes', name: 'reportes', component: ReportesView },
    ],
  })
  router.push('/reportes')
  await router.isReady()
  const wrapper = mount(ReportesView, { global: { plugins: [router] } })
  await vi.waitFor(() => expect(wrapper.find('table').exists()).toBe(true))
  return wrapper
}

function encabezados(wrapper: VueWrapper): string[] {
  return wrapper.findAll('th').map((t) => t.text())
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('HU-16 · Reporte de ventas — precio de lista y monto cobrado', () => {
  it('CA HU-09: la tabla muestra el precio de lista junto al monto cobrado', async () => {
    const wrapper = await montarReportes([VENTA_CON_DESCUENTO])

    expect(encabezados(wrapper)).toContain('Precio de lista')
    expect(encabezados(wrapper)).toContain('Monto cobrado')

    const fila = wrapper.find('tbody tr').text()
    expect(fila).toContain('Vasija de barro')
    // Los dos importes conviven: el de lista y el efectivamente cobrado
    expect(fila).toContain('$1,500')
    expect(fila).toContain('$1,200')
  })

  it('una venta sin precio final asignado no inventa un precio de lista', async () => {
    const wrapper = await montarReportes([VENTA_SIN_PRECIO_LISTA])

    const fila = wrapper.find('tbody tr').text()
    expect(fila).toContain('Cántaro pequeño')
    expect(fila).toContain('$800')
    expect(fila).toContain('—')
  })

  it('los indicadores del periodo siguen derivándose del monto cobrado (HU-16)', async () => {
    const wrapper = await montarReportes([VENTA_CON_DESCUENTO, VENTA_SIN_PRECIO_LISTA])

    // 1 200 + 800 = 2 000 cobrados; el total NO usa los 1 500 del precio de lista
    expect(wrapper.text()).toContain('$2,000')
    expect(wrapper.text()).not.toContain('$2,300')
  })
})
