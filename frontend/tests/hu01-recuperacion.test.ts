import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import RecuperarContrasenaView from '@/views/RecuperarContrasenaView.vue'
import RestablecerContrasenaView from '@/views/RestablecerContrasenaView.vue'
import LoginView from '@/views/LoginView.vue'
import { ApiError } from '@/lib/api'

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

function crearRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: { template: '<div/>' } },
      { path: '/login', name: 'login', component: LoginView },
      { path: '/recuperar', name: 'recuperar-contrasena', component: RecuperarContrasenaView },
      {
        path: '/restablecer/:token',
        name: 'restablecer-contrasena',
        component: RestablecerContrasenaView,
      },
    ],
  })
}

async function montar(componente: unknown, ruta: string) {
  const router = crearRouter()
  router.push(ruta)
  await router.isReady()
  const wrapper = mount(componente as never, { global: { plugins: [router] } })
  return { wrapper, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('HU-01 · Vista de solicitud de recuperación', () => {
  it('caso de éxito: envía el correo y muestra la confirmación', async () => {
    apiMock.post.mockResolvedValue({ mensaje: 'ok' })
    const { wrapper } = await montar(RecuperarContrasenaView, '/recuperar')

    await wrapper.find('input[type="email"]').setValue('artesano@artani.mx')
    await wrapper.find('form').trigger('submit.prevent')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Revisa tu correo'))

    expect(apiMock.post).toHaveBeenCalledWith('/auth/recuperacion', {
      correo: 'artesano@artani.mx',
    })
    // El formulario se sustituye por el resultado
    expect(wrapper.find('input[type="email"]').exists()).toBe(false)
  })

  it('CA: la confirmación no afirma que la cuenta exista', async () => {
    apiMock.post.mockResolvedValue({ mensaje: 'ok' })
    const { wrapper } = await montar(RecuperarContrasenaView, '/recuperar')

    await wrapper.find('input[type="email"]').setValue('quiensea@artani.mx')
    await wrapper.find('form').trigger('submit.prevent')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Revisa tu correo'))

    // Se mantiene la discreción del backend: condicional, nunca afirmativo
    expect(wrapper.text()).toMatch(/Si .*corresponde a una cuenta registrada/i)
    expect(wrapper.text()).not.toMatch(/te enviamos un enlace a tu cuenta/i)
    // Y se informa la vigencia y el uso único
    expect(wrapper.text()).toContain('30 minutos')
    expect(wrapper.text()).toMatch(/una sola vez|una vez/i)
  })

  it('el botón permanece deshabilitado mientras el correo no sea válido', async () => {
    const { wrapper } = await montar(RecuperarContrasenaView, '/recuperar')
    const boton = wrapper.find('button[type="submit"]')

    expect(boton.attributes('disabled')).toBeDefined()

    await wrapper.find('input[type="email"]').setValue('esto-no-es-correo')
    expect(boton.attributes('disabled')).toBeDefined()

    await wrapper.find('input[type="email"]').setValue('artesano@artani.mx')
    expect(boton.attributes('disabled')).toBeUndefined()
  })

  it('RNF_011 (caso de fallo): un fallo de red se comunica como tal, no como dato inválido', async () => {
    apiMock.post.mockRejectedValue(
      new ApiError(0, 'No hay conexión con el servidor. Verifica tu conexión a internet'),
    )
    const { wrapper } = await montar(RecuperarContrasenaView, '/recuperar')

    await wrapper.find('input[type="email"]').setValue('artesano@artani.mx')
    await wrapper.find('form').trigger('submit.prevent')
    await vi.waitFor(() => expect(wrapper.text()).toMatch(/No hay conexión/i))

    // No se declara el envío como hecho
    expect(wrapper.text()).not.toContain('Revisa tu correo')
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
  })

  it('«Usar otro correo» devuelve al formulario', async () => {
    apiMock.post.mockResolvedValue({ mensaje: 'ok' })
    const { wrapper } = await montar(RecuperarContrasenaView, '/recuperar')

    await wrapper.find('input[type="email"]').setValue('artesano@artani.mx')
    await wrapper.find('form').trigger('submit.prevent')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Revisa tu correo'))

    const otro = wrapper.findAll('button').find((b) => b.text().includes('Usar otro correo'))!
    await otro.trigger('click')

    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
  })
})

describe('HU-01 · Vista de nueva contraseña', () => {
  const RUTA = '/restablecer/token-de-prueba'

  it('caso de éxito: envía token y contraseña, y regresa al inicio de sesión', async () => {
    apiMock.post.mockResolvedValue({ mensaje: 'ok' })
    const { wrapper, router } = await montar(RestablecerContrasenaView, RUTA)
    const push = vi.spyOn(router, 'push')

    const campos = wrapper.findAll('input[type="password"]')
    await campos[0]!.setValue('MiNuevaClave2026')
    await campos[1]!.setValue('MiNuevaClave2026')
    await wrapper.find('form').trigger('submit.prevent')
    await vi.waitFor(() => expect(apiMock.post).toHaveBeenCalled())

    expect(apiMock.post).toHaveBeenCalledWith('/auth/recuperacion/confirmar', {
      token: 'token-de-prueba',
      contrasena: 'MiNuevaClave2026',
    })
    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })

  it('CA: los requisitos se muestran desde el inicio y se marcan al cumplirse', async () => {
    const { wrapper } = await montar(RestablecerContrasenaView, RUTA)

    // Visibles antes de escribir nada
    expect(wrapper.text()).toContain('Al menos 12 caracteres')
    expect(wrapper.text()).toContain('Incluye al menos un número')
    expect(wrapper.text()).toContain('(pendiente)')

    await wrapper.findAll('input[type="password"]')[0]!.setValue('MiNuevaClave2026')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('(cumplido)')
    expect(wrapper.text()).not.toContain('(pendiente)')
  })

  it('el envío está bloqueado hasta que la contraseña es válida y coincide', async () => {
    const { wrapper } = await montar(RestablecerContrasenaView, RUTA)
    const boton = wrapper.find('button[type="submit"]')
    const campos = wrapper.findAll('input[type="password"]')

    expect(boton.attributes('disabled')).toBeDefined()

    await campos[0]!.setValue('corta1')
    expect(boton.attributes('disabled')).toBeDefined()

    await campos[0]!.setValue('MiNuevaClave2026')
    expect(boton.attributes('disabled')).toBeDefined() // falta confirmar

    await campos[1]!.setValue('OtraDistinta2026')
    await wrapper.vm.$nextTick()
    expect(boton.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Las contraseñas no coinciden')

    await campos[1]!.setValue('MiNuevaClave2026')
    await wrapper.vm.$nextTick()
    expect(boton.attributes('disabled')).toBeUndefined()
  })

  it('CA (caso de fallo): un enlace vencido o usado ofrece pedir uno nuevo', async () => {
    apiMock.post.mockRejectedValue(
      new ApiError(400, 'El enlace de recuperación no es válido, ya se usó o venció. Solicita uno nuevo'),
    )
    const { wrapper } = await montar(RestablecerContrasenaView, RUTA)

    const campos = wrapper.findAll('input[type="password"]')
    await campos[0]!.setValue('MiNuevaClave2026')
    await campos[1]!.setValue('MiNuevaClave2026')
    await wrapper.find('form').trigger('submit.prevent')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Este enlace ya no sirve'))

    expect(wrapper.text()).toContain('Solicitar un enlace nuevo')
    // Se tranquiliza al usuario: no perdió el acceso
    expect(wrapper.text()).toMatch(/contraseña actual sigue siendo válida/i)
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('RNF_011 (caso de fallo): sin conexión NO se declara inservible el enlace', async () => {
    apiMock.post.mockRejectedValue(
      new ApiError(0, 'No hay conexión con el servidor. Verifica tu conexión a internet'),
    )
    const { wrapper } = await montar(RestablecerContrasenaView, RUTA)

    const campos = wrapper.findAll('input[type="password"]')
    await campos[0]!.setValue('MiNuevaClave2026')
    await campos[1]!.setValue('MiNuevaClave2026')
    await wrapper.find('form').trigger('submit.prevent')
    await vi.waitFor(() => expect(wrapper.text()).toMatch(/No hay conexión/i))

    expect(wrapper.text()).not.toContain('Este enlace ya no sirve')
    expect(wrapper.text()).toMatch(/enlace sigue siendo válido/i)
    // El formulario sigue disponible para reintentar
    expect(wrapper.find('form').exists()).toBe(true)
  })
})

describe('HU-01 · Acceso al flujo desde el inicio de sesión', () => {
  it('«¿Olvidaste tu contraseña?» enlaza a la pantalla de recuperación', async () => {
    const { wrapper } = await montar(LoginView, '/login')

    const enlace = wrapper.findAll('a').find((a) => a.text().includes('¿Olvidaste tu contraseña?'))
    expect(enlace, 'no se encontró el enlace de recuperación').toBeDefined()
    expect(enlace!.attributes('href')).toBe('/recuperar')
  })
})
