<script setup lang="ts">
import { computed, ref, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    label?: string
    type?: string
    placeholder?: string
    helpText?: string
    error?: string
    required?: boolean
    disabled?: boolean
    maxlength?: number
    min?: string | number
    step?: string | number
    multiline?: boolean
    rows?: number
  }>(),
  {
    label: '',
    type: 'text',
    placeholder: '',
    helpText: '',
    error: '',
    required: false,
    disabled: false,
    maxlength: undefined,
    min: undefined,
    step: undefined,
    multiline: false,
    rows: 4,
  },
)

const modelo = defineModel<string>({ default: '' })
const id = useId()
const mostrar = ref(false)

const esPassword = computed(() => props.type === 'password')
const tipoEfectivo = computed(() =>
  esPassword.value ? (mostrar.value ? 'text' : 'password') : props.type,
)
</script>

<template>
  <div class="flex flex-col gap-2">
    <label v-if="label" :for="id" class="field-label">
      {{ label }}<span v-if="required" class="field-required"> *</span>
    </label>
    <div class="relative flex items-center">
      <textarea
        v-if="multiline"
        :id="id"
        v-model="modelo"
        class="field-input"
        :class="{ 'field-invalid': Boolean(error) }"
        :placeholder="placeholder"
        :disabled="disabled"
        :maxlength="maxlength"
        :rows="rows"
      ></textarea>
      <input
        v-else
        :id="id"
        v-model="modelo"
        class="field-input"
        :class="{ 'field-invalid': Boolean(error) }"
        :style="esPassword ? { paddingRight: '92px' } : {}"
        :type="tipoEfectivo"
        :placeholder="placeholder"
        :disabled="disabled"
        :maxlength="maxlength"
        :min="min"
        :step="step"
      />
      <button
        v-if="esPassword"
        type="button"
        class="absolute right-3 cursor-pointer p-2"
        :style="{ font: '700 var(--text-sm)/1 var(--font-sans)', color: 'var(--green-700)' }"
        @click="mostrar = !mostrar"
      >
        {{ mostrar ? 'Ocultar' : 'Mostrar' }}
      </button>
    </div>
    <span v-if="error" class="field-error">{{ error }}</span>
    <span v-else-if="helpText" class="field-help">{{ helpText }}</span>
  </div>
</template>
