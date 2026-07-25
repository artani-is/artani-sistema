<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ tone?: 'error' | 'success' | 'warning' | 'info'; title?: string; closable?: boolean }>(),
  { tone: 'error', title: '', closable: true },
)
const emit = defineEmits<{ cerrar: [] }>()

const TONOS = {
  error: { bg: 'var(--terracotta-100)', bar: 'var(--terracotta-500)', fg: 'var(--terracotta-700)', icon: '!' },
  success: { bg: 'var(--green-50)', bar: 'var(--green-600)', fg: 'var(--green-800)', icon: '✓' },
  warning: { bg: 'var(--amber-100)', bar: 'var(--amber-600)', fg: 'var(--amber-700)', icon: '!' },
  info: { bg: 'var(--cream-100)', bar: 'var(--green-700)', fg: 'var(--green-800)', icon: 'i' },
} as const

const tono = computed(() => TONOS[props.tone])
</script>

<template>
  <div
    role="alert"
    class="flex items-start gap-3"
    :style="{
      padding: '16px 20px',
      background: tono.bg,
      borderRadius: 'var(--radius-md)',
      borderLeft: `4px solid ${tono.bar}`,
    }"
  >
    <span
      aria-hidden="true"
      class="mt-px inline-flex shrink-0 items-center justify-center rounded-full"
      :style="{
        width: '24px',
        height: '24px',
        background: tono.bar,
        color: 'var(--cream-50)',
        font: '700 15px/1 var(--font-sans)',
      }"
    >
      {{ tono.icon }}
    </span>
    <div class="flex flex-1 flex-col gap-0.5">
      <strong
        v-if="title"
        :style="{ font: '700 var(--text-body)/1.3 var(--font-sans)', color: tono.fg }"
      >
        {{ title }}
      </strong>
      <span :style="{ font: '500 var(--text-sm)/1.45 var(--font-sans)', color: tono.fg }">
        <slot />
      </span>
    </div>
    <button
      v-if="closable"
      type="button"
      aria-label="Cerrar"
      class="cursor-pointer px-1"
      :style="{ color: tono.fg, font: '700 18px/1 var(--font-sans)' }"
      @click="emit('cerrar')"
    >
      ×
    </button>
  </div>
</template>
