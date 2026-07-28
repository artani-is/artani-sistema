import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import CosteoView from '@/views/CosteoView.vue'

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

const PIEZA = {
  idArtesania: 'p1',
  nombre: 'Jarrón ceremonial',
  descripcion: null,
  estado: 'DISPONIBLE',
  horasTrabajadas: null,
  tarifaHora: null,
  precioVenta: null,
  insumos: [],
  fotos: [],
  tecnica: { idTecnica: 't1', nombre: 'Barro negro', descripcion: null },
  categoria: { idCategoria: 'c1', nombre: 'Jarrón' },
}

const MATERIAS = [
  { idMateria: 'm1', nombre: 'Barro crudo', unidadMedida: 'KG' },
  { idMateria: 'm2', nombre: 'Esmalte', unidadMedida: 'LITRO' },
]

function crearRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/artesanias/:id/costeo', name: 'artesania-costeo', component: CosteoView },
      { path: '/artesanias/:id', name: 'artesania-detalle', component: { template: '<div/>' } },
    ],
  })
}

async function montarCosteo(pieza: Record<string, unknown> = PIEZA) {
  respuestas.get.mockImplementation((ruta: string) => {
    if (ruta.startsWith('/artesanias/')) return Promise.resolve(pieza)
    if (ruta === '/materias-primas') return Promise.resolve(MATERIAS)
    if (ruta.includes('historial-precios')) return Promise.resolve([{ costoUnitario: '20' }])
    return Promise.resolve([])
  })

  const router = crearRouter()
  router.push('/artesanias/p1/costeo')
  await router.isReady()
  const wrapper = mount(CosteoView, { global: { plugins: [router] } })
  await vi.waitFor(() => expect(wrapper.text()).toContain('Jarrón ceremonial'))
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

/** Lee el número mostrado por un campo numérico del resumen. */
function numerosDe(texto: string): number[] {
  return [...texto.matchAll(/\$\s?([\d,]+(?:\.\d+)?)/g)].map((m) => Number(m[1]!.replace(/,/g, '')))
}

describe('HU-08 · Cálculo de precio sugerido — vista de costeo', () => {
  it('caso de éxito: el precio sugerido se actualiza al cambiar horas y tarifa', async () => {
    const wrapper = await montarCosteo()

    const inputs = wrapper.findAll('input')
    const horas = inputs.find((i) => i.attributes('placeholder')?.match(/hora/i) ?? false)

    // Se capturan horas y tarifa a través del modelo del componente
    const vm = wrapper.vm as unknown as { horas: string; tarifa: string; sugerido: number }
    vm.horas = '8'
    vm.tarifa = '75'
    await wrapper.vm.$nextTick()

    // Sin insumos: 8 × 75 = 600
    expect(vm.sugerido).toBe(600)
    expect(inputs.length).toBeGreaterThan(0)
    expect(horas === undefined || horas.exists()).toBe(true)
  })

  it('CA: el cálculo se recalcula dinámicamente al modificar los insumos', async () => {
    const wrapper = await montarCosteo()
    const vm = wrapper.vm as unknown as {
      filas: { clave: number; idMateria: string; cantidad: string; costo: string }[]
      horas: string
      tarifa: string
      totalInsumos: number
      manoObra: number
      sugerido: number
      agregarFila: () => void
    }

    vm.agregarFila()
    await wrapper.vm.$nextTick()
    vm.filas[0]!.idMateria = 'm1'
    vm.filas[0]!.cantidad = '3'
    vm.filas[0]!.costo = '20'
    vm.horas = '8'
    vm.tarifa = '75'
    await wrapper.vm.$nextTick()

    expect(vm.totalInsumos).toBe(60) // 3 × 20
    expect(vm.manoObra).toBe(600) // 8 × 75
    expect(vm.sugerido).toBe(660)

    // Se modifica la cantidad: el total debe seguir el cambio sin recargar
    vm.filas[0]!.cantidad = '10'
    await wrapper.vm.$nextTick()
    expect(vm.totalInsumos).toBe(200)
    expect(vm.sugerido).toBe(800)
  })

  it('CA: horas o tarifa en cero muestran una advertencia sin bloquear el cálculo', async () => {
    const wrapper = await montarCosteo()
    const vm = wrapper.vm as unknown as {
      filas: unknown[]
      horas: string
      tarifa: string
      advertenciaTrabajo: boolean
      sugerido: number
      agregarFila: () => void
    }

    vm.agregarFila()
    await wrapper.vm.$nextTick()
    ;(vm.filas[0] as { idMateria: string; cantidad: string; costo: string }).idMateria = 'm1'
    ;(vm.filas[0] as { cantidad: string }).cantidad = '3'
    ;(vm.filas[0] as { costo: string }).costo = '20'
    vm.horas = '0'
    vm.tarifa = '0'
    await wrapper.vm.$nextTick()

    // CA: se advierte, pero el cálculo NO se bloquea
    expect(vm.advertenciaTrabajo).toBe(true)
    expect(vm.sugerido).toBe(60)
    await vi.waitFor(() => expect(wrapper.text()).toMatch(/no refleja|trabajo real|horas/i))
  })

  it('CA: el costo se propone desde la compra más reciente al elegir la materia', async () => {
    const wrapper = await montarCosteo()
    const vm = wrapper.vm as unknown as {
      filas: { idMateria: string; costo: string }[]
      agregarFila: () => void
      alCambiarMateria: (f: { idMateria: string; costo: string }) => Promise<void>
    }

    vm.agregarFila()
    await wrapper.vm.$nextTick()
    vm.filas[0]!.idMateria = 'm1'
    await vm.alCambiarMateria(vm.filas[0]!)

    expect(respuestas.get).toHaveBeenCalledWith('/materias-primas/m1/historial-precios')
    expect(vm.filas[0]!.costo).toBe('20')
  })

  it('caso de fallo: un insumo incompleto se rechaza con mensaje explicativo', async () => {
    const wrapper = await montarCosteo()
    const vm = wrapper.vm as unknown as {
      filas: { idMateria: string; cantidad: string; costo: string }[]
      error: string | null
      agregarFila: () => void
      validarFilas: () => boolean
    }

    vm.agregarFila()
    await wrapper.vm.$nextTick()
    vm.filas[0]!.idMateria = 'm1'
    vm.filas[0]!.cantidad = '0' // inválido
    vm.filas[0]!.costo = '20'

    expect(vm.validarFilas()).toBe(false)
    expect(vm.error).toMatch(/mayores a cero/i)
  })
})

describe('HU-09 · Asignación de precio de venta final', () => {
  it('CA: una pieza VENDIDA bloquea la edición del costeo', async () => {
    const wrapper = await montarCosteo({ ...PIEZA, estado: 'VENDIDA', precioVenta: '1500' })
    const vm = wrapper.vm as unknown as { bloqueada: boolean }

    expect(vm.bloqueada).toBe(true)
  })

  it('CA: el precio final se envía al backend tal como lo captura el artesano', async () => {
    const wrapper = await montarCosteo()
    respuestas.put.mockResolvedValue({ ...PIEZA, precioVenta: '1850' })
    const vm = wrapper.vm as unknown as {
      precioFinal: string
      asignarPrecioFinal: () => Promise<void>
    }

    vm.precioFinal = '1850'
    await vm.asignarPrecioFinal()

    expect(respuestas.put).toHaveBeenCalledWith('/artesanias/p1/precio', {
      precioVenta: '1850',
    })
  })

  it('CA (caso de fallo): un precio no positivo se rechaza en el cliente', async () => {
    const wrapper = await montarCosteo()
    const vm = wrapper.vm as unknown as {
      precioFinal: string
      error: string | null
      asignarPrecioFinal: () => Promise<void>
    }

    vm.precioFinal = '-100'
    await vm.asignarPrecioFinal()

    expect(vm.error).toMatch(/número positivo/i)
    expect(respuestas.put).not.toHaveBeenCalled()
  })

  it('CA: si el artesano no captura precio, se toma el sugerido por el sistema', async () => {
    const wrapper = await montarCosteo()
    respuestas.put.mockResolvedValue(PIEZA)
    const vm = wrapper.vm as unknown as {
      horas: string
      tarifa: string
      precioFinal: string
      asignarPrecioFinal: () => Promise<void>
    }

    vm.horas = '4'
    vm.tarifa = '50' // sugerido = 200
    vm.precioFinal = ''
    await wrapper.vm.$nextTick()
    await vm.asignarPrecioFinal()

    expect(respuestas.put).toHaveBeenCalledWith('/artesanias/p1/precio', { precioVenta: '200' })
  })
})
