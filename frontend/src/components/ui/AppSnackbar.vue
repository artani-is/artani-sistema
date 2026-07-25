<script setup lang="ts">
import { Undo2 } from '@lucide/vue'
import { useSnackbarStore } from '@/stores/snackbar'

// CAM-014: barra emergente temporal, en posición fija consistente en todo el sistema.
const snackbar = useSnackbarStore()
</script>

<template>
  <Teleport to="body">
    <Transition name="snackbar">
      <div
        v-if="snackbar.actual"
        :key="snackbar.actual.id"
        role="status"
        aria-live="polite"
        class="snackbar"
        :class="{ 'snackbar-error': snackbar.actual.tono === 'error' }"
      >
        <span class="snackbar-mensaje">{{ snackbar.actual.mensaje }}</span>
        <button
          v-if="snackbar.actual.deshacer"
          type="button"
          class="snackbar-deshacer"
          :disabled="snackbar.deshaciendo"
          @click="snackbar.ejecutarDeshacer()"
        >
          <Undo2 :size="16" />
          {{ snackbar.deshaciendo ? 'Deshaciendo…' : 'Deshacer' }}
        </button>
        <button
          type="button"
          class="snackbar-cerrar"
          aria-label="Cerrar aviso"
          @click="snackbar.cerrar()"
        >
          ×
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.snackbar {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: min(92vw, 560px);
  padding: 14px 18px;
  border-radius: var(--radius-lg);
  background: var(--green-900);
  color: var(--cream-50);
  font: 500 15px / 1.4 var(--font-sans);
  box-shadow: var(--shadow-lg);
}
.snackbar-error {
  background: var(--terracotta-700, #8a3b2b);
}
.snackbar-mensaje {
  flex: 1;
  min-width: 0;
}
.snackbar-deshacer {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 8px 14px;
  border: none;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.12);
  color: var(--amber-500);
  font: 700 14px / 1 var(--font-sans);
  cursor: pointer;
  transition: background var(--duration-fast);
}
.snackbar-deshacer:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}
.snackbar-deshacer:disabled {
  opacity: 0.7;
  cursor: wait;
}
.snackbar-cerrar {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--cream-50);
  font: 400 22px / 1 var(--font-sans);
  padding: 0 2px;
  cursor: pointer;
  opacity: 0.8;
}
.snackbar-cerrar:hover {
  opacity: 1;
}
.snackbar-enter-active,
.snackbar-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}
.snackbar-enter-from,
.snackbar-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(14px);
}
</style>
