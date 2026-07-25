<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    abierto: boolean
    titulo: string
    ancho?: number
    tone?: 'default' | 'danger' | 'consignment'
  }>(),
  { ancho: 480, tone: 'default' },
)
const emit = defineEmits<{ cerrar: [] }>()

const acento = computed(() =>
  props.tone === 'danger'
    ? 'var(--terracotta-500)'
    : props.tone === 'consignment'
      ? 'var(--amber-600)'
      : 'var(--green-700)',
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="abierto"
      class="fixed inset-0 z-40 flex items-center justify-center p-6"
      :style="{ background: 'rgba(22, 48, 31, 0.42)' }"
      @click.self="emit('cerrar')"
    >
      <div
        role="dialog"
        aria-modal="true"
        class="max-h-[92vh] w-full overflow-y-auto"
        :style="{
          maxWidth: `${ancho}px`,
          background: 'var(--cream-50)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          borderTop: `5px solid ${acento}`,
        }"
      >
        <div class="flex items-start justify-between gap-4" :style="{ padding: '22px 26px 0' }">
          <h2 :style="{ margin: 0, font: '600 24px/1.15 var(--font-serif)', color: 'var(--green-900)' }">
            {{ titulo }}
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            class="-mt-0.5 cursor-pointer px-1"
            :style="{ color: 'var(--clay-500)', font: '400 26px/1 var(--font-sans)' }"
            @click="emit('cerrar')"
          >
            ×
          </button>
        </div>
        <div :style="{ padding: '16px 26px 22px', font: '400 var(--text-body)/1.5 var(--font-sans)', color: 'var(--clay-700)' }">
          <slot />
        </div>
        <div
          v-if="$slots.footer"
          class="flex justify-end gap-3"
          :style="{
            padding: '18px 26px',
            background: 'var(--cream-100)',
            borderTop: '1.5px solid var(--cream-200)',
          }"
        >
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
