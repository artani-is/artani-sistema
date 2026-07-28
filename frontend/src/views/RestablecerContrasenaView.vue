<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { AlertTriangle, Check, X } from '@lucide/vue'
import AppLogo from '@/components/ui/AppLogo.vue'
import TextileBand from '@/components/ui/TextileBand.vue'
import TextField from '@/components/ui/TextField.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import { useAuthStore } from '@/stores/auth'
import { useSnackbarStore } from '@/stores/snackbar'
import { ApiError } from '@/lib/api'
import { REQUISITOS, contrasenaValida } from '@/lib/contrasena'

/**
 * HU-1: elección de la contraseña nueva a partir del enlace recibido.
 *
 * El token solo se valida al enviarlo: la API no expone ninguna ruta para
 * comprobarlo antes, precisamente para no permitir que se prueben valores.
 */

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const snackbar = useSnackbarStore()

const token = String(route.params.token ?? '')

const contrasena = ref('')
const confirmacion = ref('')
const guardando = ref(false)
const error = ref<string | null>(null)
const sinConexion = ref(false)
/** El enlace resultó inválido, vencido o ya usado: no tiene arreglo desde aquí. */
const enlaceInutilizable = ref(false)
const panelError = ref<HTMLElement | null>(null)

const estadoRequisitos = computed(() =>
  REQUISITOS.map((r) => ({ ...r, ok: r.cumple(contrasena.value) })),
)
const coinciden = computed(
  () => confirmacion.value.length > 0 && contrasena.value === confirmacion.value,
)
const puedeEnviar = computed(
  () => contrasenaValida(contrasena.value) && coinciden.value && !guardando.value,
)

/** El desajuste solo se señala cuando el usuario ya escribió algo en el campo. */
const errorConfirmacion = computed(() =>
  confirmacion.value.length > 0 && !coinciden.value ? 'Las contraseñas no coinciden' : '',
)

async function guardar(): Promise<void> {
  if (!puedeEnviar.value) return
  error.value = null
  sinConexion.value = false
  guardando.value = true
  try {
    await auth.confirmarRecuperacion(token, contrasena.value)
    snackbar.exito('Tu contraseña se actualizó. Ya puedes iniciar sesión.')
    router.push({ name: 'login' })
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) {
      // RNF_011: sin conexión no se declara inválido el enlace, que sigue vigente
      sinConexion.value = true
    } else if (err instanceof ApiError && /no es válido|ya se usó o venció/i.test(err.message)) {
      enlaceInutilizable.value = true
      await nextTick()
      panelError.value?.focus()
    } else {
      error.value =
        err instanceof ApiError ? err.message : 'No se pudo actualizar la contraseña'
    }
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col" :style="{ background: 'var(--cream-100)' }">
    <header class="flex justify-center" :style="{ background: 'var(--green-700)', padding: '20px 40px' }">
      <AppLogo size="sm" on-dark />
    </header>

    <main class="flex flex-1 items-start justify-center px-6 py-12">
      <div class="w-full" :style="{ maxWidth: '460px' }">
        <!-- Enlace inservible: el único camino es pedir uno nuevo -->
        <div
          v-if="enlaceInutilizable"
          ref="panelError"
          tabindex="-1"
          role="alert"
          class="card flex flex-col items-center gap-4 text-center outline-none"
          :style="{ padding: '36px 32px' }"
        >
          <span
            aria-hidden="true"
            class="inline-flex items-center justify-center rounded-full"
            :style="{ width: '56px', height: '56px', background: 'var(--terracotta-100)', color: 'var(--terracotta-700)' }"
          >
            <AlertTriangle :size="28" />
          </span>

          <h1 class="m-0" :style="{ font: '500 26px/1.2 var(--font-serif)', color: 'var(--terracotta-700)' }">
            Este enlace ya no sirve
          </h1>
          <p class="m-0" :style="{ font: '400 16px/1.55 var(--font-sans)', color: 'var(--clay-700)' }">
            Los enlaces de recuperación vencen a los 30 minutos y solo pueden usarse una vez.
            Tu contraseña actual sigue siendo válida.
          </p>

          <div class="mt-2 flex w-full flex-col gap-3">
            <RouterLink :to="{ name: 'recuperar-contrasena' }" class="no-underline">
              <BaseButton variant="primary" size="lg" block>Solicitar un enlace nuevo</BaseButton>
            </RouterLink>
            <RouterLink :to="{ name: 'login' }" class="no-underline">
              <BaseButton variant="ghost" block>Volver al inicio de sesión</BaseButton>
            </RouterLink>
          </div>
        </div>

        <!-- Captura de la contraseña nueva -->
        <form v-else class="flex flex-col gap-6" novalidate @submit.prevent="guardar">
          <div>
            <h1 class="m-0" :style="{ font: '500 32px/1.15 var(--font-serif)', color: 'var(--green-900)' }">
              Elige tu contraseña nueva
            </h1>
            <p class="mt-3" :style="{ font: '400 17px/1.5 var(--font-sans)', color: 'var(--clay-600)' }">
              Con ella entrarás a Artani a partir de ahora.
            </p>
          </div>

          <BaseAlert v-if="sinConexion" tone="warning" @cerrar="sinConexion = false">
            No hay conexión con el servidor. Tu enlace sigue siendo válido: revisa tu internet
            e inténtalo de nuevo.
          </BaseAlert>
          <BaseAlert v-else-if="error" tone="error" @cerrar="error = null">
            {{ error }}
          </BaseAlert>

          <TextField
            v-model="contrasena"
            label="Contraseña nueva"
            type="password"
            placeholder="Escribe tu contraseña"
            required
            :disabled="guardando"
          />

          <!-- Requisitos visibles desde el principio, no solo al fallar -->
          <ul
            class="m-0 flex list-none flex-col gap-2 p-0"
            aria-live="polite"
            :style="{
              background: 'var(--cream-50)',
              border: '1.5px solid var(--cream-300)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
            }"
          >
            <li
              v-for="requisito in estadoRequisitos"
              :key="requisito.clave"
              class="flex items-center gap-2.5"
              :style="{
                font: '400 var(--text-sm)/1.4 var(--font-sans)',
                color: requisito.ok ? 'var(--green-800)' : 'var(--clay-600)',
              }"
            >
              <span
                aria-hidden="true"
                class="inline-flex shrink-0 items-center justify-center rounded-full"
                :style="{
                  width: '18px',
                  height: '18px',
                  background: requisito.ok ? 'var(--green-600)' : 'var(--cream-300)',
                  color: requisito.ok ? 'var(--cream-50)' : 'var(--clay-500)',
                }"
              >
                <Check v-if="requisito.ok" :size="12" />
                <X v-else :size="12" />
              </span>
              <span>{{ requisito.etiqueta }}</span>
              <span class="sr-only">{{ requisito.ok ? '(cumplido)' : '(pendiente)' }}</span>
            </li>
          </ul>

          <TextField
            v-model="confirmacion"
            label="Confirma la contraseña"
            type="password"
            placeholder="Escríbela otra vez"
            required
            :disabled="guardando"
            :error="errorConfirmacion"
          />

          <BaseButton type="submit" variant="primary" size="lg" block :disabled="!puedeEnviar">
            {{ guardando ? 'Guardando…' : 'Guardar contraseña' }}
          </BaseButton>

          <RouterLink
            :to="{ name: 'login' }"
            class="text-center no-underline"
            :style="{ font: '700 var(--text-sm)/1 var(--font-sans)', color: 'var(--green-700)' }"
          >
            Cancelar y volver al inicio de sesión
          </RouterLink>
        </form>
      </div>
    </main>

    <TextileBand :height="10" :gap="4" />
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
