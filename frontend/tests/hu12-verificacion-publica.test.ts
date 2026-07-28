import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import VerificacionPublicaView from '@/views/VerificacionPublicaView.vue'
import { ApiError } from '@/lib/api'

const apiMock = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('@/lib/api', async () => {
  const real = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...real, api: apiMock }
})

const CERTIFICADO = {
  idCertificado: 'a66cddb2-52e6-4e3d-a6fe-0ffbd80320d9',
  fechaEmision: '2026-04-12T10:00:00.000Z',
  estado: 'VALIDO',
  pieza: {
    nombre: 'Jarrón ceremonial',
    descripcion: 'Pieza torneada a mano',
    tecnica: 'Barro negro',
    categoria: 'Jarrón',
    foto: '/uploads/foto.png',
  },
  artesano: { nombre: 'Fernando Artesano Hule', taller: 'Taller El Árbol del Hule' },
}

async function montarVerificacion() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/verificar/:id', name: 'verificacion', component: VerificacionPublicaView },
    ],
  })
  router.push('/verificar/a66cddb2-52e6-4e3d-a6fe-0ffbd80320d9')
  await router.isReady()
  return mount(VerificacionPublicaView, { global: { plugins: [router] } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('HU-12 · Verificación pública (vista del comprador)', () => {
  it('CA (caso de éxito): muestra la ficha oficial sin requerir inicio de sesión', async () => {
    apiMock.get.mockResolvedValue(CERTIFICADO)

    const wrapper = await montarVerificacion()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Jarrón ceremonial'))

    // No hay token en el almacenamiento: la vista funciona anónima
    expect(localStorage.getItem('artani_token')).toBeNull()
    expect(wrapper.text()).toContain('Barro negro')
    expect(wrapper.text()).toContain('Fernando Artesano Hule')
    expect(wrapper.text()).toContain('Taller El Árbol del Hule')
  })

  it('CA (caso de fallo): un código inexistente muestra un mensaje claro de no verificable', async () => {
    apiMock.get.mockRejectedValue(
      new ApiError(404, 'El certificado no pudo verificarse: no corresponde a ninguna pieza registrada'),
    )

    const wrapper = await montarVerificacion()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Certificado inválido'))

    expect(wrapper.text()).toContain('no corresponde a ninguna pieza registrada')
    expect(wrapper.text()).toContain('No verificado')
    // No debe presentar datos de ninguna pieza
    expect(wrapper.text()).not.toContain('Jarrón ceremonial')
  })

  it('CA: una pieza dada de baja se muestra como tal, no como certificado inexistente', async () => {
    apiMock.get.mockResolvedValue({ ...CERTIFICADO, estado: 'BAJA' })

    const wrapper = await montarVerificacion()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Jarrón ceremonial'))

    // La pieza sigue siendo auténtica: se informa el cambio de situación
    expect(wrapper.text()).toMatch(/baja|retirada|ya no/i)
    expect(wrapper.text()).not.toMatch(/no pudo verificarse/i)
  })

  it('CA: la bitácora de verificaciones NO se expone al comprador', async () => {
    apiMock.get.mockResolvedValue(CERTIFICADO)

    const wrapper = await montarVerificacion()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Jarrón ceremonial'))

    expect(wrapper.text()).not.toMatch(/verificaciones|bitácora|escaneos/i)
  })

  it('RNF_011: sin conexión la vista informa el fallo, pero NO lo distingue de un código inválido', async () => {
    apiMock.get.mockRejectedValue(
      new ApiError(0, 'No hay conexión con el servidor. Verifica tu conexión a internet'),
    )

    const wrapper = await montarVerificacion()
    await vi.waitFor(() => expect(wrapper.text()).not.toContain('Verificando certificado…'))

    // La vista no queda en carga indefinida ni en blanco: sí hay retroalimentación
    expect(wrapper.text().trim().length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('Certificado inválido')

    // HALLAZGO: el `catch` de la vista descarta el mensaje del cliente HTTP y
    // presenta el mismo estado que un código inexistente. Un problema de red se
    // comunica como «La pieza podría no ser auténtica», lo que induce a error.
    // El mensaje específico de conectividad sí lo produce la capa `api`
    // (ver rnf-usabilidad-conectividad.test.ts) pero no llega a esta pantalla.
    expect(wrapper.text()).not.toMatch(/conexión/i)
    expect(wrapper.text()).toContain('podría')
  })
})
