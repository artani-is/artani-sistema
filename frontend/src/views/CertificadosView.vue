<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Download, Eye, QrCode } from '@lucide/vue'
import TopBar from '@/components/ui/TopBar.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { useArtesaniasStore } from '@/stores/artesanias'
import { rutaQrDe, type Artesania } from '@/types'

const router = useRouter()
const store = useArtesaniasStore()

onMounted(() => {
  store.filtros.busqueda = ''
  store.filtros.estado = ''
  store.filtros.idTecnica = ''
  store.filtros.idCategoria = ''
  store.cargar()
})

const certificadas = computed(() => store.artesanias.filter((a) => a.certificado))
const pendientes = computed(() => store.artesanias.filter((a) => !a.certificado))

function idCorto(pieza: Artesania): string {
  return 'ART-' + pieza.idArtesania.slice(0, 4).toUpperCase()
}

function verDetalle(pieza: Artesania): void {
  router.push({ name: 'artesania-detalle', params: { id: pieza.idArtesania } })
}
</script>

<template>
  <div>
    <TopBar
      title="Certificados"
      subtitle="Códigos QR y certificados de autenticidad por pieza"
    />

    <div class="flex flex-col gap-8" :style="{ padding: 'var(--page-pad)' }">
      <p v-if="store.cargando" :style="{ color: 'var(--clay-500)' }">Cargando piezas…</p>

      <template v-else>
        <section>
          <h3 class="titulo-seccion">Certificados emitidos</h3>
          <p v-if="certificadas.length === 0" class="m-0" :style="{ color: 'var(--clay-500)' }">
            Aún no hay certificados emitidos. Emítelos desde la ficha de cada pieza.
          </p>
          <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <div
              v-for="pieza in certificadas"
              :key="pieza.idArtesania"
              class="card card-padded flex flex-col items-center gap-3.5 text-center"
            >
              <img
                :src="rutaQrDe(pieza.certificado!)"
                :alt="`Código QR de ${pieza.nombre}`"
                class="h-[130px] w-[130px]"
                :style="{ imageRendering: 'pixelated' }"
              />
              <div>
                <div :style="{ font: '600 18px/1.2 var(--font-serif)', color: 'var(--green-900)' }">
                  {{ pieza.nombre }}
                </div>
                <div
                  class="mt-1"
                  :style="{ font: '500 13px/1 var(--font-mono)', color: 'var(--clay-500)' }"
                >
                  {{ idCorto(pieza) }}
                </div>
              </div>
              <BaseBadge tone="available" size="sm">Certificado emitido</BaseBadge>
              <div class="flex w-full gap-2">
                <BaseButton variant="secondary" size="sm" block @click="verDetalle(pieza)">
                  <template #icon><Eye :size="16" /></template>
                  Ver
                </BaseButton>
                <a
                  :href="pieza.certificado!.rutaPdf"
                  target="_blank"
                  class="btn btn-primary btn-sm btn-block flex-1"
                >
                  <Download :size="16" />
                  PDF
                </a>
              </div>
            </div>
          </div>
        </section>

        <section v-if="pendientes.length > 0">
          <h3 class="titulo-seccion">Sin certificado</h3>
          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <div
              v-for="pieza in pendientes"
              :key="pieza.idArtesania"
              class="card card-padded flex flex-col items-center gap-3.5 text-center"
              :style="{ borderStyle: 'dashed' }"
            >
              <span
                class="inline-flex h-[130px] w-[130px] items-center justify-center"
                :style="{
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px dashed var(--cream-400)',
                  color: 'var(--clay-400)',
                }"
              >
                <QrCode :size="48" />
              </span>
              <div>
                <div :style="{ font: '600 18px/1.2 var(--font-serif)', color: 'var(--green-900)' }">
                  {{ pieza.nombre }}
                </div>
                <div
                  class="mt-1"
                  :style="{ font: '500 13px/1 var(--font-mono)', color: 'var(--clay-500)' }"
                >
                  {{ idCorto(pieza) }}
                </div>
              </div>
              <BaseBadge tone="neutral" size="sm">Sin certificado</BaseBadge>
              <BaseButton variant="secondary" size="sm" block @click="verDetalle(pieza)">
                Emitir desde la ficha
              </BaseButton>
            </div>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.titulo-seccion {
  margin: 0 0 14px;
  font: 600 var(--text-h3, 21px) / 1.1 var(--font-serif);
  color: var(--green-900);
}
</style>
