<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    tone?: 'neutral' | 'available' | 'sold' | 'consignment' | 'accent' | 'info'
    size?: 'sm' | 'md'
  }>(),
  { tone: 'neutral', size: 'md' },
)

const TONOS = {
  neutral: { bg: 'var(--cream-200)', fg: 'var(--clay-700)' },
  available: { bg: 'var(--status-available-bg)', fg: 'var(--status-available)' },
  sold: { bg: 'var(--status-sold-bg)', fg: 'var(--status-sold)' },
  consignment: { bg: 'var(--status-consignment-bg)', fg: 'var(--status-consignment)' },
  accent: { bg: 'var(--amber-100)', fg: 'var(--amber-700)' },
  info: { bg: 'var(--green-50)', fg: 'var(--green-700)' },
} as const

const tono = computed(() => TONOS[props.tone])
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 whitespace-nowrap"
    :style="{
      padding: size === 'sm' ? '3px 10px' : '5px 14px',
      font: `700 ${size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)'}/1 var(--font-sans)`,
      letterSpacing: '0.02em',
      color: tono.fg,
      background: tono.bg,
      borderRadius: 'var(--radius-pill)',
    }"
  >
    <span
      class="rounded-full"
      :style="{ width: '7px', height: '7px', background: 'currentColor', opacity: 0.85 }"
    />
    <slot />
  </span>
</template>
