<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    block?: boolean
    type?: 'button' | 'submit'
    disabled?: boolean
  }>(),
  { variant: 'primary', size: 'md', block: false, type: 'button', disabled: false },
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="btn"
    :class="[
      `btn-${variant}`,
      size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '',
      block ? 'btn-block' : '',
    ]"
  >
    <slot name="icon" />
    <slot />
  </button>
</template>
