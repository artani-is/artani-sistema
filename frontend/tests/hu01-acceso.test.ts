import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/views/LoginView.vue'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/lib/api'

/** Router mínimo para que LoginView pueda resolver `useRoute`/`useRouter`. */
function crearRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: { template: '<div>panel</div>' } },
      { path: '/login', name: 'login', component: LoginView },
    ],
  })
}

async function montarLogin() {
  const router = crearRouter()
  router.push('/login')
  await router.isReady()
  const wrapper = mount(LoginView, { global: { plugins: [router] } })
  return { wrapper, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('HU-01 · Acceso al sistema — vista de inicio de sesión', () => {
  it('caso de éxito: envía las credenciales y redirige al panel', async () => {
    const { wrapper, router } = await montarLogin()
    const auth = useAuthStore()
    const iniciarSesion = vi
      .spyOn(auth, 'iniciarSesion')
      .mockResolvedValue(undefined)
    const push = vi.spyOn(router, 'push')

    await wrapper.find('input[type="email"]').setValue('artesano@artani.mx')
    await wrapper.find('input[type="password"]').setValue('Artani#2026')
    await wrapper.find('form').trigger('submit.prevent')
    await vi.waitFor(() => expect(iniciarSesion).toHaveBeenCalled())

    expect(iniciarSesion).toHaveBeenCalledWith('artesano@artani.mx', 'Artani#2026', true)
    expect(push).toHaveBeenCalledWith('/')
  })

  it('caso de fallo: credenciales inválidas muestran el mensaje genérico y no redirigen', async () => {
    const { wrapper, router } = await montarLogin()
    const auth = useAuthStore()
    vi.spyOn(auth, 'iniciarSesion').mockImplementation(async () => {
      auth.error = 'Correo o contraseña incorrectos'
      throw new ApiError(401, 'Correo o contraseña incorrectos')
    })
    const push = vi.spyOn(router, 'push')

    await wrapper.find('input[type="email"]').setValue('artesano@artani.mx')
    await wrapper.find('input[type="password"]').setValue('incorrecta')
    await wrapper.find('form').trigger('submit.prevent')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Correo o contraseña incorrectos'))

    // CA: el mensaje no revela cuál de los dos campos falló
    expect(wrapper.text()).not.toMatch(/correo no (existe|registrado)/i)
    expect(wrapper.text()).not.toMatch(/contraseña incorrecta para/i)
    expect(push).not.toHaveBeenCalled()
  })

  it('caso de fallo: el bloqueo por intentos se muestra al usuario', async () => {
    const { wrapper } = await montarLogin()
    const auth = useAuthStore()
    vi.spyOn(auth, 'iniciarSesion').mockImplementation(async () => {
      auth.error = 'Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en 15 minutos'
      throw new ApiError(423, 'bloqueada')
    })

    await wrapper.find('form').trigger('submit.prevent')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Cuenta bloqueada temporalmente'))
    expect(wrapper.text()).toContain('15 minutos')
  })

  it('el botón refleja el estado de carga mientras se verifica', async () => {
    const { wrapper } = await montarLogin()
    const auth = useAuthStore()
    auth.cargando = true
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Verificando…')
  })
})

describe('HU-01 · Store de autenticación', () => {
  it('caso de éxito: guarda token y artesano, y queda autenticado', async () => {
    const auth = useAuthStore()
    const sesion = {
      token: 'jwt-de-prueba',
      artesano: {
        idArtesano: 'a1',
        nombres: 'Fernando',
        apellidoPaterno: 'Artesano',
        apellidoMaterno: 'Hule',
        correo: 'artesano@artani.mx',
        nombreTaller: 'Taller El Árbol del Hule',
      },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(sesion), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      ),
    )

    await auth.iniciarSesion('artesano@artani.mx', 'Artani#2026', true)

    expect(auth.autenticado).toBe(true)
    expect(auth.token).toBe('jwt-de-prueba')
    expect(auth.nombreCompleto).toBe('Fernando Artesano')
    expect(localStorage.getItem('artani_token')).toBe('jwt-de-prueba')
  })

  it('«recordar sesión» desactivado guarda el token solo en sessionStorage', async () => {
    const auth = useAuthStore()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ token: 't', artesano: { idArtesano: 'a', nombres: 'F', apellidoPaterno: 'A', apellidoMaterno: null, correo: 'c@d.mx', nombreTaller: null } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await auth.iniciarSesion('c@d.mx', 'x', false)

    expect(sessionStorage.getItem('artani_token')).toBe('t')
    expect(localStorage.getItem('artani_token')).toBeNull()
  })

  it('caso de fallo: un 401 deja el error a la vista y no autentica', async () => {
    const auth = useAuthStore()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Correo o contraseña incorrectos' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(auth.iniciarSesion('x@y.mx', 'mala')).rejects.toThrow()
    expect(auth.autenticado).toBe(false)
    expect(auth.error).toBe('Correo o contraseña incorrectos')
  })

  it('cerrar sesión limpia token y datos almacenados', async () => {
    const auth = useAuthStore()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ token: 't', artesano: { idArtesano: 'a', nombres: 'F', apellidoPaterno: 'A', apellidoMaterno: null, correo: 'c@d.mx', nombreTaller: null } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    await auth.iniciarSesion('c@d.mx', 'x')

    auth.cerrarSesion()

    expect(auth.autenticado).toBe(false)
    expect(localStorage.getItem('artani_token')).toBeNull()
    expect(sessionStorage.getItem('artani_artesano')).toBeNull()
  })
})
