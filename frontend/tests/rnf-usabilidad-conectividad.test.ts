import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AppSnackbar from '@/components/ui/AppSnackbar.vue'
import { useSnackbarStore } from '@/stores/snackbar'
import { api, ApiError } from '@/lib/api'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  // El Snackbar se teletransporta a <body>: se limpia para que el contenido de
  // una prueba no contamine la siguiente.
  document.body.innerHTML = ''
})

describe('RNF_002 · Usabilidad — retroalimentación por Snackbar con «Deshacer»', () => {
  it('una operación exitosa reversible muestra el aviso y el botón Deshacer', async () => {
    const wrapper = mount(AppSnackbar, { attachTo: document.body })
    const snackbar = useSnackbarStore()

    snackbar.exito('Técnica eliminada.', async () => {})
    await wrapper.vm.$nextTick()

    expect(document.body.textContent).toContain('Técnica eliminada.')
    expect(document.body.textContent).toContain('Deshacer')
    wrapper.unmount()
  })

  it('una operación con justificación obligatoria avisa SIN ofrecer Deshacer', async () => {
    const wrapper = mount(AppSnackbar, { attachTo: document.body })
    const snackbar = useSnackbarStore()

    // Las bajas con motivo (compras, artesanías) no ofrecen deshacer
    snackbar.exito('Compra dada de baja.')
    await wrapper.vm.$nextTick()

    expect(document.body.textContent).toContain('Compra dada de baja.')
    expect(document.body.textContent).not.toContain('Deshacer')
    wrapper.unmount()
  })

  it('al pulsar Deshacer se ejecuta la reversión y se confirma al usuario', async () => {
    const wrapper = mount(AppSnackbar, { attachTo: document.body })
    const snackbar = useSnackbarStore()
    const revertir = vi.fn().mockResolvedValue(undefined)

    snackbar.exito('Fotografía eliminada.', revertir)
    await wrapper.vm.$nextTick()
    document.querySelector<HTMLButtonElement>('.snackbar-deshacer')!.click()
    await vi.waitFor(() => expect(revertir).toHaveBeenCalledOnce())

    expect(snackbar.actual?.mensaje).toBe('Listo, se deshizo la acción.')
    wrapper.unmount()
  })

  it('si la reversión falla, se informa el error y no se afirma un éxito falso', async () => {
    const wrapper = mount(AppSnackbar, { attachTo: document.body })
    const snackbar = useSnackbarStore()

    snackbar.exito('Elemento eliminado.', vi.fn().mockRejectedValue(new Error('falló')))
    await wrapper.vm.$nextTick()
    document.querySelector<HTMLButtonElement>('.snackbar-deshacer')!.click()
    await vi.waitFor(() => expect(snackbar.actual?.tono).toBe('error'))

    expect(snackbar.actual?.mensaje).toBe('No se pudo deshacer la acción.')
    wrapper.unmount()
  })

  it('el aviso es accesible a lectores de pantalla (role e aria-live)', async () => {
    const wrapper = mount(AppSnackbar, { attachTo: document.body })
    const snackbar = useSnackbarStore()

    snackbar.exito('Guardado.')
    await wrapper.vm.$nextTick()

    const aviso = document.querySelector('.snackbar')
    expect(aviso?.getAttribute('role')).toBe('status')
    expect(aviso?.getAttribute('aria-live')).toBe('polite')
    wrapper.unmount()
  })

  it('los errores se muestran con la variante de error y sin Deshacer', async () => {
    const wrapper = mount(AppSnackbar, { attachTo: document.body })
    const snackbar = useSnackbarStore()

    snackbar.error('No se puede eliminar: está vinculado a registros activos')
    await wrapper.vm.$nextTick()

    expect(document.querySelector('.snackbar-error')).not.toBeNull()
    expect(document.body.textContent).not.toContain('Deshacer')
    wrapper.unmount()
  })

  it('el aviso se retira solo tras la duración configurada', async () => {
    vi.useFakeTimers()
    const snackbar = useSnackbarStore()

    snackbar.mostrar({ mensaje: 'Temporal', duracion: 6000 })
    expect(snackbar.actual).not.toBeNull()

    vi.advanceTimersByTime(6001)
    expect(snackbar.actual).toBeNull()
    vi.useRealTimers()
  })
})

describe('RNF_011 · Conectividad — mensajes claros sin conexión', () => {
  it('un fallo de red produce un mensaje explicativo en español, no un error técnico', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(api.get('/publico/certificados/x')).rejects.toMatchObject({
      status: 0,
      message: 'No hay conexión con el servidor. Verifica tu conexión a internet',
    })
  })

  it('un error del servidor sin cuerpo JSON produce un mensaje legible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>500</html>', { status: 500 })),
    )

    await expect(api.get('/artesanias')).rejects.toMatchObject({
      status: 500,
      message: 'Ocurrió un error inesperado en el servidor',
    })
  })

  it('el mensaje de error del backend se propaga tal cual al usuario', async () => {
    // Se construye una Response nueva por llamada: su cuerpo solo puede leerse una vez
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'La artesanía no existe' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )

    await expect(api.get('/artesanias/x')).rejects.toBeInstanceOf(ApiError)
    await expect(api.get('/artesanias/x')).rejects.toMatchObject({
      status: 404,
      message: 'La artesanía no existe',
    })
  })
})
