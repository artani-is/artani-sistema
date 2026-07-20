<script setup lang="ts">
import BaseModal from '@/components/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

defineProps<{
  abierto: boolean
  titulo: string
  mensaje: string
  procesando?: boolean
}>()
const emit = defineEmits<{ confirmar: []; cancelar: [] }>()
</script>

<template>
  <BaseModal :abierto="abierto" :titulo="titulo" tone="danger" @cerrar="emit('cancelar')">
    <p class="m-0">{{ mensaje }}</p>
    <template #footer>
      <BaseButton variant="ghost" @click="emit('cancelar')">Cancelar</BaseButton>
      <BaseButton variant="danger" :disabled="procesando" @click="emit('confirmar')">
        {{ procesando ? 'Eliminando…' : 'Eliminar' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
