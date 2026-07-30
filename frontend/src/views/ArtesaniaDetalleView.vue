<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  BadgeCheck,
  Calculator,
  Check,
  Download,
  ExternalLink,
  Pencil,
  Store,
  Trash2,
  Undo2,
  Upload,
  Star,
} from '@lucide/vue'
import TopBar from '@/components/ui/TopBar.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import PhotoSlot from '@/components/ui/PhotoSlot.vue'
import TextField from '@/components/ui/TextField.vue'
import SelectField, { type OpcionSelect } from '@/components/ui/SelectField.vue'
import BaseModal from '@/components/BaseModal.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useArtesaniasStore } from '@/stores/artesanias'
import { useCatalogosStore } from '@/stores/catalogos'
import { useSnackbarStore } from '@/stores/snackbar'
import { ApiError } from '@/lib/api'
import {
  ETIQUETA_ESTADO,
  rutaQrDe,
  type Artesania,
  type EstadoArtesania,
  type FotoArtesania,
} from '@/types'

const route = useRoute()
const router = useRouter()
const store = useArtesaniasStore()
const catalogos = useCatalogosStore()
const snackbar = useSnackbarStore()

const idArtesania = route.params.id as string
const pieza = ref<Artesania | null>(null)
const cargando = ref(true)
const error = ref<string | null>(null)
const avisoFotos = ref<string | null>(null)

const subiendo = ref(false)
const confirmarBorrarPieza = ref(false)
const borrandoPieza = ref(false)

const editable = computed(() => pieza.value?.estado !== 'VENDIDA')
const fotoPrincipal = computed(() => {
  const fotos = pieza.value?.fotos ?? []
  return fotos.find((f) => f.esPrincipal) ?? fotos[0] ?? null
})

// Sprint 3 — resumen de costeo (el precio sugerido es derivado, no se almacena)
const totalInsumos = computed(() =>
  (pieza.value?.insumos ?? []).reduce(
    (suma, i) => suma + Number(i.cantidadUsada) * Number(i.costoUnitarioUso),
    0,
  ),
)
const manoObra = computed(
  () => Number(pieza.value?.horasTrabajadas ?? 0) * Number(pieza.value?.tarifaHora ?? 0),
)
const precioSugerido = computed(() => totalInsumos.value + manoObra.value)

// Sprint 4 — certificación
const emitiendo = ref(false)
const puedeEmitir = computed(
  () => (pieza.value?.fotos.length ?? 0) > 0 && Boolean(pieza.value?.precioVenta),
)

async function emitirCertificado(): Promise<void> {
  error.value = null
  emitiendo.value = true
  try {
    await store.emitirCertificado(idArtesania)
    await cargarPieza()
    snackbar.exito('Certificado emitido: el código QR y el PDF están listos.')
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'No se pudo emitir el certificado'
  } finally {
    emitiendo.value = false
  }
}

// Sprint 5 — consignación y ventas
const modal = ref<'venta' | 'consignacion' | null>(null)
const monto = ref('')
const idGaleria = ref('')
const errorModal = ref('')
const procesandoAccion = ref(false)
const confirmarDevolucion = ref(false)

const consignacionActiva = computed(() => pieza.value?.consignaciones?.[0] ?? null)
const opcionesGaleria = computed<OpcionSelect[]>(() =>
  catalogos.listas.galerias.map((g) => ({
    value: g.idGaleria as string,
    label: g.nombre,
  })),
)

function abrirModalVenta(): void {
  monto.value = pieza.value?.precioVenta ?? ''
  errorModal.value = ''
  modal.value = 'venta'
}

function abrirModalConsignacion(): void {
  idGaleria.value = ''
  errorModal.value = ''
  modal.value = 'consignacion'
}

/** HU-14: venta directa (Disponible) o reportada por la galería (En consignación). */
async function confirmarVenta(): Promise<void> {
  if (!(Number(monto.value) > 0)) {
    errorModal.value = 'El monto cobrado debe ser un número positivo.'
    return
  }
  procesandoAccion.value = true
  try {
    await store.registrarVenta(idArtesania, { montoCobrado: monto.value })
    modal.value = null
    await cargarPieza()
    snackbar.exito(
      `Venta registrada por $${Number(monto.value).toLocaleString('es-MX')}: la pieza pasó a estado «Vendida».`,
    )
  } catch (err) {
    errorModal.value = err instanceof ApiError ? err.message : 'No se pudo registrar la venta'
  } finally {
    procesandoAccion.value = false
  }
}

/** HU-13: solo piezas Disponibles; la galería es obligatoria (catálogos maestros). */
async function confirmarConsignacion(): Promise<void> {
  if (!idGaleria.value) {
    errorModal.value = 'Elige la galería o intermediario receptor.'
    return
  }
  procesandoAccion.value = true
  try {
    const consignacion = await store.enviarConsignacion(idArtesania, {
      idGaleria: idGaleria.value,
    })
    modal.value = null
    await cargarPieza()
    snackbar.exito(
      `Pieza enviada a consignación: ${consignacion.galeria?.nombre ?? 'galería seleccionada'}.`,
    )
  } catch (err) {
    errorModal.value =
      err instanceof ApiError ? err.message : 'No se pudo registrar la consignación'
  } finally {
    procesandoAccion.value = false
  }
}

async function registrarDevolucion(): Promise<void> {
  if (!consignacionActiva.value) return
  procesandoAccion.value = true
  try {
    await store.registrarDevolucion(consignacionActiva.value.idConsignacion)
    confirmarDevolucion.value = false
    await cargarPieza()
    snackbar.exito('Devolución registrada: la pieza vuelve a estar disponible.')
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'No se pudo registrar la devolución'
    confirmarDevolucion.value = false
  } finally {
    procesandoAccion.value = false
  }
}

function formatearMoneda(valor: number): string {
  return (
    '$' +
    valor.toLocaleString('es-MX', {
      minimumFractionDigits: Number.isInteger(valor) ? 0 : 2,
      maximumFractionDigits: 2,
    })
  )
}

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

onMounted(() => {
  cargarPieza()
  catalogos.cargar('galerias')
})

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
  const anterior = pieza.value?.fotos.find((f) => f.esPrincipal) ?? null
  try {
    await store.marcarFotoPrincipal(idArtesania, foto.idFoto)
    await cargarPieza()
    snackbar.exito(
      'Fotografía principal actualizada.',
      anterior
        ? async () => {
            await store.marcarFotoPrincipal(idArtesania, anterior.idFoto)
            await cargarPieza()
          }
        : undefined,
    )
  } catch (err) {
    snackbar.error(
      err instanceof ApiError ? err.message : 'No se pudo cambiar la fotografía principal',
    )
  }
}

/** CAM-014: eliminación sin justificación → Snackbar con «Deshacer», sin confirmación previa. */
async function eliminarFoto(foto: FotoArtesania): Promise<void> {
  avisoFotos.value = null
  try {
    await store.eliminarFoto(idArtesania, foto.idFoto)
    await cargarPieza()
    snackbar.exito('Fotografía eliminada.', async () => {
      await store.restaurarFoto(idArtesania, {
        rutaWebp: foto.rutaWebp,
        rutaJpeg: foto.rutaJpeg,
        esPrincipal: foto.esPrincipal,
      })
      await cargarPieza()
    })
  } catch (err) {
    snackbar.error(err instanceof ApiError ? err.message : 'No se pudo eliminar la fotografía')
  }
}

/** CAM-013: baja con justificación obligatoria; la confirmación sustituye al «Deshacer». */
async function eliminarPieza(motivo: string): Promise<void> {
  borrandoPieza.value = true
  try {
    await store.eliminar(idArtesania, motivo)
    snackbar.mostrar({ mensaje: `Pieza eliminada: ${pieza.value?.nombre ?? ''}.` })
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
    <!-- CAM-004: el identificador se retiró del encabezado; se consulta en la ficha técnica -->
    <TopBar :title="pieza?.nombre ?? 'Pieza'">
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
            <PhotoSlot :src="fotoPrincipal?.rutaWebp ?? ''" caption="Fotografía de la pieza" aspect="3 / 4" />
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
              <div v-if="pieza.horasTrabajadas" class="flex flex-col gap-1">
                <span class="etiqueta-campo">Horas de trabajo</span>
                <span class="valor-campo">{{ Number(pieza.horasTrabajadas) }} h</span>
              </div>
              <!-- CAM-004: identificador consultable con tratamiento secundario -->
              <div class="flex flex-col gap-1">
                <span class="etiqueta-campo">Identificador</span>
                <span
                  class="valor-campo"
                  :style="{ fontFamily: 'var(--font-mono)', color: 'var(--clay-600)' }"
                >
                  ART-{{ pieza.idArtesania.slice(0, 4).toUpperCase() }}
                </span>
              </div>
              <div v-if="consignacionActiva" class="flex flex-col gap-1">
                <span class="etiqueta-campo">Galería receptora</span>
                <span class="valor-campo">{{ consignacionActiva.galeria?.nombre ?? '—' }}</span>
              </div>
              <div v-if="pieza.venta" class="flex flex-col gap-1">
                <span class="etiqueta-campo">Venta registrada</span>
                <span class="valor-campo">
                  {{ formatearMoneda(Number(pieza.venta.montoCobrado)) }} ·
                  {{ formatearFecha(pieza.venta.fechaVenta) }} ·
                  {{ pieza.venta.idConsignacion ? 'Consignación' : 'Venta directa' }}
                </span>
              </div>
              <div class="flex flex-col gap-1 sm:col-span-2">
                <span class="etiqueta-campo">Descripción</span>
                <span class="valor-campo whitespace-pre-line">
                  {{ pieza.descripcion || 'Sin descripción registrada.' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Sprint 3: costeo (HU-8, HU-9) -->
          <div class="card card-padded">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 class="m-0" :style="{ font: '600 21px/1 var(--font-serif)', color: 'var(--green-900)' }">
                Costeo
              </h3>
              <BaseButton
                variant="secondary"
                size="sm"
                @click="router.push({ name: 'artesania-costeo', params: { id: pieza.idArtesania } })"
              >
                <template #icon><Calculator :size="16" /></template>
                Abrir calculadora
              </BaseButton>
            </div>
            <template v-if="(pieza.insumos?.length ?? 0) > 0 || pieza.horasTrabajadas">
              <div class="fila-costeo">
                <span>Insumos ({{ pieza.insumos?.length ?? 0 }})</span>
                <span>{{ formatearMoneda(totalInsumos) }}</span>
              </div>
              <div class="fila-costeo">
                <span>
                  Mano de obra ({{ Number(pieza.horasTrabajadas ?? 0) }} h ×
                  {{ formatearMoneda(Number(pieza.tarifaHora ?? 0)) }})
                </span>
                <span>{{ formatearMoneda(manoObra) }}</span>
              </div>
              <!-- CAM-002 / CAM-003: el precio final ocupa la línea destacada;
                   el sugerido queda como dato secundario de referencia -->
              <div
                class="flex items-baseline justify-between"
                :style="{ borderTop: '1.5px solid var(--cream-300)', marginTop: '10px', paddingTop: '12px' }"
              >
                <span :style="{ font: '700 16px/1 var(--font-sans)', color: 'var(--green-900)' }">
                  Precio final
                </span>
                <span
                  v-if="pieza.precioVenta"
                  :style="{ font: '400 26px/1 var(--font-serif)', color: 'var(--green-900)', fontWeight: 700 }"
                >
                  {{ formatearMoneda(Number(pieza.precioVenta)) }}
                </span>
                <span v-else :style="{ font: '500 17px/1 var(--font-sans)', color: 'var(--clay-500)' }">
                  Sin asignar
                </span>
              </div>
              <p
                class="mb-0 mt-2"
                :style="{ font: '500 14px/1.4 var(--font-sans)', color: 'var(--clay-600)' }"
              >
                Precio sugerido (referencia del costeo):
                <strong :style="{ color: 'var(--green-700)' }">
                  {{ formatearMoneda(precioSugerido) }}
                </strong>
              </p>
            </template>
            <p v-else class="m-0" :style="{ color: 'var(--clay-500)' }">
              Esta pieza aún no tiene costeo. Usa la calculadora para registrar insumos y horas
              de trabajo, y obtener un precio sugerido.
            </p>
          </div>

          <!-- Sprint 4: certificado de autenticidad (HU-10, HU-11) -->
          <div
            class="card card-padded"
            :style="{ background: 'var(--green-700)', border: 'none' }"
          >
            <div class="flex flex-wrap items-center gap-6">
              <img
                v-if="pieza.certificado"
                :src="rutaQrDe(pieza.certificado)"
                :alt="`Código QR de ${pieza.nombre}`"
                class="h-[132px] w-[132px] shrink-0"
                :style="{ borderRadius: 'var(--radius-md)', background: 'var(--cream-50)', padding: '6px' }"
              />
              <div class="min-w-0 flex-1" :style="{ minWidth: '260px' }">
                <h3 class="m-0" :style="{ font: '600 21px/1.1 var(--font-serif)', color: 'var(--cream-50)' }">
                  Certificado de autenticidad
                </h3>
                <template v-if="pieza.certificado">
                  <p
                    class="mb-4 mt-2"
                    :style="{ font: '400 15px/1.5 var(--font-sans)', color: 'var(--text-on-dark-muted)' }"
                  >
                    Emitido el {{ formatearFecha(pieza.certificado.fechaEmision) }} ·
                    {{ pieza.certificado._count?.verificaciones ?? 0 }} verificaciones públicas
                    registradas.
                  </p>
                  <div class="flex flex-wrap gap-3">
                    <a :href="pieza.certificado.rutaPdf" target="_blank" class="btn btn-accent">
                      <Download :size="18" />
                      Descargar certificado (PDF)
                    </a>
                    <RouterLink
                      :to="{ name: 'verificacion-publica', params: { id: pieza.certificado.idCertificado } }"
                      target="_blank"
                      class="btn btn-secondary"
                      :style="{ color: 'var(--cream-50)', borderColor: 'rgba(255,255,255,0.4)', background: 'transparent' }"
                    >
                      <ExternalLink :size="18" />
                      Ver ficha pública
                    </RouterLink>
                  </div>
                </template>
                <template v-else>
                  <p
                    class="mb-4 mt-2"
                    :style="{ font: '400 15px/1.5 var(--font-sans)', color: 'var(--text-on-dark-muted)' }"
                  >
                    Genera un código QR único vinculado a la ficha pública y un certificado en
                    PDF para entregar al cliente. Requiere al menos una fotografía y un precio
                    de venta final.
                  </p>
                  <div class="flex flex-wrap items-center gap-3">
                    <BaseButton
                      variant="accent"
                      :disabled="!puedeEmitir || emitiendo"
                      @click="emitirCertificado"
                    >
                      <template #icon><BadgeCheck :size="18" /></template>
                      {{ emitiendo ? 'Emitiendo…' : 'Emitir certificado' }}
                    </BaseButton>
                    <span
                      v-if="!puedeEmitir"
                      :style="{ font: '500 14px/1.3 var(--font-sans)', color: 'var(--text-on-dark-muted)' }"
                    >
                      Falta{{ pieza.fotos.length === 0 && !pieza.precioVenta ? 'n' : '' }}
                      {{ pieza.fotos.length === 0 ? 'fotografía' : '' }}
                      {{ pieza.fotos.length === 0 && !pieza.precioVenta ? ' y ' : '' }}
                      {{ !pieza.precioVenta ? 'precio de venta final' : '' }}.
                    </span>
                  </div>
                </template>
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
                  :src="foto.rutaWebp"
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
                  <!-- CAM-014: eliminación directa con opción de deshacer desde el aviso -->
                  <button
                    v-if="editable"
                    type="button"
                    class="cursor-pointer"
                    :style="{ color: 'var(--terracotta-500)' }"
                    title="Eliminar fotografía"
                    @click="eliminarFoto(foto)"
                  >
                    <Trash2 :size="15" />
                  </button>
                </figcaption>
              </figure>
            </div>
          </div>

          <!-- Sprint 5: ciclo de vida (HU-13, HU-14) -->
          <div class="flex flex-wrap items-center gap-3">
            <BaseButton v-if="editable" variant="primary" @click="abrirModalVenta">
              <template #icon><Check :size="18" /></template>
              Registrar venta
            </BaseButton>
            <BaseButton
              v-if="pieza.estado === 'DISPONIBLE'"
              variant="secondary"
              @click="abrirModalConsignacion"
            >
              <template #icon><Store :size="18" /></template>
              Enviar a consignación
            </BaseButton>
            <BaseButton
              v-if="pieza.estado === 'EN_CONSIGNACION'"
              variant="secondary"
              @click="confirmarDevolucion = true"
            >
              <template #icon><Undo2 :size="18" /></template>
              Registrar devolución
            </BaseButton>
            <BaseButton
              variant="ghost"
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
              Pieza vendida: la ficha ya no puede editarse ni enviarse a consignación.
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- CAM-013: la baja exige justificación; la pieza sale del inventario y de los reportes -->
    <ConfirmDialog
      :abierto="confirmarBorrarPieza"
      titulo="Eliminar pieza"
      :mensaje="`¿Deseas eliminar «${pieza?.nombre}» de tu inventario? La pieza dejará de aparecer en tus listados y reportes. Si ya tiene certificado, quien escanee el código QR verá que la pieza fue dada de baja.`"
      :procesando="borrandoPieza"
      con-motivo
      @confirmar="eliminarPieza"
      @cancelar="confirmarBorrarPieza = false"
    />

    <!-- HU-14: registro de venta final -->
    <BaseModal
      :abierto="modal === 'venta'"
      titulo="Registrar venta"
      :ancho="460"
      @cerrar="modal = null"
    >
      <div class="flex flex-col gap-3.5">
        <p class="m-0">
          Vas a registrar la venta de <strong>{{ pieza?.nombre }}</strong>. La pieza pasará a
          estado «Vendida» y ya no podrá editarse ni enviarse a consignación.
        </p>
        <p v-if="consignacionActiva" class="m-0" :style="{ color: 'var(--amber-700)' }">
          La pieza está en consignación con
          <strong>{{ consignacionActiva.galeria?.nombre }}</strong
          >; la venta se registrará como reportada por la galería.
        </p>
        <TextField
          v-model="monto"
          label="Monto final cobrado"
          type="number"
          min="0"
          step="any"
          required
          :error="errorModal"
          help-text="Precio real de la transacción; puede diferir del precio de lista."
          @update:model-value="errorModal = ''"
        />
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="modal = null">Cancelar</BaseButton>
        <BaseButton variant="primary" :disabled="procesandoAccion" @click="confirmarVenta">
          {{ procesandoAccion ? 'Registrando…' : 'Confirmar venta' }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- HU-13: registro de salida a consignación -->
    <BaseModal
      :abierto="modal === 'consignacion'"
      titulo="Enviar a consignación"
      :ancho="460"
      tone="consignment"
      @cerrar="modal = null"
    >
      <div class="flex flex-col gap-3.5">
        <p class="m-0">
          Elige la galería o intermediario que recibirá <strong>{{ pieza?.nombre }}</strong
          >. La pieza saldrá del taller pero seguirá en tu registro hasta que se pague.
        </p>
        <SelectField
          v-model="idGaleria"
          label="Galería receptora"
          placeholder="Elige una galería del catálogo"
          required
          :options="opcionesGaleria"
          :error="errorModal"
          @update:model-value="errorModal = ''"
        />
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="modal = null">Cancelar</BaseButton>
        <BaseButton variant="accent" :disabled="procesandoAccion" @click="confirmarConsignacion">
          {{ procesandoAccion ? 'Enviando…' : 'Enviar a consignación' }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Devolución de consignación activa -->
    <BaseModal
      :abierto="confirmarDevolucion"
      titulo="Registrar devolución"
      :ancho="460"
      tone="consignment"
      @cerrar="confirmarDevolucion = false"
    >
      <p class="m-0">
        La galería <strong>{{ consignacionActiva?.galeria?.nombre }}</strong> devuelve
        «{{ pieza?.nombre }}» sin venderse. La pieza volverá a estar disponible en tu
        inventario.
      </p>
      <template #footer>
        <BaseButton variant="ghost" @click="confirmarDevolucion = false">Cancelar</BaseButton>
        <BaseButton variant="accent" :disabled="procesandoAccion" @click="registrarDevolucion">
          {{ procesandoAccion ? 'Registrando…' : 'Registrar devolución' }}
        </BaseButton>
      </template>
    </BaseModal>
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
.fila-costeo {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font: 500 16px / 1.4 var(--font-sans);
  color: var(--clay-700);
}
</style>
