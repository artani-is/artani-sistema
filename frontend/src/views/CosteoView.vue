<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Check, Plus, Save, Trash2 } from '@lucide/vue'
import TopBar from '@/components/ui/TopBar.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import TextField from '@/components/ui/TextField.vue'
import SelectField, { type OpcionSelect } from '@/components/ui/SelectField.vue'
import { useArtesaniasStore } from '@/stores/artesanias'
import { useMateriasPrimasStore } from '@/stores/materiasPrimas'
import { ApiError } from '@/lib/api'
import { ETIQUETA_UNIDAD, type Artesania } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useArtesaniasStore()
const materiasStore = useMateriasPrimasStore()

const idArtesania = route.params.id as string
const pieza = ref<Artesania | null>(null)
const cargando = ref(true)
const error = ref<string | null>(null)
const exito = ref<string | null>(null)
const guardando = ref(false)
const asignando = ref(false)

interface FilaInsumo {
  clave: number
  idMateria: string
  cantidad: string
  costo: string
}

let claveSiguiente = 1
const filas = ref<FilaInsumo[]>([])
const horas = ref('')
const tarifa = ref('')
const margen = ref('0')
const precioFinal = ref('')

const bloqueada = computed(() => pieza.value?.estado === 'VENDIDA')

const opcionesMateria = computed<OpcionSelect[]>(() =>
  materiasStore.materias.map((m) => ({
    value: m.idMateria,
    label: `${m.nombre} (${ETIQUETA_UNIDAD[m.unidadMedida]})`,
  })),
)

function unidadDe(idMateria: string): string {
  const materia = materiasStore.materias.find((m) => m.idMateria === idMateria)
  return materia ? ETIQUETA_UNIDAD[materia.unidadMedida] : '—'
}

// Resumen del cálculo (HU-8): insumos + mano de obra, actualizado dinámicamente
const totalInsumos = computed(() =>
  filas.value.reduce((suma, f) => suma + (Number(f.cantidad) || 0) * (Number(f.costo) || 0), 0),
)
const manoObra = computed(() => (Number(horas.value) || 0) * (Number(tarifa.value) || 0))
const subtotal = computed(() => totalInsumos.value + manoObra.value)
const montoMargen = computed(() => subtotal.value * ((Number(margen.value) || 0) / 100))
const sugerido = computed(() => Math.round(subtotal.value + montoMargen.value))

// HU-8: advertir (sin bloquear) cuando horas o tarifa son cero
const advertenciaTrabajo = computed(
  () =>
    !bloqueada.value &&
    filas.value.length > 0 &&
    ((Number(horas.value) || 0) === 0 || (Number(tarifa.value) || 0) === 0),
)

onMounted(async () => {
  try {
    const [datos] = await Promise.all([store.obtener(idArtesania), materiasStore.cargar()])
    pieza.value = datos
    horas.value = datos.horasTrabajadas ?? ''
    tarifa.value = datos.tarifaHora ?? ''
    precioFinal.value = datos.precioVenta ?? ''
    filas.value = (datos.insumos ?? []).map((insumo) => ({
      clave: claveSiguiente++,
      idMateria: insumo.idMateria,
      cantidad: insumo.cantidadUsada,
      costo: insumo.costoUnitarioUso,
    }))
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'No se pudo cargar la pieza'
  } finally {
    cargando.value = false
  }
})

function agregarFila(): void {
  filas.value.push({ clave: claveSiguiente++, idMateria: '', cantidad: '', costo: '' })
}

function quitarFila(clave: number): void {
  filas.value = filas.value.filter((f) => f.clave !== clave)
}

/** HU-8: al elegir la materia, el costo se propone desde la compra más reciente. */
async function alCambiarMateria(fila: FilaInsumo): Promise<void> {
  if (!fila.idMateria) return
  try {
    const [ultimaCompra] = await materiasStore.historialPrecios(fila.idMateria)
    if (ultimaCompra) {
      fila.costo = ultimaCompra.costoUnitario
    }
  } catch {
    // Sin historial: el artesano captura el costo manualmente
  }
}

function validarFilas(): boolean {
  for (const fila of filas.value) {
    if (!fila.idMateria || !(Number(fila.cantidad) > 0) || !(Number(fila.costo) > 0)) {
      error.value =
        'Cada insumo necesita materia prima, cantidad y costo unitario mayores a cero'
      return false
    }
  }
  return true
}

async function guardarCosteo(): Promise<boolean> {
  error.value = null
  exito.value = null
  if (!validarFilas()) return false
  guardando.value = true
  try {
    await store.guardarInsumos(
      idArtesania,
      filas.value.map((f) => ({
        idMateria: f.idMateria,
        cantidadUsada: f.cantidad,
        costoUnitarioUso: f.costo,
      })),
    )
    await store.guardarCosteo(idArtesania, {
      horasTrabajadas: horas.value || '0',
      tarifaHora: tarifa.value || '0',
    })
    exito.value = 'Costeo guardado correctamente.'
    return true
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'No se pudo guardar el costeo'
    return false
  } finally {
    guardando.value = false
  }
}

/** HU-9: el artesano fija el precio final (puede diferir del sugerido). */
async function asignarPrecioFinal(): Promise<void> {
  const precio = precioFinal.value || String(sugerido.value)
  if (!(Number(precio) > 0)) {
    error.value = 'El precio de venta final debe ser un número positivo'
    return
  }
  asignando.value = true
  try {
    if (!(await guardarCosteo())) return
    await store.asignarPrecio(idArtesania, precio)
    exito.value = `Precio de venta asignado: ${formatearMoneda(Number(precio))}.`
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'No se pudo asignar el precio'
  } finally {
    asignando.value = false
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
</script>

<template>
  <div>
    <TopBar
      title="Calculadora de costeo"
      :subtitle="pieza ? `${pieza.nombre} · precio sugerido a partir de insumos y horas` : ''"
    >
      <template #actions>
        <BaseButton
          variant="ghost"
          @click="router.push({ name: 'artesania-detalle', params: { id: idArtesania } })"
        >
          <template #icon><ArrowLeft :size="18" /></template>
          Volver a la ficha
        </BaseButton>
      </template>
    </TopBar>

    <div :style="{ padding: 'var(--page-pad)' }">
      <p v-if="cargando" :style="{ color: 'var(--clay-500)' }">Cargando costeo…</p>

      <div v-else class="grid grid-cols-1 items-start gap-7 xl:grid-cols-[1fr_360px]">
        <div class="card card-padded flex flex-col gap-6">
          <BaseAlert v-if="error" tone="error" @cerrar="error = null">{{ error }}</BaseAlert>
          <BaseAlert v-if="exito" tone="success" @cerrar="exito = null">{{ exito }}</BaseAlert>
          <BaseAlert v-if="bloqueada" tone="warning" :closable="false">
            Pieza vendida: el costeo es de solo lectura.
          </BaseAlert>
          <BaseAlert v-else-if="advertenciaTrabajo" tone="warning" :closable="false">
            Las horas o la tarifa están en cero: el precio sugerido podría no reflejar el
            trabajo real.
          </BaseAlert>

          <div>
            <div class="mb-3 flex items-center justify-between">
              <h3 class="m-0" :style="{ font: '600 21px/1 var(--font-serif)', color: 'var(--green-900)' }">
                Insumos
              </h3>
              <BaseButton v-if="!bloqueada" variant="secondary" size="sm" @click="agregarFila">
                <template #icon><Plus :size="16" /></template>
                Agregar insumo
              </BaseButton>
            </div>

            <p v-if="filas.length === 0" class="m-0" :style="{ color: 'var(--clay-500)' }">
              Agrega los materiales consumidos por esta pieza; el costo se propone desde la
              compra más reciente.
            </p>
            <div v-else class="flex flex-col gap-3">
              <div
                v-for="(fila, indice) in filas"
                :key="fila.clave"
                class="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_110px_150px_130px_auto]"
              >
                <SelectField
                  v-model="fila.idMateria"
                  :label="indice === 0 ? 'Insumo' : ''"
                  placeholder="Elige un material"
                  :options="opcionesMateria"
                  :disabled="bloqueada"
                  @update:model-value="alCambiarMateria(fila)"
                />
                <TextField
                  v-model="fila.cantidad"
                  :label="indice === 0 ? 'Cantidad' : ''"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  :disabled="bloqueada"
                />
                <TextField
                  :label="indice === 0 ? 'Unidad' : ''"
                  :model-value="fila.idMateria ? unidadDe(fila.idMateria) : ''"
                  placeholder="—"
                  disabled
                />
                <TextField
                  v-model="fila.costo"
                  :label="indice === 0 ? 'Costo unitario' : ''"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  :disabled="bloqueada"
                />
                <button
                  v-if="!bloqueada"
                  type="button"
                  class="boton-quitar"
                  title="Quitar insumo"
                  @click="quitarFila(fila.clave)"
                >
                  <Trash2 :size="18" />
                </button>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              v-model="horas"
              label="Horas de trabajo"
              type="number"
              min="0"
              step="any"
              placeholder="0"
              :disabled="bloqueada"
              help-text="Puede ser cero, con advertencia."
            />
            <TextField
              v-model="tarifa"
              label="Tarifa por hora"
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              :disabled="bloqueada"
            />
          </div>

          <div v-if="!bloqueada">
            <BaseButton variant="primary" :disabled="guardando" @click="guardarCosteo">
              <template #icon><Save :size="18" /></template>
              {{ guardando ? 'Guardando…' : 'Guardar costeo' }}
            </BaseButton>
          </div>
        </div>

        <!-- Resumen (HU-8): cálculo dinámico -->
        <div
          class="card card-padded flex flex-col gap-4 xl:sticky xl:top-5"
          :style="{ background: 'var(--cream-50)' }"
        >
          <h3 class="m-0" :style="{ font: '600 21px/1 var(--font-serif)', color: 'var(--green-900)' }">
            Resumen
          </h3>
          <div class="fila-resumen">
            <span>Insumos</span><span>{{ formatearMoneda(totalInsumos) }}</span>
          </div>
          <div class="fila-resumen">
            <span>Mano de obra ({{ Number(horas) || 0 }} h)</span>
            <span>{{ formatearMoneda(manoObra) }}</span>
          </div>
          <div class="fila-resumen fila-fuerte">
            <span>Subtotal</span><span>{{ formatearMoneda(subtotal) }}</span>
          </div>
          <TextField
            v-model="margen"
            label="Margen (%)"
            type="number"
            min="0"
            step="any"
            :disabled="bloqueada"
            help-text="Ajuste opcional sobre el subtotal."
          />
          <div
            class="flex flex-col gap-0.5"
            :style="{
              background: 'var(--green-700)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 18px',
            }"
          >
            <span
              :style="{
                font: '700 13px/1 var(--font-sans)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-on-dark-muted)',
              }"
            >
              Precio sugerido
            </span>
            <span :style="{ font: '400 38px/1 var(--font-serif)', color: 'var(--cream-50)' }">
              {{ formatearMoneda(sugerido) }}
            </span>
          </div>
          <TextField
            v-model="precioFinal"
            label="Precio de venta final"
            type="number"
            min="0"
            step="any"
            :placeholder="String(sugerido)"
            :disabled="bloqueada"
            help-text="Puedes ajustar el precio sugerido (HU-9)."
          />
          <BaseButton
            v-if="!bloqueada"
            variant="accent"
            :disabled="asignando"
            @click="asignarPrecioFinal"
          >
            <template #icon><Check :size="18" /></template>
            {{ asignando ? 'Asignando…' : 'Asignar precio final' }}
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fila-resumen {
  display: flex;
  justify-content: space-between;
  font: 500 16px / 1.3 var(--font-sans);
  color: var(--clay-700);
}
.fila-fuerte {
  font-weight: 700;
  color: var(--green-900);
  padding-top: 8px;
  border-top: 1.5px solid var(--cream-300);
}
.boton-quitar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--cream-300);
  background: transparent;
  color: var(--terracotta-500);
  cursor: pointer;
  transition: background var(--duration-fast);
}
.boton-quitar:hover {
  background: var(--terracotta-100);
}
</style>
