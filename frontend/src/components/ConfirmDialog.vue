<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import TextField from '@/components/ui/TextField.vue'

/**
 * Diálogo de confirmación para acciones destructivas.
 * CAM-012 / CAM-013: con `conMotivo` exige capturar la razón de la eliminación
 * (no se permite continuar con el campo vacío o solo espacios).
 */
const props = withDefaults(
  defineProps<{
    abierto: boolean
    titulo: string
    mensaje: string
    procesando?: boolean
    conMotivo?: boolean
    etiquetaMotivo?: string
  }>(),
  { procesando: false, conMotivo: false, etiquetaMotivo: 'Motivo de la eliminación' },
)
const emit = defineEmits<{ confirmar: [motivo: string]; cancelar: [] }>()

const motivo = ref('')
const errorMotivo = ref('')

watch(
  () => props.abierto,
  (abierto) => {
    if (abierto) {
      motivo.value = ''
      errorMotivo.value = ''
    }
  },
)

function confirmar(): void {
  if (props.conMotivo && !motivo.value.trim()) {
    errorMotivo.value = 'Escribe el motivo para poder continuar.'
    return
  }
  emit('confirmar', motivo.value.trim())
}
</script>

<template>
  <BaseModal :abierto="abierto" :titulo="titulo" tone="danger" @cerrar="emit('cancelar')">
    <div class="flex flex-col gap-4">
      <p class="m-0">{{ mensaje }}</p>
      <!-- Resumen opcional del registro afectado -->
      <slot />
      <TextField
        v-if="conMotivo"
        v-model="motivo"
        :label="etiquetaMotivo"
        multiline
        :rows="3"
        required
        placeholder="p. ej. La pieza se dañó y ya no está a la venta"
        :error="errorMotivo"
        help-text="Este motivo se guarda para tu registro."
        @update:model-value="errorMotivo = ''"
      />
    </div>
    <template #footer>
      <BaseButton variant="ghost" @click="emit('cancelar')">Cancelar</BaseButton>
      <BaseButton variant="danger" :disabled="procesando" @click="confirmar">
        {{ procesando ? 'Eliminando…' : 'Eliminar' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
