import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import ArtesaniasView from '@/views/ArtesaniasView.vue'
import AjustesView from '@/views/AjustesView.vue'
import { useArtesaniasStore } from '@/stores/artesanias'
import { useAuthStore } from '@/stores/auth'

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  subirArchivos: vi.fn(),
}))

vi.mock('@/lib/api', async () => {
  const real = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...real, api: apiMock }
})

const PIEZAS = [
  { idArtesania: 'p1', nombre: 'Disponible', estado: 'DISPONIBLE', tecnica: { idTecnica: 't1', nombre: 'Barro negro' }, categoria: { idCategoria: 'c1', nombre: 'Jarrón' }, fotos: [], precioVenta: null },
  { idArtesania: 'p2', nombre: 'Consignada', estado: 'EN_CONSIGNACION', tecnica: { idTecnica: 't1', nombre: 'Barro negro' }, categoria: { idCategoria: 'c1', nombre: 'Jarrón' }, fotos: [], precioVenta: null },
  { idArtesania: 'p3', nombre: 'Vendida', estado: 'VENDIDA', tecnica: { idTecnica: 't1', nombre: 'Barro negro' }, categoria: { idCategoria: 'c1', nombre: 'Jarrón' }, fotos: [], precioVenta: '1500' },
]

function crearRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/artesanias', name: 'artesanias', component: ArtesaniasView },
      { path: '/artesanias/nueva', name: 'artesania-nueva', component: { template: '<div/>' } },
      { path: '/artesanias/:id', name: 'artesania-detalle', component: { template: '<div/>' } },
      { path: '/artesanias/:id/editar', name: 'artesania-editar', component: { template: '<div/>' } },
      { path: '/ajustes', name: 'ajustes', component: AjustesView },
    ],
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('HU-15 · Filtrado automático de piezas disponibles', () => {
  it('CA: el conteo de disponibles refleja únicamente las piezas en ese estado', async () => {
    apiMock.get.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/artesanias')) return Promise.resolve(PIEZAS)
      return Promise.resolve([])
    })

    const router = crearRouter()
    router.push('/artesanias')
    await router.isReady()
    const wrapper = mount(ArtesaniasView, { global: { plugins: [router] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Disponible'))

    const vm = wrapper.vm as unknown as { disponibles: number }
    // De las 3 piezas, solo una está DISPONIBLE
    expect(vm.disponibles).toBe(1)
  })

  it('CA: el filtro de estado se envía al backend como parámetro de consulta', async () => {
    apiMock.get.mockResolvedValue([PIEZAS[0]])
    const store = useArtesaniasStore()

    store.filtros.estado = 'DISPONIBLE'
    await store.cargar()

    expect(apiMock.get).toHaveBeenCalledWith('/artesanias?estado=DISPONIBLE')
    expect(store.artesanias).toHaveLength(1)
  })

  it('CA: restablecer los filtros recarga el listado completo sin recargar la página', async () => {
    apiMock.get.mockResolvedValue(PIEZAS)

    const router = crearRouter()
    router.push('/artesanias')
    await router.isReady()
    const wrapper = mount(ArtesaniasView, { global: { plugins: [router] } })
    await vi.waitFor(() => expect(apiMock.get).toHaveBeenCalled())

    const store = useArtesaniasStore()
    store.filtros.estado = 'VENDIDA'
    store.filtros.busqueda = 'jarrón'
    await wrapper.vm.$nextTick()

    const vm = wrapper.vm as unknown as { hayFiltros: boolean; limpiarFiltros: () => void }
    expect(vm.hayFiltros).toBe(true)

    apiMock.get.mockClear()
    vm.limpiarFiltros()
    await wrapper.vm.$nextTick()

    // Todos los filtros vuelven a su opción general y se recarga por API (sin recarga de página)
    expect(store.filtros).toEqual({ busqueda: '', estado: '', idTecnica: '', idCategoria: '' })
    expect(vm.hayFiltros).toBe(false)
    expect(apiMock.get).toHaveBeenCalledWith('/artesanias')
  })

  it('la combinación de filtros se traduce en una sola consulta con todos los parámetros', async () => {
    apiMock.get.mockResolvedValue([])
    const store = useArtesaniasStore()

    store.filtros.busqueda = 'jarrón'
    store.filtros.estado = 'DISPONIBLE'
    store.filtros.idTecnica = 't1'
    await store.cargar()

    const ruta = apiMock.get.mock.calls.at(-1)![0] as string
    expect(ruta).toContain('busqueda=jarr')
    expect(ruta).toContain('estado=DISPONIBLE')
    expect(ruta).toContain('idTecnica=t1')
  })
})

describe('HU-17 · Actualización de perfil y datos del taller', () => {
  const PERFIL = {
    idArtesano: 'a1',
    nombres: 'Fernando',
    apellidoPaterno: 'Artesano',
    apellidoMaterno: 'Hule',
    correo: 'artesano@artani.mx',
    telefono: '9510000000',
    nombreTaller: 'Taller El Árbol del Hule',
  }

  async function montarAjustes() {
    apiMock.get.mockResolvedValue(PERFIL)
    const router = crearRouter()
    router.push('/ajustes')
    await router.isReady()
    const wrapper = mount(AjustesView, { global: { plugins: [router] } })
    await vi.waitFor(() => expect(apiMock.get).toHaveBeenCalledWith('/auth/me'))
    await wrapper.vm.$nextTick()
    return wrapper
  }

  it('caso de éxito: carga el perfil y envía los campos editables', async () => {
    const wrapper = await montarAjustes()
    apiMock.put.mockResolvedValue({ ...PERFIL, nombreTaller: 'Taller Artani del Valle' })
    const vm = wrapper.vm as unknown as {
      nombreTaller: string
      guardar: () => Promise<void>
    }

    vm.nombreTaller = 'Taller Artani del Valle'
    await vm.guardar()

    expect(apiMock.put).toHaveBeenCalledWith(
      '/auth/perfil',
      expect.objectContaining({ nombreTaller: 'Taller Artani del Valle', nombres: 'Fernando' }),
    )
  })

  it('CA: el correo NO se envía en la actualización (no es editable)', async () => {
    const wrapper = await montarAjustes()
    apiMock.put.mockResolvedValue(PERFIL)
    const vm = wrapper.vm as unknown as { guardar: () => Promise<void> }

    await vm.guardar()

    const enviado = apiMock.put.mock.calls.at(-1)![1] as Record<string, unknown>
    expect(enviado).not.toHaveProperty('correo')
  })

  it('CA: los cambios se reflejan de inmediato en la sesión, sin cerrar sesión', async () => {
    const wrapper = await montarAjustes()
    const auth = useAuthStore()
    const actualizado = { ...PERFIL, nombreTaller: 'Taller Artani del Valle' }
    apiMock.put.mockResolvedValue(actualizado)
    const vm = wrapper.vm as unknown as { nombreTaller: string; guardar: () => Promise<void> }

    vm.nombreTaller = 'Taller Artani del Valle'
    await vm.guardar()

    // El store de sesión queda sincronizado sin necesidad de reautenticarse
    expect(auth.artesano?.nombreTaller).toBe('Taller Artani del Valle')
  })

  it('caso de fallo: nombre o apellido vacíos se rechazan sin llamar a la API', async () => {
    const wrapper = await montarAjustes()
    const vm = wrapper.vm as unknown as {
      nombres: string
      error: string | null
      guardar: () => Promise<void>
    }

    vm.nombres = '   '
    await vm.guardar()

    expect(vm.error).toMatch(/obligatorios/i)
    expect(apiMock.put).not.toHaveBeenCalled()
  })
})
