<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { AlertTriangle, Archive, Check } from '@lucide/vue'
import AppLogo from '@/components/ui/AppLogo.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import PhotoSlot from '@/components/ui/PhotoSlot.vue'
import TextileBand from '@/components/ui/TextileBand.vue'
import { api } from '@/lib/api'
import type { VerificacionPublica } from '@/types'

const route = useRoute()
const cargando = ref(true)
const certificado = ref<VerificacionPublica | null>(null)

// CAM-013: la pieza dada de baja sigue siendo auténtica; solo cambia su situación
const dadaDeBaja = computed(() => certificado.value?.estado === 'BAJA')

onMounted(async () => {
  try {
    certificado.value = await api.get<VerificacionPublica>(
      `/publico/certificados/${route.params.id as string}`,
    )
  } catch {
    certificado.value = null
  } finally {
    cargando.value = false
  }
})

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { dateStyle: 'long' })
}
</script>

<template>
  <div class="flex min-h-screen flex-col" :style="{ background: 'var(--cream-100)' }">
    <header
      class="flex justify-center"
      :style="{ background: 'var(--green-700)', padding: '20px 40px' }"
    >
      <AppLogo size="sm" on-dark />
    </header>

    <main class="flex flex-1 items-start justify-center px-6 py-12">
      <p v-if="cargando" :style="{ color: 'var(--clay-500)' }">Verificando certificado…</p>

      <!-- Certificado encontrado: válido o pieza dada de baja (CAM-013) -->
      <div
        v-else-if="certificado"
        class="card w-full overflow-hidden"
        :style="{ maxWidth: '560px', padding: 0 }"
      >
        <div
          class="flex items-center gap-3.5"
          :style="{
            background: dadaDeBaja ? 'var(--amber-100)' : 'var(--status-available-bg, var(--green-50))',
            padding: '24px 32px',
            borderBottom: '1.5px solid var(--cream-300)',
          }"
        >
          <span
            class="inline-flex shrink-0 items-center justify-center rounded-full"
            :style="{
              width: '44px',
              height: '44px',
              background: dadaDeBaja ? 'var(--amber-600)' : 'var(--green-700)',
              color: 'var(--cream-50)',
            }"
          >
            <Archive v-if="dadaDeBaja" :size="22" />
            <Check v-else :size="24" />
          </span>
          <div>
            <div :style="{ font: '600 22px/1.1 var(--font-serif)', color: dadaDeBaja ? 'var(--amber-700)' : 'var(--green-900)' }">
              {{ dadaDeBaja ? 'Pieza dada de baja' : 'Certificado válido' }}
            </div>
            <div :style="{ font: '500 14px/1.35 var(--font-sans)', color: dadaDeBaja ? 'var(--amber-700)' : 'var(--green-700)' }">
              {{
                dadaDeBaja
                  ? 'El certificado es auténtico, pero la pieza fue dada de baja del registro del taller.'
                  : 'Pieza auténtica registrada en Artani'
              }}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6 p-8 sm:grid-cols-[180px_1fr]">
          <PhotoSlot
            :src="certificado.pieza.foto ?? ''"
            caption="Fotografía de la pieza"
            aspect="3 / 4"
          />
          <div class="flex flex-col gap-3.5">
            <div>
              <div :style="{ font: '400 26px/1.1 var(--font-serif)', color: 'var(--green-900)' }">
                {{ certificado.pieza.nombre }}
              </div>
              <div
                class="mt-1"
                :style="{ font: '500 13px/1 var(--font-mono)', color: 'var(--clay-500)' }"
              >
                {{ certificado.idCertificado.slice(0, 8).toUpperCase() }}
              </div>
            </div>
            <div class="campo-publico">
              <span class="etiqueta">Artesano</span>
              <span class="valor">{{ certificado.artesano.nombre }}</span>
            </div>
            <div v-if="certificado.artesano.taller" class="campo-publico">
              <span class="etiqueta">Taller</span>
              <span class="valor">{{ certificado.artesano.taller }}</span>
            </div>
            <div class="campo-publico">
              <span class="etiqueta">Técnica</span>
              <span class="valor">{{ certificado.pieza.tecnica }}</span>
            </div>
            <div class="campo-publico">
              <span class="etiqueta">Categoría</span>
              <span class="valor">{{ certificado.pieza.categoria }}</span>
            </div>
            <div class="campo-publico">
              <span class="etiqueta">Emitido</span>
              <span class="valor">{{ formatearFecha(certificado.fechaEmision) }}</span>
            </div>
            <div>
              <BaseBadge v-if="dadaDeBaja" tone="neutral" size="sm">
                Dada de baja del registro del taller
              </BaseBadge>
              <BaseBadge v-else tone="available" size="sm">Autenticidad verificada</BaseBadge>
            </div>
          </div>
        </div>
      </div>

      <!-- Certificado inválido: reservado para códigos inexistentes o manipulados -->
      <div
        v-else
        class="card card-padded flex w-full flex-col items-center gap-4 text-center"
        :style="{ maxWidth: '480px', padding: '40px', borderColor: 'var(--terracotta-300)' }"
      >
        <span
          class="inline-flex items-center justify-center rounded-full"
          :style="{
            width: '64px',
            height: '64px',
            background: 'var(--terracotta-100)',
            color: 'var(--terracotta-500)',
          }"
        >
          <AlertTriangle :size="34" />
        </span>
        <div :style="{ font: '600 26px/1.1 var(--font-serif)', color: 'var(--terracotta-700)' }">
          Certificado inválido
        </div>
        <p
          class="m-0"
          :style="{ font: '400 17px/1.5 var(--font-sans)', color: 'var(--clay-700)', maxWidth: '360px' }"
        >
          Este código QR no corresponde a ninguna pieza registrada en Artani. La pieza podría
          no ser auténtica.
        </p>
        <BaseBadge tone="sold">No verificado</BaseBadge>
      </div>
    </main>

    <!-- CAM-005: la franja decorativa cubre el ancho total en todas las resoluciones -->
    <TextileBand :height="10" :gap="4" />
    <footer
      class="text-center"
      :style="{ padding: '18px 40px', font: '400 13px/1.4 var(--font-sans)', color: 'var(--clay-500)' }"
    >
      Verificación pública Artani · La autenticidad se valida contra el registro del taller.
    </footer>
  </div>
</template>

<style scoped>
.campo-publico {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.etiqueta {
  font: 700 12px / 1 var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--clay-500);
}
.valor {
  font: 500 17px / 1.3 var(--font-sans);
  color: var(--green-900);
}
</style>
