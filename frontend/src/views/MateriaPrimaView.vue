<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus, Receipt, Package2, Truck, Trash2 } from '@lucide/vue'
import TopBar from '@/components/ui/TopBar.vue'
import StatCard from '@/components/ui/StatCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseModal from '@/components/BaseModal.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import TextField from '@/components/ui/TextField.vue'
import SelectField, { type OpcionSelect } from '@/components/ui/SelectField.vue'
import { useComprasStore } from '@/stores/compras'
import { useProveedoresStore } from '@/stores/proveedores'
import { useMateriasPrimasStore } from '@/stores/materiasPrimas'
import { ApiError } from '@/lib/api'
import { ETIQUETA_UNIDAD, type Compra } from '@/types'

const comprasStore = useComprasStore()
const proveedoresStore = useProveedoresStore()
const materiasStore = useMateriasPrimasStore()

const modalAbierto = ref(false)
const formulario = reactive({
  idMateria: '',
  idProveedor: '',
  cantidad: '',
  costoUnitario: '',
  fecha: '',
  folioNota: '',
})
const errores = reactive<Record<string, string>>({})
const guardando = ref(false)
const aviso = ref<{ texto: string; tono: 'success' | 'error' } | null>(null)
const eliminando = ref<Compra | null>(null)
const borrando = ref(false)

onMounted(() => {
  comprasStore.cargar()
  proveedoresStore.cargar()
  materiasStore.cargar()
})

interface FilaEntrada {
  clave: string
  compra: Compra
  fecha: string
  folio: string
  insumo: string
  unidad: string
  proveedor: string
  cantidad: string
  importe: number
}

const filas = computed<FilaEntrada[]>(() =>
  comprasStore.compras.flatMap((compra) =>
    compra.detalles.map((detalle) => ({
      clave: detalle.idDetalle,
      compra,
      fecha: compra.fecha,
      folio: compra.folioNota ?? '—',
      insumo: detalle.materiaPrima?.nombre ?? '—',
      unidad: detalle.materiaPrima ? ETIQUETA_UNIDAD[detalle.materiaPrima.unidadMedida] : '',
      proveedor: compra.proveedor?.nombre ?? '—',
      cantidad: detalle.cantidad,
      importe: Number(detalle.cantidad) * Number(detalle.costoUnitario),
    })),
  ),
)

const gastoTotal = computed(() => filas.value.reduce((suma, fila) => suma + fila.importe, 0))
const proveedoresActivos = computed(
  () => new Set(comprasStore.compras.map((compra) => compra.idProveedor)).size,
)

const opcionesMateria = computed<OpcionSelect[]>(() =>
  materiasStore.materias.map((materia) => ({
    value: materia.idMateria,
    label: `${materia.nombre} (${ETIQUETA_UNIDAD[materia.unidadMedida]})`,
  })),
)
const opcionesProveedor = computed<OpcionSelect[]>(() =>
  proveedoresStore.proveedores.map((proveedor) => ({
    value: proveedor.idProveedor,
    label: proveedor.nombre,
  })),
)

const unidadSeleccionada = computed(() => {
  const materia = materiasStore.materias.find((m) => m.idMateria === formulario.idMateria)
  return materia ? ETIQUETA_UNIDAD[materia.unidadMedida] : ''
})

const totalFormulario = computed(() => {
  const total = Number(formulario.cantidad) * Number(formulario.costoUnitario)
  return Number.isFinite(total) && total > 0 ? total : 0
})

function abrirAlta(): void {
  Object.assign(formulario, {
    idMateria: '',
    idProveedor: '',
    cantidad: '',
    costoUnitario: '',
    fecha: '',
    folioNota: '',
  })
  for (const clave of Object.keys(errores)) delete errores[clave]
  modalAbierto.value = true
}

async function guardar(): Promise<void> {
  for (const clave of Object.keys(errores)) delete errores[clave]
  if (!formulario.idMateria) errores.idMateria = 'Selecciona el insumo.'
  if (!formulario.idProveedor) errores.idProveedor = 'El proveedor no puede quedar vacío.'
  if (!(Number(formulario.cantidad) > 0)) errores.cantidad = 'La cantidad debe ser mayor a cero.'
  if (!(Number(formulario.costoUnitario) > 0))
    errores.costoUnitario = 'El costo debe ser mayor a cero.'
  if (Object.keys(errores).length > 0) return

  guardando.value = true
  try {
    await comprasStore.crear({
      idProveedor: formulario.idProveedor,
      folioNota: formulario.folioNota.trim() || undefined,
      fecha: formulario.fecha || undefined,
      detalles: [
        {
          idMateria: formulario.idMateria,
          cantidad: Number(formulario.cantidad),
          costoUnitario: Number(formulario.costoUnitario),
        },
      ],
    })
    modalAbierto.value = false
    aviso.value = { texto: 'Entrada de materia prima registrada.', tono: 'success' }
  } catch (err) {
    errores.costoUnitario =
      err instanceof ApiError ? err.message : 'No se pudo registrar la entrada'
  } finally {
    guardando.value = false
  }
}

async function confirmarEliminar(): Promise<void> {
  if (!eliminando.value) return
  borrando.value = true
  try {
    await comprasStore.eliminar(eliminando.value.idCompra)
    aviso.value = { texto: 'Entrada eliminada del historial.', tono: 'success' }
  } catch (err) {
    aviso.value = {
      texto: err instanceof ApiError ? err.message : 'No se pudo eliminar la entrada',
      tono: 'error',
    }
  } finally {
    eliminando.value = null
    borrando.value = false
  }
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { dateStyle: 'medium', timeZone: 'UTC' })
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
    <TopBar title="Materia prima" subtitle="Compras de insumos y proveedores">
      <template #actions>
        <BaseButton variant="accent" @click="abrirAlta">
          <template #icon><Plus :size="18" /></template>
          Registrar entrada
        </BaseButton>
      </template>
    </TopBar>

    <div class="flex flex-col gap-6" :style="{ padding: 'var(--page-pad)' }">
      <BaseAlert v-if="aviso" :tone="aviso.tono" @cerrar="aviso = null">{{ aviso.texto }}</BaseAlert>

      <div class="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard label="Gasto en insumos" :value="formatearMoneda(gastoTotal)" hint="Acumulado">
          <template #icon><Receipt :size="20" /></template>
        </StatCard>
        <StatCard label="Entradas registradas" :value="filas.length" tone="green">
          <template #icon><Package2 :size="20" /></template>
        </StatCard>
        <StatCard label="Proveedores con compras" :value="proveedoresActivos" tone="amber">
          <template #icon><Truck :size="20" /></template>
        </StatCard>
      </div>

      <div>
        <h3 class="mb-3.5 mt-0" :style="{ font: '600 var(--text-h3)/1 var(--font-serif)', color: 'var(--green-900)' }">
          Historial de compras
        </h3>
        <DataTable
          :columns="[
            { key: 'folio', header: 'Folio', width: '110px' },
            { key: 'fecha', header: 'Fecha', width: '140px' },
            { key: 'insumo', header: 'Insumo' },
            { key: 'proveedor', header: 'Proveedor' },
            { key: 'cantidad', header: 'Cantidad', align: 'right' },
            { key: 'importe', header: 'Costo', align: 'right' },
            { key: 'acciones', header: '', width: '70px', align: 'right' },
          ]"
          :rows="filas"
          :row-key="(fila: FilaEntrada) => fila.clave"
          empty="Aún no hay compras registradas. Usa «Registrar entrada» para capturar la primera."
        >
          <template #cell-folio="{ row }">
            <span :style="{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--clay-600)' }">
              {{ row.folio }}
            </span>
          </template>
          <template #cell-fecha="{ row }">{{ formatearFecha(row.fecha) }}</template>
          <template #cell-insumo="{ row }">
            <strong :style="{ color: 'var(--green-900)' }">{{ row.insumo }}</strong>
          </template>
          <template #cell-cantidad="{ row }">{{ row.cantidad }} {{ row.unidad }}</template>
          <template #cell-importe="{ row }">
            <strong>{{ formatearMoneda(row.importe) }}</strong>
          </template>
          <template #cell-acciones="{ row }">
            <button
              type="button"
              class="boton-icono-peligro"
              title="Eliminar entrada"
              @click="eliminando = row.compra"
            >
              <Trash2 :size="18" />
            </button>
          </template>
        </DataTable>
      </div>
    </div>

    <BaseModal
      :abierto="modalAbierto"
      titulo="Registrar entrada de materia prima"
      :ancho="540"
      @cerrar="modalAbierto = false"
    >
      <div class="flex flex-col gap-4">
        <SelectField
          v-model="formulario.idMateria"
          label="Insumo"
          placeholder="Elige un material"
          required
          :options="opcionesMateria"
          :error="errores.idMateria ?? ''"
          :help-text="opcionesMateria.length === 0 ? 'Primero registra materiales en Catálogos → Materiales.' : ''"
        />
        <SelectField
          v-model="formulario.idProveedor"
          label="Proveedor"
          placeholder="Elige un proveedor"
          required
          :options="opcionesProveedor"
          :error="errores.idProveedor ?? ''"
          :help-text="opcionesProveedor.length === 0 ? 'Primero registra proveedores en Catálogos → Proveedores.' : ''"
        />
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            v-model="formulario.cantidad"
            label="Cantidad"
            type="number"
            min="0.001"
            step="0.001"
            placeholder="p. ej. 50"
            required
            :error="errores.cantidad ?? ''"
          />
          <TextField
            :model-value="unidadSeleccionada"
            label="Unidad de medida"
            placeholder="Según el material"
            disabled
            help-text="Se toma del catálogo del material."
          />
          <TextField
            v-model="formulario.costoUnitario"
            label="Costo unitario"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0"
            required
            :error="errores.costoUnitario ?? ''"
          />
          <TextField v-model="formulario.fecha" label="Fecha" type="date" />
        </div>
        <TextField
          v-model="formulario.folioNota"
          label="Folio de nota"
          placeholder="Opcional"
          :maxlength="50"
        />
        <p
          v-if="totalFormulario > 0"
          class="m-0 text-right"
          :style="{ font: '700 var(--text-body)/1 var(--font-sans)', color: 'var(--green-900)' }"
        >
          Costo total: {{ formatearMoneda(totalFormulario) }}
        </p>
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="modalAbierto = false">Cancelar</BaseButton>
        <BaseButton variant="primary" :disabled="guardando" @click="guardar">
          {{ guardando ? 'Guardando…' : 'Guardar entrada' }}
        </BaseButton>
      </template>
    </BaseModal>

    <ConfirmDialog
      :abierto="eliminando !== null"
      titulo="Eliminar entrada"
      mensaje="¿Deseas eliminar esta entrada de materia prima? También se eliminará del historial de precios."
      :procesando="borrando"
      @confirmar="confirmarEliminar"
      @cancelar="eliminando = null"
    />
  </div>
</template>

<style scoped>
.boton-icono-peligro {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  border: none;
  background: transparent;
  color: var(--terracotta-500);
  cursor: pointer;
  transition: background var(--duration-fast);
}
.boton-icono-peligro:hover {
  background: var(--cream-200);
}
</style>
