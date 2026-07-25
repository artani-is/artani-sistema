<script setup lang="ts">
withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg'; onDark?: boolean; showWordmark?: boolean }>(), {
  size: 'md',
  onDark: false,
  showWordmark: true,
})

const TILES = { sm: 32, md: 44, lg: 60 }
const WORDS = { sm: 18, md: 24, lg: 32 }
</script>

<template>
  <div class="inline-flex items-center" :style="{ gap: `${TILES[size] * 0.3}px` }">
    <span
      class="inline-flex shrink-0 items-center justify-center overflow-hidden"
      :style="{
        width: `${TILES[size]}px`,
        height: `${TILES[size]}px`,
        borderRadius: `${TILES[size] * 0.28}px`,
        background: 'var(--amber-500)',
        boxShadow: onDark ? 'none' : 'var(--shadow-xs)',
      }"
    >
      <svg
        viewBox="0 0 100 100"
        :width="TILES[size] * 0.62"
        :height="TILES[size] * 0.62"
        fill="none"
        aria-hidden="true"
      >
        <g stroke="var(--green-950)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">
          <line x1="16" y1="27" x2="84" y2="27" />
          <line x1="16" y1="73" x2="84" y2="73" />
          <path d="M50 30 L70 50 L50 70 L30 50 Z" />
        </g>
        <path d="M50 42 L58 50 L50 58 L42 50 Z" fill="var(--green-950)" />
      </svg>
    </span>
    <span
      v-if="showWordmark"
      :style="{
        font: `800 ${WORDS[size]}px/1 var(--font-sans)`,
        letterSpacing: 'var(--tracking-caps)',
        color: onDark ? 'var(--cream-100)' : 'var(--green-900)',
      }"
    >
      ARTANI
    </span>
  </div>
</template>
