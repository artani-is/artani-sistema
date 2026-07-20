<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    tone?: 'green' | 'amber' | 'terracotta'
    hint?: string
  }>(),
  { tone: 'green', hint: '' },
)

const TONOS = {
  green: { chip: 'var(--green-50)', chipFg: 'var(--green-700)', accent: 'var(--green-700)' },
  amber: { chip: 'var(--amber-100)', chipFg: 'var(--amber-700)', accent: 'var(--amber-600)' },
  terracotta: {
    chip: 'var(--terracotta-100)',
    chipFg: 'var(--terracotta-600)',
    accent: 'var(--terracotta-500)',
  },
} as const

const tono = computed(() => TONOS[props.tone])
</script>

<template>
  <div class="card card-padded flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <span
        :style="{
          font: '700 var(--text-label)/1.2 var(--font-sans)',
          letterSpacing: 'var(--tracking-wide)',
          textTransform: 'uppercase',
          color: 'var(--clay-600)',
        }"
      >
        {{ label }}
      </span>
      <span
        v-if="$slots.icon"
        class="inline-flex items-center justify-center"
        :style="{
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius-md)',
          background: tono.chip,
          color: tono.chipFg,
        }"
      >
        <slot name="icon" />
      </span>
    </div>
    <div class="flex items-baseline gap-1.5">
      <span :style="{ font: '400 44px/1 var(--font-serif)', color: 'var(--green-900)' }">
        {{ value }}
      </span>
    </div>
    <span
      v-if="hint"
      :style="{ font: '500 var(--text-sm)/1.3 var(--font-sans)', color: tono.accent }"
    >
      {{ hint }}
    </span>
  </div>
</template>
