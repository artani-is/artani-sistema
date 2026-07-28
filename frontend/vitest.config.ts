import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

/**
 * Development testing (Sommerville) del cliente: pruebas de componentes y de
 * stores con Vue Test Utils sobre un DOM simulado (happy-dom). No requieren
 * backend: las llamadas de red se sustituyen por dobles de prueba.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    reporters: ['verbose'],
  },
})
