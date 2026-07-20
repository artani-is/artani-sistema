<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLogo from '@/components/ui/AppLogo.vue'
import TextileBand from '@/components/ui/TextileBand.vue'
import PhotoSlot from '@/components/ui/PhotoSlot.vue'
import TextField from '@/components/ui/TextField.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const correo = ref('')
const contrasena = ref('')
const recordar = ref(true)

async function enviar(): Promise<void> {
  try {
    await auth.iniciarSesion(correo.value.trim(), contrasena.value, recordar.value)
    const redirigir = typeof route.query.redirigir === 'string' ? route.query.redirigir : '/'
    router.push(redirigir)
  } catch {
    // El mensaje queda en auth.error y se muestra en la alerta
  }
}
</script>

<template>
  <div class="grid min-h-screen grid-cols-1 lg:grid-cols-[46%_54%]" :style="{ background: 'var(--cream-100)' }">
    <!-- Panel de marca -->
    <aside
      class="relative hidden flex-col lg:flex"
      :style="{ background: 'var(--green-700)', color: 'var(--cream-100)', padding: '44px 56px' }"
    >
      <AppLogo size="md" on-dark />
      <div class="mt-16">
        <h1 class="m-0" :style="{ font: '400 46px/1.08 var(--font-serif)', color: 'var(--cream-50)' }">
          {{ auth.artesano?.nombreTaller ?? 'Taller El Árbol del Hule' }}
        </h1>
        <p
          class="mt-4 max-w-[380px]"
          :style="{ font: '400 18px/1.55 var(--font-sans)', color: 'var(--text-on-dark-muted)' }"
        >
          Cada pieza, una historia. Administra tu taller con la seriedad que tu arte merece.
        </p>
      </div>
      <div class="mt-8 min-h-[220px] flex-1">
        <PhotoSlot on-dark caption="Foto: artesano o pieza del taller" aspect="auto" class="h-full" />
      </div>
      <div class="absolute inset-x-0 bottom-0">
        <TextileBand :height="12" :gap="4" />
      </div>
    </aside>

    <!-- Panel del formulario -->
    <main class="flex items-center justify-center p-10">
      <form class="flex w-full max-w-[420px] flex-col gap-6" @submit.prevent="enviar">
        <div class="mb-2 lg:hidden">
          <AppLogo size="md" />
        </div>
        <div>
          <h2 class="m-0" :style="{ font: '500 40px/1.1 var(--font-serif)', color: 'var(--green-900)' }">
            Iniciar sesión
          </h2>
          <p class="mt-2" :style="{ font: '400 18px/1.4 var(--font-sans)', color: 'var(--clay-600)' }">
            Acceso exclusivo para el artesano.
          </p>
        </div>

        <BaseAlert v-if="auth.error" tone="error" @cerrar="auth.error = null">
          {{ auth.error }}
        </BaseAlert>

        <TextField
          v-model="correo"
          label="Correo electrónico"
          type="email"
          placeholder="nombre@correo.com"
          required
        />
        <TextField
          v-model="contrasena"
          label="Contraseña"
          type="password"
          placeholder="Al menos 8 caracteres"
          required
        />

        <div class="flex items-center justify-between">
          <label class="inline-flex cursor-pointer items-center gap-3">
            <span class="relative inline-flex shrink-0">
              <input v-model="recordar" type="checkbox" class="absolute h-6 w-6 cursor-pointer opacity-0" />
              <span
                class="inline-flex h-6 w-6 items-center justify-center"
                :style="{
                  background: recordar ? 'var(--green-700)' : 'var(--cream-50)',
                  border: `1.5px solid ${recordar ? 'var(--green-700)' : 'var(--cream-400)'}`,
                  borderRadius: 'var(--radius-sm)',
                  transition: 'background var(--duration-fast), border-color var(--duration-fast)',
                }"
              >
                <svg v-if="recordar" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" stroke="var(--cream-50)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
            </span>
            <span :style="{ font: '500 var(--text-body)/1.2 var(--font-sans)', color: 'var(--green-900)' }">
              Recordar sesión
            </span>
          </label>
          <span :style="{ font: '700 var(--text-sm)/1 var(--font-sans)', color: 'var(--green-700)' }">
            ¿Olvidaste tu contraseña?
          </span>
        </div>

        <BaseButton type="submit" variant="primary" size="lg" block :disabled="auth.cargando">
          {{ auth.cargando ? 'Verificando…' : 'Iniciar sesión' }}
        </BaseButton>

        <p class="m-0 text-center" :style="{ font: '400 var(--text-sm)/1.4 var(--font-sans)', color: 'var(--clay-600)' }">
          Si olvidaste tu contraseña, contacta al equipo de soporte del taller.
        </p>
      </form>
    </main>
  </div>
</template>
