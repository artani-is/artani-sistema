<script setup lang="ts">
withDefaults(defineProps<{ title: string; subtitle?: string }>(), { subtitle: '' })
</script>

<template>
  <header
    class="flex flex-wrap items-center justify-between gap-4"
    :style="{
      minHeight: 'var(--topbar-height)',
      padding: '20px var(--page-pad)',
      background: 'var(--cream-50)',
      borderBottom: 'var(--border-width) solid var(--cream-300)',
    }"
  >
    <div class="flex min-w-0 flex-col gap-0.5">
      <h1
        class="m-0 truncate"
        :style="{
          font: '600 var(--text-h2)/1.1 var(--font-serif)',
          color: 'var(--green-900)',
          letterSpacing: '-0.01em',
        }"
      >
        {{ title }}
      </h1>
      <p
        v-if="subtitle || $slots.subtitle"
        class="m-0"
        :style="{ font: '500 var(--text-body)/1.3 var(--font-sans)', color: 'var(--clay-600)' }"
      >
        <slot name="subtitle">{{ subtitle }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-3">
      <slot name="actions" />
    </div>
  </header>
</template>
