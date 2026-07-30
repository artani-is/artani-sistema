import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import ArtesaniaDetalleView from '@/views/ArtesaniaDetalleView.vue'
import { ApiError } from '@/lib/api'

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

const CERTIFICADO = {
  idCertificado: 'a66cddb2-52e6-4e3d-a6fe-0ffbd80320d9',
  fechaEmision: '2026-05-10T18:00:00.000Z',
  rutaPdf: '/uploads/certificados/a66cddb2.pdf',
  idArtesania: 'p1',
  _count: { verificaciones: 3 },
}

const PIEZA = {
  idArtesania: 'p1',
  nombre: 'Jarrón ceremonial',
  descripcion: null,
  estado: 'DISPONIBLE',
  fechaRegistro: '2026-05-02',
  horasTrabajadas: null,
  tarifaHora: null,
  precioVenta: '1850',
  fotos: [{ idFoto: 'f1', rutaWebp: '/uploads/a.webp', rutaJpeg: '/uploads/a.jpg', esPrincipal: true, fechaCarga: '2026-05-03', idArtesania: 'p1' }],
  insumos: [],
  certificado: CERTIFICADO,
  venta: null,
  consignaciones: [],
  tecnica: { idTecnica: 't1', nombre: 'Barro negro', descripcion: null },
  categoria: { idCategoria: 'c1', nombre: 'Jarrón' },
}

/** La API devuelve la bitácora de la más reciente a la más antigua. */
const VERIFICACIONES = [
  { idVerificacion: 'v3', fechaHora: '2026-07-20T21:45:00.000Z', idCertificado: CERTIFICADO.idCertificado },
  { idVerificacion: 'v2', fechaHora: '2026-06-14T17:05:00.000Z', idCertificado: CERTIFICADO.idCertificado },
  { idVerificacion: 'v1', fechaHora: '2026-05-11T15:30:00.000Z', idCertificado: CERTIFICADO.idCertificado },
]

/** El modal se teletransporta a <body>, fuera del árbol del wrapper. */
function textoDelModal(): string {
  return document.body.querySelector('[role="dialog"]')?.textContent ?? ''
}

async function montarDetalle(): Promise<VueWrapper> {
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

async function abrirHistorial(wrapper: VueWrapper): Promise<void> {
  const boton = wrapper.findAll('button').find((b) => /historial de escaneos/i.test(b.text()))
  expect(boton, 'no se encontró la acción «Ver historial de escaneos»').toBeDefined()
  await boton!.trigger('click')
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  document.body.innerHTML = ''
  respuestas.get.mockImplementation((ruta: string) => {
    if (ruta === '/catalogos/galerias') return Promise.resolve([])
    if (ruta.endsWith('/certificado')) return Promise.resolve({ ...CERTIFICADO, verificaciones: VERIFICACIONES })
    if (ruta.startsWith('/artesanias/')) return Promise.resolve(PIEZA)
    return Promise.resolve([])
  })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('HU-12 · Bitácora de verificaciones visible para el artesano', () => {
  it('CA: el historial muestra cada verificación con su fecha y hora', async () => {
    const wrapper = await montarDetalle()
    await abrirHistorial(wrapper)
    await vi.waitFor(() => expect(textoDelModal()).toMatch(/3 verificaciones registradas/i))

    // Se consulta el certificado de la pieza, que es quien devuelve la bitácora
    expect(respuestas.get).toHaveBeenCalledWith('/artesanias/p1/certificado')

    const texto = textoDelModal()
    // Fecha y hora de cada escaneo, en español mexicano (RNF_014)
    expect(texto).toMatch(/20 de julio de 2026/i)
    expect(texto).toMatch(/14 de junio de 2026/i)
    expect(texto).toMatch(/11 de mayo de 2026/i)
    expect(texto).toMatch(/\d{1,2}:\d{2}/)
    wrapper.unmount()
  })

  it('CA: la bitácora se declara privada del artesano', async () => {
    const wrapper = await montarDetalle()
    await abrirHistorial(wrapper)
    await vi.waitFor(() => expect(textoDelModal()).toMatch(/3 verificaciones/i))

    expect(textoDelModal()).toMatch(/solo lo ves tú/i)
    expect(textoDelModal()).toMatch(/no lo muestra al comprador/i)
    wrapper.unmount()
  })

  it('un certificado sin escaneos lo explica en lugar de mostrar una lista vacía', async () => {
    respuestas.get.mockImplementation((ruta: string) => {
      if (ruta === '/catalogos/galerias') return Promise.resolve([])
      if (ruta.endsWith('/certificado')) return Promise.resolve({ ...CERTIFICADO, verificaciones: [] })
      if (ruta.startsWith('/artesanias/')) return Promise.resolve(PIEZA)
      return Promise.resolve([])
    })
    const wrapper = await montarDetalle()
    await abrirHistorial(wrapper)
    await vi.waitFor(() => expect(textoDelModal()).toMatch(/todavía nadie ha escaneado/i))

    expect(textoDelModal()).not.toMatch(/verificaciones registradas/i)
    wrapper.unmount()
  })

  it('caso de fallo: si el historial no puede cargarse se informa el error', async () => {
    respuestas.get.mockImplementation((ruta: string) => {
      if (ruta === '/catalogos/galerias') return Promise.resolve([])
      if (ruta.endsWith('/certificado')) {
        return Promise.reject(new ApiError(0, 'No hay conexión con el servidor. Verifica tu conexión a internet'))
      }
      if (ruta.startsWith('/artesanias/')) return Promise.resolve(PIEZA)
      return Promise.resolve([])
    })
    const wrapper = await montarDetalle()
    await abrirHistorial(wrapper)
    await vi.waitFor(() => expect(textoDelModal()).toMatch(/no hay conexión/i))

    // No se afirma que no haya escaneos cuando en realidad no se pudo consultar
    expect(textoDelModal()).not.toMatch(/todavía nadie ha escaneado/i)
    wrapper.unmount()
  })

  it('una pieza sin certificado emitido no ofrece el historial', async () => {
    respuestas.get.mockImplementation((ruta: string) => {
      if (ruta === '/catalogos/galerias') return Promise.resolve([])
      if (ruta.startsWith('/artesanias/')) return Promise.resolve({ ...PIEZA, certificado: null })
      return Promise.resolve([])
    })
    const wrapper = await montarDetalle()

    const boton = wrapper.findAll('button').find((b) => /historial de escaneos/i.test(b.text()))
    expect(boton).toBeUndefined()
    wrapper.unmount()
  })
})
