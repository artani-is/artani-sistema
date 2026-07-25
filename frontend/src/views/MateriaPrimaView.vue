<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus, Receipt, Package2, Truck, Trash2, Pencil } from '@lucide/vue'
import TopBar from '@/components/ui/TopBar.vue'
import StatCard from '@/components/ui/StatCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/BaseModal.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import TextField from '@/components/ui/TextField.vue'
import SelectField, { type OpcionSelect } from '@/components/ui/SelectField.vue'
import { useComprasStore, type DatosCompra } from '@/stores/compras'
import { useProveedoresStore } from '@/stores/proveedores'
import { useMateriasPrimasStore } from '@/stores/materiasPrimas'
import { useSnackbarStore } from '@/stores/snackbar'
import { ApiError } from '@/lib/api'
import { UNIDAD_CORTA, type Compra } from '@/types'

const comprasStore = useComprasStore()
const proveedoresStore = useProveedoresStore()
const materiasStore = useMateriasPrimasStore()
const snackbar = useSnackbarStore()

const modalAbierto = ref(false)
/** CAM-010: la compra en edición; null cuando el formulario es de alta. */
const editando = ref<Compra | null>(null)
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
const eliminando = ref<FilaEntrada | null>(null)
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
      // CAM-011: unidad abreviada en columna propia
      unidad: detalle.materiaPrima ? UNIDAD_CORTA[detalle.materiaPrima.unidadMedida] : '—',
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
    label: `${materia.nombre} (${UNIDAD_CORTA[materia.unidadMedida]})`,
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
  return materia ? UNIDAD_CORTA[materia.unidadMedida] : ''
})

const totalFormulario = computed(() => {
  const total = Number(formulario.cantidad) * Number(formulario.costoUnitario)
  return Number.isFinite(total) && total > 0 ? total : 0
})

function abrirAlta(): void {
  editando.value = null
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

/** CAM-010: abre el formulario con los datos de la compra precargados. */
function abrirEdicion(fila: FilaEntrada): void {
  const detalle = fila.compra.detalles[0]
  editando.value = fila.compra
  Object.assign(formulario, {
    idMateria: detalle?.idMateria ?? '',
    idProveedor: fila.compra.idProveedor,
    cantidad: detalle?.cantidad ?? '',
    costoUnitario: detalle?.costoUnitario ?? '',
    fecha: fila.compra.fecha.slice(0, 10),
    folioNota: fila.compra.folioNota ?? '',
  })
  for (const clave of Object.keys(errores)) delete errores[clave]
  modalAbierto.value = true
}

function datosDe(compra: Compra): DatosCompra {
  return {
    idProveedor: compra.idProveedor,
    folioNota: compra.folioNota ?? undefined,
    fecha: compra.fecha.slice(0, 10),
    detalles: compra.detalles.map((d) => ({
      idMateria: d.idMateria,
      cantidad: Number(d.cantidad),
      costoUnitario: Number(d.costoUnitario),
    })),
  }
}

async function guardar(): Promise<void> {
  for (const clave of Object.keys(errores)) delete errores[clave]
  if (!formulario.idMateria) errores.idMateria = 'Selecciona el insumo.'
  if (!formulario.idProveedor) errores.idProveedor = 'El proveedor no puede quedar vacío.'
  if (!(Number(formulario.cantidad) > 0)) errores.cantidad = 'La cantidad debe ser mayor a cero.'
  if (!(Number(formulario.costoUnitario) > 0))
    errores.costoUnitario = 'El costo debe ser mayor a cero.'
  if (Object.keys(errores).length > 0) return

  const datos: DatosCompra = {
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
  }

  guardando.value = true
  try {
    if (editando.value) {
      const anterior = datosDe(editando.value)
      const id = editando.value.idCompra
      await comprasStore.actualizar(id, datos)
      modalAbierto.value = false
      snackbar.exito('Compra actualizada.', async () => {
        await comprasStore.actualizar(id, anterior)
      })
    } else {
      const compra = await comprasStore.crear(datos)
      modalAbierto.value = false
      snackbar.exito('Entrada de materia prima registrada.', async () => {
        await comprasStore.eliminar(compra.idCompra, 'Alta deshecha con el botón «Deshacer»')
      })
    }
  } catch (err) {
    errores.costoUnitario =
      err instanceof ApiError ? err.message : 'No se pudo guardar la entrada'
  } finally {
    guardando.value = false
  }
}

/** CAM-012: eliminación con motivo obligatorio y confirmación; sin «Deshacer» posterior. */
async function confirmarEliminar(motivo: string): Promise<void> {
  if (!eliminando.value) return
  borrando.value = true
  try {
    await comprasStore.eliminar(eliminando.value.compra.idCompra, motivo)
    snackbar.mostrar({ mensaje: 'Entrada eliminada del historial.' })
  } catch (err) {
    snackbar.error(err instanceof ApiError ? err.message : 'No se pudo eliminar la entrada')
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
        <!-- CAM-011: cantidad y unidad en columnas independientes -->
        <DataTable
          :columns="[
            { key: 'folio', header: 'Folio', width: '110px' },
            { key: 'fecha', header: 'Fecha', width: '140px' },
            { key: 'insumo', header: 'Insumo' },
            { key: 'proveedor', header: 'Proveedor' },
            { key: 'cantidad', header: 'Cantidad', align: 'right' },
            { key: 'unidad', header: 'Unidad', width: '100px' },
            { key: 'importe', header: 'Costo', align: 'right' },
            { key: 'acciones', header: '', width: '110px', align: 'right' },
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
          <template #cell-cantidad="{ row }">{{ Number(row.cantidad) }}</template>
          <template #cell-unidad="{ row }">{{ row.unidad }}</template>
          <template #cell-importe="{ row }">
            <strong>{{ formatearMoneda(row.importe) }}</strong>
          </template>
          <!-- CAM-010 / CAM-012: editar es la acción principal; eliminar queda subordinada -->
          <template #cell-acciones="{ row }">
            <span class="inline-flex gap-1">
              <button
                type="button"
                class="boton-icono"
                title="Editar entrada"
                @click="abrirEdicion(row)"
              >
                <Pencil :size="18" />
              </button>
              <button
                type="button"
                class="boton-icono boton-icono-peligro"
                title="Eliminar entrada"
                @click="eliminando = row"
              >
                <Trash2 :size="18" />
              </button>
            </span>
          </template>
        </DataTable>
      </div>
    </div>

    <BaseModal
      :abierto="modalAbierto"
      :titulo="editando ? 'Editar entrada de materia prima' : 'Registrar entrada de materia prima'"
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
          {{ guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar entrada' }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- CAM-012: motivo obligatorio + confirmación con resumen de la compra -->
    <ConfirmDialog
      :abierto="eliminando !== null"
      titulo="Eliminar entrada"
      mensaje="Vas a eliminar esta entrada del historial de compras y del historial de precios:"
      :procesando="borrando"
      con-motivo
      @confirmar="confirmarEliminar"
      @cancelar="eliminando = null"
    >
      <div v-if="eliminando" class="resumen-compra">
        <div><span>Fecha</span><strong>{{ formatearFecha(eliminando.fecha) }}</strong></div>
        <div><span>Insumo</span><strong>{{ eliminando.insumo }}</strong></div>
        <div><span>Proveedor</span><strong>{{ eliminando.proveedor }}</strong></div>
        <div>
          <span>Cantidad</span>
          <strong>{{ Number(eliminando.cantidad) }} {{ eliminando.unidad }}</strong>
        </div>
        <div><span>Costo</span><strong>{{ formatearMoneda(eliminando.importe) }}</strong></div>
      </div>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.boton-icono {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  border: none;
  background: transparent;
  color: var(--green-700);
  cursor: pointer;
  transition: background var(--duration-fast);
}
.boton-icono:hover {
  background: var(--cream-200);
}
.boton-icono-peligro {
  color: var(--terracotta-500);
}
.resumen-compra {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  background: var(--cream-100);
  border: 1.5px solid var(--cream-300);
}
.resumen-compra > div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font: 400 var(--text-sm) / 1.4 var(--font-sans);
}
.resumen-compra span {
  color: var(--clay-500);
}
.resumen-compra strong {
  color: var(--green-900);
  text-align: right;
}
</style>
