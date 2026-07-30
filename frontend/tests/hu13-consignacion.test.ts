import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DOMWrapper, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import ArtesaniaDetalleView from '@/views/ArtesaniaDetalleView.vue'

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
  fechaRegistro: '2026-05-02',
  horasTrabajadas: null,
  tarifaHora: null,
  precioVenta: '1850',
  fotos: [],
  insumos: [],
  certificado: null,
  venta: null,
  consignaciones: [],
  tecnica: { idTecnica: 't1', nombre: 'Barro negro', descripcion: null },
  categoria: { idCategoria: 'c1', nombre: 'Jarrón' },
}

const GALERIAS = [{ idGaleria: 'g1', nombre: 'Galería Quetzalli' }]

/**
 * El modal se teletransporta a <body>, fuera del árbol del wrapper: se acota por
 * su `role="dialog"` para no confundirlo con los controles de la ficha, que
 * llevan las mismas etiquetas.
 */
function dialogo(): HTMLElement {
  const nodo = document.body.querySelector('[role="dialog"]')
  expect(nodo, 'el modal no está abierto').not.toBeNull()
  return nodo as HTMLElement
}

function textoDelModal(): string {
  return document.body.querySelector('[role="dialog"]')?.textContent ?? ''
}

function botonDelModal(patron: RegExp): HTMLButtonElement {
  const boton = [...dialogo().querySelectorAll('button')].find((b) =>
    patron.test(b.textContent?.trim() ?? ''),
  )
  expect(boton, `no se encontró el botón ${patron} dentro del modal`).toBeDefined()
  return boton as HTMLButtonElement
}

async function montarDetalle(): Promise<VueWrapper> {
  respuestas.get.mockImplementation((ruta: string) => {
    if (ruta === '/catalogos/galerias') return Promise.resolve(GALERIAS)
    if (ruta.startsWith('/artesanias/')) return Promise.resolve(PIEZA)
    return Promise.resolve([])
  })

  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/artesanias', name: 'artesanias', component: { template: '<div/>' } },
      { path: '/artesanias/:id', name: 'artesania-detalle', component: ArtesaniaDetalleView },
      { path: '/artesanias/:id/editar', name: 'artesania-editar', component: { template: '<div/>' } },
      { path: '/artesanias/:id/costeo', name: 'artesania-costeo', component: { template: '<div/>' } },
      { path: '/verificar/:id', name: 'verificacion-publica', component: { template: '<div/>' } },
    ],
  })
  router.push('/artesanias/p1')
  await router.isReady()
  const wrapper = mount(ArtesaniaDetalleView, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await vi.waitFor(() => expect(wrapper.text()).toContain('Jarrón ceremonial'))
  return wrapper
}

/** Abre el modal de consignación pulsando su acción en la ficha. */
async function abrirModalConsignacion(wrapper: VueWrapper): Promise<void> {
  const accion = wrapper.findAll('button').find((b) => /enviar a consignación/i.test(b.text()))
  expect(accion, 'no se encontró la acción «Enviar a consignación»').toBeDefined()
  await accion!.trigger('click')
  await vi.waitFor(() => expect(textoDelModal()).toContain('Galería receptora'))
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('HU-13 · Registro de salida a consignación (vista de la pieza)', () => {
  it('CA: el formulario pide la galería receptora del catálogo maestro', async () => {
    const wrapper = await montarDetalle()
    await abrirModalConsignacion(wrapper)

    const opciones = [...dialogo().querySelectorAll('option')].map((o) => o.textContent)
    expect(opciones).toContain('Galería Quetzalli')
    wrapper.unmount()
  })

  it('el formulario NO pide comisión: no la consume ningún proceso del sistema', async () => {
    const wrapper = await montarDetalle()
    await abrirModalConsignacion(wrapper)

    expect(textoDelModal()).not.toMatch(/comisi[óo]n/i)
    expect(textoDelModal()).not.toMatch(/ingreso neto/i)
    wrapper.unmount()
  })

  it('el envío a consignación solo transmite la galería elegida', async () => {
    respuestas.post.mockResolvedValue({
      idConsignacion: 'k1',
      idGaleria: 'g1',
      galeria: { idGaleria: 'g1', nombre: 'Galería Quetzalli' },
    })
    const wrapper = await montarDetalle()
    await abrirModalConsignacion(wrapper)

    const select = dialogo().querySelector('select') as HTMLSelectElement
    await new DOMWrapper(select).setValue('g1')

    botonDelModal(/^Enviar a consignación$/i).click()
    await vi.waitFor(() => expect(respuestas.post).toHaveBeenCalledOnce())

    const [ruta, cuerpo] = respuestas.post.mock.calls[0]!
    expect(ruta).toBe('/artesanias/p1/consignacion')
    expect(cuerpo).toEqual({ idGaleria: 'g1' })
    expect(cuerpo).not.toHaveProperty('porcentajeComision')
    wrapper.unmount()
  })

  it('CA (caso de fallo): sin galería no se envía nada y se explica el motivo', async () => {
    const wrapper = await montarDetalle()
    await abrirModalConsignacion(wrapper)

    botonDelModal(/^Enviar a consignación$/i).click()
    await vi.waitFor(() => expect(textoDelModal()).toMatch(/elige la galería/i))

    expect(respuestas.post).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
