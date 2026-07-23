<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Check } from '@lucide/vue'
import TopBar from '@/components/ui/TopBar.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAuthStore } from '@/stores/auth'
import { api, ApiError } from '@/lib/api'
import type { Artesano } from '@/types'

const auth = useAuthStore()

const nombreTaller = ref('')
const nombres = ref('')
const apellidoPaterno = ref('')
const apellidoMaterno = ref('')
const telefono = ref('')
const correo = ref('')

const cargando = ref(true)
const guardando = ref(false)
const error = ref<string | null>(null)
const exito = ref<string | null>(null)

onMounted(async () => {
  try {
    // El perfil completo (incluye teléfono) viene de la API, no de la sesión guardada
    const perfil = await api.get<Artesano>('/auth/me')
    nombreTaller.value = perfil.nombreTaller ?? ''
    nombres.value = perfil.nombres
    apellidoPaterno.value = perfil.apellidoPaterno
    apellidoMaterno.value = perfil.apellidoMaterno ?? ''
    telefono.value = perfil.telefono ?? ''
    correo.value = perfil.correo
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'No se pudo cargar el perfil'
  } finally {
    cargando.value = false
  }
})

/** HU-17: los cambios se reflejan de inmediato, sin cerrar sesión. */
async function guardar(): Promise<void> {
  error.value = null
  exito.value = null
  if (!nombres.value.trim() || !apellidoPaterno.value.trim()) {
    error.value = 'El nombre y el apellido paterno del artesano responsable son obligatorios'
    return
  }
  guardando.value = true
  try {
    await auth.actualizarPerfil({
      nombres: nombres.value.trim(),
      apellidoPaterno: apellidoPaterno.value.trim(),
      apellidoMaterno: apellidoMaterno.value.trim() || null,
      telefono: telefono.value.trim() || null,
      nombreTaller: nombreTaller.value.trim() || null,
    })
    exito.value = 'Perfil actualizado: los cambios ya se reflejan en todo el sistema.'
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'No se pudo actualizar el perfil'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div>
    <TopBar title="Ajustes" subtitle="Perfil del taller" />

    <div class="flex flex-col gap-5" :style="{ padding: 'var(--page-pad)', maxWidth: '760px' }">
      <BaseAlert v-if="error" tone="error" @cerrar="error = null">{{ error }}</BaseAlert>
      <BaseAlert v-if="exito" tone="success" @cerrar="exito = null">{{ exito }}</BaseAlert>

      <p v-if="cargando" class="m-0" :style="{ color: 'var(--clay-500)' }">Cargando perfil…</p>

      <form v-else class="card card-padded flex flex-col gap-4" @submit.prevent="guardar">
        <h3 class="m-0" :style="{ font: '600 21px/1 var(--font-serif)', color: 'var(--green-900)' }">
          Perfil del taller
        </h3>
        <p
          class="m-0"
          :style="{ font: '400 var(--text-sm)/1.5 var(--font-sans)', color: 'var(--clay-600)' }"
        >
          Esta información aparece en tus certificados de autenticidad y reportes.
        </p>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            v-model="nombreTaller"
            label="Nombre del taller"
            placeholder="Nombre comercial"
            :maxlength="150"
          />
          <TextField v-model="telefono" label="Teléfono" type="tel" :maxlength="20" />
          <TextField v-model="nombres" label="Nombre(s) del artesano" required :maxlength="100" />
          <TextField
            v-model="apellidoPaterno"
            label="Apellido paterno"
            required
            :maxlength="60"
          />
          <TextField v-model="apellidoMaterno" label="Apellido materno" :maxlength="60" />
          <TextField
            :model-value="correo"
            label="Correo de acceso"
            type="email"
            disabled
            help-text="El correo se usa para iniciar sesión y no es editable desde esta pantalla."
          />
        </div>

        <div>
          <BaseButton type="submit" variant="primary" :disabled="guardando">
            <template #icon><Check :size="18" /></template>
            {{ guardando ? 'Guardando…' : 'Guardar cambios' }}
          </BaseButton>
        </div>
      </form>
    </div>
  </div>
</template>
