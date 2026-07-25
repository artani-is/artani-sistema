<script setup lang="ts">
import { computed } from 'vue'

/**
 * Franja decorativa inspirada en textiles.
 * CAM-005: se dibuja con un degradado repetible para cubrir SIEMPRE el ancho
 * total del contenedor, en cualquier resolución (antes se generaba un número
 * fijo de bloques y la franja quedaba incompleta en pantallas anchas).
 */
const props = withDefaults(defineProps<{ height?: number; gap?: number }>(), {
  height: 12,
  gap: 4,
})

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

const fondo = computed(() => {
  const bloque = Math.round(props.height * 0.9)
  const paso = bloque + props.gap
  const segmentos = PALETA.flatMap((color, i) => [
    `${color} ${i * paso}px ${i * paso + bloque}px`,
    `transparent ${i * paso + bloque}px ${(i + 1) * paso}px`,
  ])
  return `repeating-linear-gradient(90deg, ${segmentos.join(', ')})`
})
</script>

<template>
  <div
    aria-hidden="true"
    class="w-full"
    :style="{ height: `${height}px`, background: fondo }"
  />
</template>
