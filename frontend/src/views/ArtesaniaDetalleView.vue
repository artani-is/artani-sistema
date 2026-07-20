<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Pencil, Trash2, Upload, Star } from '@lucide/vue'
import TopBar from '@/components/ui/TopBar.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import PhotoSlot from '@/components/ui/PhotoSlot.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useArtesaniasStore } from '@/stores/artesanias'
import { ApiError } from '@/lib/api'
import { ETIQUETA_ESTADO, type Artesania, type EstadoArtesania, type FotoArtesania } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useArtesaniasStore()

const idArtesania = route.params.id as string
const pieza = ref<Artesania | null>(null)
const cargando = ref(true)
const error = ref<string | null>(null)
const avisoFotos = ref<string | null>(null)

const subiendo = ref(false)
const confirmarBorrarPieza = ref(false)
const borrandoPieza = ref(false)
const fotoAEliminar = ref<FotoArtesania | null>(null)
const borrandoFoto = ref(false)

const editable = computed(() => pieza.value?.estado !== 'VENDIDA')
const fotoPrincipal = computed(() => {
  const fotos = pieza.value?.fotos ?? []
  return fotos.find((f) => f.esPrincipal) ?? fotos[0] ?? null
})

const TONO_ESTADO: Record<EstadoArtesania, 'available' | 'consignment' | 'sold'> = {
  DISPONIBLE: 'available',
  EN_CONSIGNACION: 'consignment',
  VENDIDA: 'sold',
}

async function cargarPieza(): Promise<void> {
  cargando.value = true
  error.value = null
  try {
    pieza.value = await store.obtener(idArtesania)
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'No se pudo cargar la pieza'
  } finally {
    cargando.value = false
  }
}

onMounted(cargarPieza)

async function subirFotos(evento: Event): Promise<void> {
  const entrada = evento.target as HTMLInputElement
  const archivos = Array.from(entrada.files ?? [])
  entrada.value = ''
  if (archivos.length === 0) return
  subiendo.value = true
  avisoFotos.value = null
  try {
    await store.subirFotos(idArtesania, archivos)
    await cargarPieza()
  } catch (err) {
    avisoFotos.value =
      err instanceof ApiError ? err.message : 'No se pudieron subir las fotografías'
  } finally {
    subiendo.value = false
  }
}

async function marcarPrincipal(foto: FotoArtesania): Promise<void> {
  avisoFotos.value = null
  try {
    await store.marcarFotoPrincipal(idArtesania, foto.idFoto)
    await cargarPieza()
  } catch (err) {
    avisoFotos.value =
      err instanceof ApiError ? err.message : 'No se pudo cambiar la fotografía principal'
  }
}

async function confirmarEliminarFoto(): Promise<void> {
  if (!fotoAEliminar.value) return
  borrandoFoto.value = true
  try {
    await store.eliminarFoto(idArtesania, fotoAEliminar.value.idFoto)
    await cargarPieza()
  } catch (err) {
    avisoFotos.value =
      err instanceof ApiError ? err.message : 'No se pudo eliminar la fotografía'
  } finally {
    fotoAEliminar.value = null
    borrandoFoto.value = false
  }
}

async function eliminarPieza(): Promise<void> {
  borrandoPieza.value = true
  try {
    await store.eliminar(idArtesania)
    router.push({ name: 'artesanias' })
  } catch (err) {
    confirmarBorrarPieza.value = false
    error.value = err instanceof ApiError ? err.message : 'No se pudo eliminar la pieza'
  } finally {
    borrandoPieza.value = false
  }
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { dateStyle: 'long', timeZone: 'UTC' })
}
</script>

<template>
  <div>
    <TopBar :title="pieza?.nombre ?? 'Pieza'">
      <template #subtitle>
        <span :style="{ fontFamily: 'var(--font-mono)' }">
          ART-{{ idArtesania.slice(0, 4).toUpperCase() }}
        </span>
      </template>
      <template #actions>
        <BaseButton variant="ghost" @click="router.push({ name: 'artesanias' })">
          <template #icon><ArrowLeft :size="18" /></template>
          Volver al inventario
        </BaseButton>
      </template>
    </TopBar>

    <div :style="{ padding: 'var(--page-pad)' }">
      <p v-if="cargando" :style="{ color: 'var(--clay-500)' }">Cargando pieza…</p>
      <BaseAlert v-else-if="error && !pieza" tone="error" :closable="false">{{ error }}</BaseAlert>

      <div v-else-if="pieza" class="grid grid-cols-1 items-start gap-7 lg:grid-cols-[320px_1fr]">
        <!-- Columna izquierda: foto + estado -->
        <div class="flex flex-col gap-4">
          <div class="card overflow-hidden">
            <PhotoSlot :src="fotoPrincipal?.rutaArchivo ?? ''" caption="Fotografía de la pieza" aspect="3 / 4" />
          </div>
          <div class="flex items-center justify-between">
            <BaseBadge :tone="TONO_ESTADO[pieza.estado]">{{ ETIQUETA_ESTADO[pieza.estado] }}</BaseBadge>
            <span
              v-if="pieza.precioVenta"
              :style="{ font: '400 30px/1 var(--font-serif)', color: 'var(--green-900)' }"
            >
              ${{ Number(pieza.precioVenta).toLocaleString('es-MX') }}
            </span>
          </div>
        </div>

        <!-- Columna derecha -->
        <div class="flex flex-col gap-6">
          <BaseAlert v-if="error" tone="error" @cerrar="error = null">{{ error }}</BaseAlert>

          <div class="card card-padded">
            <h3 class="mb-4 mt-0" :style="{ font: '600 21px/1 var(--font-serif)', color: 'var(--green-900)' }">
              Ficha técnica
            </h3>
            <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <div class="flex flex-col gap-1">
                <span class="etiqueta-campo">Técnica</span>
                <span class="valor-campo">{{ pieza.tecnica?.nombre ?? '—' }}</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="etiqueta-campo">Categoría</span>
                <span class="valor-campo">{{ pieza.categoria?.nombre ?? '—' }}</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="etiqueta-campo">Fecha de registro</span>
                <span class="valor-campo">{{ formatearFecha(pieza.fechaRegistro) }}</span>
              </div>
              <div class="flex flex-col gap-1 sm:col-span-2">
                <span class="etiqueta-campo">Descripción</span>
                <span class="valor-campo whitespace-pre-line">
                  {{ pieza.descripcion || 'Sin descripción registrada.' }}
                </span>
              </div>
            </div>
          </div>

          <div class="card card-padded">
            <div class="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h3 class="m-0" :style="{ font: '600 21px/1 var(--font-serif)', color: 'var(--green-900)' }">
                Fotografías
              </h3>
              <label v-if="editable">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  multiple
                  class="hidden"
                  @change="subirFotos"
                />
                <span class="btn btn-secondary btn-sm" :style="{ pointerEvents: 'none' }">
                  <Upload :size="16" />
                  {{ subiendo ? 'Subiendo…' : 'Subir fotos' }}
                </span>
              </label>
            </div>
            <p class="mb-4 mt-0" :style="{ font: '400 var(--text-sm)/1.4 var(--font-sans)', color: 'var(--clay-500)' }">
              PNG o JPG, máximo 5 MB. La foto principal aparecerá en el certificado de autenticidad.
            </p>

            <BaseAlert v-if="avisoFotos" tone="error" class="mb-4" @cerrar="avisoFotos = null">
              {{ avisoFotos }}
            </BaseAlert>

            <p v-if="pieza.fotos.length === 0" class="m-0" :style="{ color: 'var(--clay-500)' }">
              Esta pieza aún no tiene fotografías.
            </p>
            <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              <figure
                v-for="foto in pieza.fotos"
                :key="foto.idFoto"
                class="m-0 overflow-hidden"
                :style="{
                  borderRadius: 'var(--radius-md)',
                  border: foto.esPrincipal
                    ? '2px solid var(--amber-500)'
                    : '1.5px solid var(--cream-300)',
                }"
              >
                <img
                  :src="foto.rutaArchivo"
                  :alt="`Fotografía de ${pieza.nombre}`"
                  class="h-32 w-full object-cover"
                />
                <figcaption
                  class="flex items-center justify-between gap-1 px-2 py-1.5"
                  :style="{ font: '500 var(--text-xs)/1 var(--font-sans)', background: 'var(--cream-100)' }"
                >
                  <span v-if="foto.esPrincipal" class="inline-flex items-center gap-1" :style="{ color: 'var(--amber-700)', fontWeight: 700 }">
                    <Star :size="13" /> Principal
                  </span>
                  <button
                    v-else-if="editable"
                    type="button"
                    class="cursor-pointer"
                    :style="{ color: 'var(--green-700)', fontWeight: 700 }"
                    @click="marcarPrincipal(foto)"
                  >
                    Hacer principal
                  </button>
                  <button
                    v-if="editable"
                    type="button"
                    class="cursor-pointer"
                    :style="{ color: 'var(--terracotta-500)' }"
                    title="Eliminar fotografía"
                    @click="fotoAEliminar = foto"
                  >
                    <Trash2 :size="15" />
                  </button>
                </figcaption>
              </figure>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <BaseButton
              variant="secondary"
              :disabled="!editable"
              @click="router.push({ name: 'artesania-editar', params: { id: pieza.idArtesania } })"
            >
              <template #icon><Pencil :size="18" /></template>
              Editar ficha
            </BaseButton>
            <BaseButton
              v-if="pieza.estado === 'DISPONIBLE'"
              variant="danger"
              @click="confirmarBorrarPieza = true"
            >
              <template #icon><Trash2 :size="18" /></template>
              Eliminar pieza
            </BaseButton>
            <span
              v-if="!editable"
              :style="{ font: '500 var(--text-label)/1.3 var(--font-sans)', color: 'var(--clay-500)' }"
            >
              Pieza vendida: la ficha ya no puede editarse.
            </span>
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :abierto="confirmarBorrarPieza"
      titulo="Eliminar pieza"
      :mensaje="`¿Deseas eliminar «${pieza?.nombre}» y sus fotografías? Esta acción no se puede deshacer.`"
      :procesando="borrandoPieza"
      @confirmar="eliminarPieza"
      @cancelar="confirmarBorrarPieza = false"
    />
    <ConfirmDialog
      :abierto="fotoAEliminar !== null"
      titulo="Eliminar fotografía"
      mensaje="¿Deseas eliminar esta fotografía de la pieza?"
      :procesando="borrandoFoto"
      @confirmar="confirmarEliminarFoto"
      @cancelar="fotoAEliminar = null"
    />
  </div>
</template>

<style scoped>
.etiqueta-campo {
  font: 700 13px / 1 var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--clay-500);
}
.valor-campo {
  font: 500 var(--text-body) / 1.3 var(--font-sans);
  color: var(--green-900);
}
</style>
