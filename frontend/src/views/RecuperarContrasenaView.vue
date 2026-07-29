<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft, MailCheck } from '@lucide/vue'
import AppLogo from '@/components/ui/AppLogo.vue'
import TextileBand from '@/components/ui/TextileBand.vue'
import TextField from '@/components/ui/TextField.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/lib/api'

/**
 * HU-1: solicitud del enlace de recuperación.
 *
 * La API responde lo mismo exista o no la cuenta, para no revelar qué correos
 * están registrados; esta pantalla mantiene esa discreción y nunca afirma que
 * el correo exista.
 */

const auth = useAuthStore()

const correo = ref('')
const enviando = ref(false)
const enviado = ref(false)
const error = ref<string | null>(null)
const sinConexion = ref(false)
const panelExito = ref<HTMLElement | null>(null)

const correoValido = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.value.trim()))

async function enviar(): Promise<void> {
  if (!correoValido.value || enviando.value) return
  error.value = null
  sinConexion.value = false
  enviando.value = true
  try {
    await auth.solicitarRecuperacion(correo.value.trim())
    enviado.value = true
    // El resultado sustituye al formulario: se lleva el foco para que quien usa
    // lector de pantalla o teclado no quede en un control que ya no existe.
    await nextTick()
    panelExito.value?.focus()
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) {
      // RNF_011: un problema de red se comunica como tal, no como dato inválido
      sinConexion.value = true
    } else {
      error.value =
        err instanceof ApiError ? err.message : 'No se pudo enviar la solicitud. Inténtalo de nuevo'
    }
  } finally {
    enviando.value = false
  }
}

function intentarOtroCorreo(): void {
  enviado.value = false
  error.value = null
  sinConexion.value = false
}
</script>

<template>
  <div
    class="flex min-h-screen flex-col"
    :style="{ background: 'var(--cream-100)' }"
  >
    <header class="flex justify-center" :style="{ background: 'var(--green-700)', padding: '20px 40px' }">
      <AppLogo size="sm" on-dark />
    </header>

    <main class="flex flex-1 items-start justify-center px-6 py-12">
      <div class="w-full" :style="{ maxWidth: '460px' }">
        <!-- Estado inicial: captura del correo -->
        <form v-if="!enviado" class="flex flex-col gap-6" novalidate @submit.prevent="enviar">
          <div>
            <h1
              class="m-0"
              :style="{ font: '500 32px/1.15 var(--font-serif)', color: 'var(--green-900)' }"
            >
              Recuperar contraseña
            </h1>
            <p
              class="mt-3"
              :style="{ font: '400 17px/1.5 var(--font-sans)', color: 'var(--clay-600)' }"
            >
              Escribe el correo con el que entras a Artani. Te enviaremos un enlace para
              elegir una contraseña nueva.
            </p>
          </div>

          <BaseAlert v-if="sinConexion" tone="warning" @cerrar="sinConexion = false">
            No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.
          </BaseAlert>
          <BaseAlert v-else-if="error" tone="error" @cerrar="error = null">
            {{ error }}
          </BaseAlert>

          <TextField
            v-model="correo"
            label="Correo electrónico"
            type="email"
            placeholder="nombre@correo.com"
            required
            :disabled="enviando"
            help-text="El mismo correo con el que inicias sesión."
          />

          <BaseButton
            type="submit"
            variant="primary"
            size="lg"
            block
            :disabled="!correoValido || enviando"
          >
            {{ enviando ? 'Enviando…' : 'Enviar enlace' }}
          </BaseButton>

          <RouterLink
            :to="{ name: 'login' }"
            class="inline-flex items-center justify-center gap-2 no-underline"
            :style="{ font: '700 var(--text-sm)/1 var(--font-sans)', color: 'var(--green-700)' }"
          >
            <ArrowLeft :size="16" />
            Volver al inicio de sesión
          </RouterLink>
        </form>

        <!-- Estado final: confirmación, sin afirmar que la cuenta exista -->
        <div
          v-else
          ref="panelExito"
          tabindex="-1"
          role="status"
          aria-live="polite"
          class="card flex flex-col items-center gap-4 text-center outline-none"
          :style="{ padding: '36px 32px' }"
        >
          <span
            aria-hidden="true"
            class="inline-flex items-center justify-center rounded-full"
            :style="{ width: '56px', height: '56px', background: 'var(--green-50)', color: 'var(--green-700)' }"
          >
            <MailCheck :size="28" />
          </span>

          <h1 class="m-0" :style="{ font: '500 26px/1.2 var(--font-serif)', color: 'var(--green-900)' }">
            Revisa tu correo
          </h1>

          <p class="m-0" :style="{ font: '400 16px/1.55 var(--font-sans)', color: 'var(--clay-700)' }">
            Si <strong>{{ correo.trim() }}</strong> corresponde a una cuenta registrada, ahí
            encontrarás el enlace para elegir una contraseña nueva.
          </p>

          <p class="m-0" :style="{ font: '400 15px/1.5 var(--font-sans)', color: 'var(--clay-600)' }">
            El enlace vence en 30 minutos y solo puede usarse una vez. Si no aparece en unos
            minutos, revisa tu carpeta de correo no deseado.
          </p>

          <div class="mt-2 flex w-full flex-col gap-3">
            <RouterLink :to="{ name: 'login' }" class="no-underline">
              <BaseButton variant="primary" size="lg" block>Volver al inicio de sesión</BaseButton>
            </RouterLink>
            <BaseButton variant="ghost" block @click="intentarOtroCorreo">
              Usar otro correo
            </BaseButton>
          </div>
        </div>
      </div>
    </main>

    <TextileBand :height="10" :gap="4" />
  </div>
</template>
