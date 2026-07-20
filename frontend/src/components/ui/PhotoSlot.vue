<script setup lang="ts">
withDefaults(
  defineProps<{
    src?: string
    caption?: string
    onDark?: boolean
    aspect?: string
  }>(),
  { src: '', caption: 'Foto: artesano o pieza del taller', onDark: false, aspect: '3 / 4' },
)
</script>

<template>
  <div
    class="relative flex w-full flex-col items-center justify-center gap-3 overflow-hidden"
    :style="{
      aspectRatio: aspect,
      borderRadius: 'var(--radius-md)',
      border: src ? 'none' : `1.5px dashed ${onDark ? 'rgba(244,239,226,0.35)' : 'var(--cream-400)'}`,
      background: src ? 'transparent' : onDark ? 'rgba(255,255,255,0.04)' : 'var(--cream-100)',
    }"
  >
    <img v-if="src" :src="src" :alt="caption" class="h-full w-full object-cover" />
    <template v-else>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect
          x="3" y="4" width="18" height="16" rx="2"
          :stroke="onDark ? 'var(--text-on-dark-muted)' : 'var(--clay-500)'"
          stroke-width="1.6"
        />
        <circle cx="8.5" cy="9.5" r="1.6" :fill="onDark ? 'var(--text-on-dark-muted)' : 'var(--clay-500)'" />
        <path
          d="M4 17l4.5-4.5L13 17l3-3 4 4"
          :stroke="onDark ? 'var(--text-on-dark-muted)' : 'var(--clay-500)'"
          stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
        />
      </svg>
      <span
        class="max-w-[80%] text-center"
        :style="{
          font: '500 var(--text-sm)/1.3 var(--font-sans)',
          color: onDark ? 'var(--text-on-dark-muted)' : 'var(--clay-500)',
        }"
      >
        {{ caption }}
      </span>
    </template>
  </div>
</template>
