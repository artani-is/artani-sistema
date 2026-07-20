<script setup lang="ts">
import { useId } from 'vue'

export interface OpcionSelect {
  value: string
  label: string
}

withDefaults(
  defineProps<{
    label?: string
    options: OpcionSelect[]
    placeholder?: string
    helpText?: string
    error?: string
    required?: boolean
    disabled?: boolean
  }>(),
  {
    label: '',
    placeholder: 'Selecciona…',
    helpText: '',
    error: '',
    required: false,
    disabled: false,
  },
)

const modelo = defineModel<string>({ default: '' })
const id = useId()
</script>

<template>
  <div class="flex flex-col gap-2">
    <label v-if="label" :for="id" class="field-label">
      {{ label }}<span v-if="required" class="field-required"> *</span>
    </label>
    <div class="relative flex items-center">
      <select
        :id="id"
        v-model="modelo"
        class="field-input"
        :class="{ 'field-invalid': Boolean(error), 'field-empty': !modelo }"
        :disabled="disabled"
        :required="required"
      >
        <option value="" disabled>{{ placeholder }}</option>
        <option v-for="opcion in options" :key="opcion.value" :value="opcion.value">
          {{ opcion.label }}
        </option>
      </select>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        class="pointer-events-none absolute right-3.5"
      >
        <path
          d="M6 9l6 6 6-6"
          stroke="var(--green-700)"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
    <span v-if="error" class="field-error">{{ error }}</span>
    <span v-else-if="helpText" class="field-help">{{ helpText }}</span>
  </div>
</template>
