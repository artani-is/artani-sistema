<script setup lang="ts">
withDefaults(defineProps<{ height?: number; gap?: number }>(), { height: 12, gap: 4 })

const PALETA = [
  'var(--green-700)',
  'var(--amber-500)',
  'var(--terracotta-500)',
  'var(--green-600)',
  'var(--amber-600)',
  'var(--green-700)',
  'var(--terracotta-500)',
  'var(--amber-500)',
]
</script>

<template>
  <div
    aria-hidden="true"
    class="flex w-full items-center overflow-hidden"
    :style="{ gap: `${gap}px` }"
  >
    <span
      v-for="i in 60"
      :key="i"
      class="shrink-0 rounded-[2px]"
      :style="{
        width: `${Math.round(height * 0.9)}px`,
        height: `${height}px`,
        background: PALETA[(i - 1) % PALETA.length],
      }"
    />
  </div>
</template>
