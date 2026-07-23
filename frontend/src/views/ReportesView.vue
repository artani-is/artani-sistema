<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Banknote, FileDown, Store, Tag } from '@lucide/vue'
import TopBar from '@/components/ui/TopBar.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import StatCard from '@/components/ui/StatCard.vue'
import DataTable from '@/components/ui/DataTable.vue'
import SelectField, { type OpcionSelect } from '@/components/ui/SelectField.vue'
import { useVentasStore } from '@/stores/ventas'
import { ApiError } from '@/lib/api'
import type { ReporteVentas, Venta } from '@/types'

const store = useVentasStore()

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const hoy = new Date()
const mes = ref(String(hoy.getMonth() + 1)) // '' = todo el año (HU-16: mes o año)
const anio = ref(String(hoy.getFullYear()))
const canal = ref<'DIRECTA' | 'CONSIGNACION' | ''>('')

const error = ref<string | null>(null)
const exito = ref<string | null>(null)
const exportando = ref(false)

const opcionesMes: OpcionSelect[] = [
  { value: 'ANIO', label: 'Todo el año' },
  ...MESES.map((nombre, i) => ({ value: String(i + 1), label: nombre })),
]
const opcionesAnio: OpcionSelect[] = Array.from({ length: 6 }, (_, i) => {
  const a = String(hoy.getFullYear() - i)
  return { value: a, label: a }
})
const opcionesCanal: OpcionSelect[] = [
  { value: 'DIRECTA', label: 'Venta directa' },
  { value: 'CONSIGNACION', label: 'Consignación' },
]

/** Rango de fechas del periodo elegido (mes concreto o año completo). */
const periodo = computed(() => {
  const a = Number(anio.value)
  if (mes.value === 'ANIO') {
    return { inicio: `${a}-01-01`, fin: `${a}-12-31` }
  }
  const m = Number(mes.value)
  const ultimoDia = new Date(a, m, 0).getDate()
  const mm = String(m).padStart(2, '0')
  return { inicio: `${a}-${mm}-01`, fin: `${a}-${mm}-${String(ultimoDia).padStart(2, '0')}` }
})

const etiquetaPeriodo = computed(() =>
  mes.value === 'ANIO' ? `Año ${anio.value}` : `${MESES[Number(mes.value) - 1]} ${anio.value}`,
)

async function cargarVentas(): Promise<void> {
  store.filtros.inicio = periodo.value.inicio
  store.filtros.fin = periodo.value.fin
  store.filtros.canal = canal.value
  try {
    await store.cargar()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'No se pudieron cargar las ventas'
  }
}

watch([mes, anio, canal], cargarVentas)

onMounted(() => {
  cargarVentas()
  store.cargarReportes().catch(() => {})
})

const total = computed(() => store.ventas.reduce((s, v) => s + Number(v.montoCobrado), 0))
const directas = computed(() =>
  store.ventas.filter((v) => v.canal === 'DIRECTA').reduce((s, v) => s + Number(v.montoCobrado), 0),
)
const consignacion = computed(() => total.value - directas.value)

/** HU-16: exporta el PDF del periodo y registra la generación. */
async function exportar(): Promise<void> {
  error.value = null
  exito.value = null
  exportando.value = true
  try {
    const reporte = await store.generarReporte(periodo.value.inicio, periodo.value.fin)
    exito.value = `Reporte de ${etiquetaPeriodo.value} generado (${reporte.totalPiezas} piezas).`
    if (reporte.rutaExportacion) {
      window.open(reporte.rutaExportacion, '_blank')
    }
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'No se pudo generar el reporte'
  } finally {
    exportando.value = false
  }
}

function folioCorto(venta: Venta): string {
  return 'V-' + venta.idVenta.slice(0, 4).toUpperCase()
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

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { dateStyle: 'medium', timeZone: 'UTC' })
}

function formatearFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}
</script>

<template>
  <div>
    <TopBar title="Reporte de ventas" :subtitle="etiquetaPeriodo">
      <template #actions>
        <BaseButton variant="secondary" :disabled="exportando" @click="exportar">
          <template #icon><FileDown :size="18" /></template>
          {{ exportando ? 'Exportando…' : 'Exportar PDF' }}
        </BaseButton>
      </template>
    </TopBar>

    <div class="flex flex-col gap-6" :style="{ padding: 'var(--page-pad)' }">
      <BaseAlert v-if="error" tone="error" @cerrar="error = null">{{ error }}</BaseAlert>
      <BaseAlert v-if="exito" tone="success" @cerrar="exito = null">{{ exito }}</BaseAlert>

      <div class="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 md:grid-cols-[220px_160px_220px]">
        <SelectField v-model="mes" label="Mes" :options="opcionesMes" placeholder="Elige un mes" />
        <SelectField v-model="anio" label="Año" :options="opcionesAnio" />
        <SelectField
          v-model="canal"
          label="Canal"
          placeholder="Todos"
          :options="opcionesCanal"
        />
      </div>

      <div class="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard label="Ingresos totales" :value="formatearMoneda(total)" :hint="`${store.ventas.length} ventas`">
          <template #icon><Banknote :size="20" /></template>
        </StatCard>
        <StatCard label="Venta directa" :value="formatearMoneda(directas)" tone="green" hint="Sin intermediario">
          <template #icon><Tag :size="20" /></template>
        </StatCard>
        <StatCard label="Consignación" :value="formatearMoneda(consignacion)" tone="amber" hint="Reportado por galerías">
          <template #icon><Store :size="20" /></template>
        </StatCard>
      </div>

      <!-- HU-16: sin ventas, mensaje claro en lugar de un reporte vacío -->
      <BaseAlert v-if="!store.cargando && store.ventas.length === 0" tone="info" :closable="false">
        No hay ventas registradas en {{ etiquetaPeriodo.toLowerCase() }}. Ajusta el periodo o
        registra ventas desde la ficha de cada pieza.
      </BaseAlert>
      <DataTable
        v-else
        :columns="[
          { key: 'folio', header: 'Folio', width: '90px' },
          { key: 'fecha', header: 'Fecha', width: '140px' },
          { key: 'pieza', header: 'Pieza' },
          { key: 'canal', header: 'Canal', width: '220px' },
          { key: 'monto', header: 'Monto', width: '130px', align: 'right' },
        ]"
        :rows="store.ventas"
        :row-key="(v: Venta) => v.idVenta"
        empty="No hay ventas en el periodo seleccionado."
      >
        <template #cell-folio="{ row }">
          <span :style="{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--clay-600)' }">
            {{ folioCorto(row) }}
          </span>
        </template>
        <template #cell-fecha="{ row }">{{ formatearFecha(row.fechaVenta) }}</template>
        <template #cell-pieza="{ row }">
          <strong :style="{ color: 'var(--green-900)' }">{{ row.artesania?.nombre ?? '—' }}</strong>
        </template>
        <template #cell-canal="{ row }">
          <BaseBadge :tone="row.canal === 'CONSIGNACION' ? 'consignment' : 'info'" size="sm">
            {{
              row.canal === 'CONSIGNACION'
                ? `Consignación · ${row.consignacion?.galeria?.nombre ?? ''}`
                : 'Venta directa'
            }}
          </BaseBadge>
        </template>
        <template #cell-monto="{ row }">
          <strong>{{ formatearMoneda(Number(row.montoCobrado)) }}</strong>
        </template>
      </DataTable>

      <section v-if="store.reportes.length > 0">
        <h3
          class="mb-3.5 mt-0"
          :style="{ font: '600 var(--text-h3)/1.1 var(--font-serif)', color: 'var(--green-900)' }"
        >
          Reportes exportados
        </h3>
        <DataTable
          :columns="[
            { key: 'generado', header: 'Generado', width: '200px' },
            { key: 'periodo', header: 'Periodo' },
            { key: 'piezas', header: 'Piezas', width: '90px', align: 'right' },
            { key: 'total', header: 'Total', width: '130px', align: 'right' },
            { key: 'pdf', header: '', width: '110px', align: 'right' },
          ]"
          :rows="store.reportes"
          :row-key="(r: ReporteVentas) => r.idReporte"
          empty="Aún no has exportado reportes."
        >
          <template #cell-generado="{ row }">{{ formatearFechaHora(row.fechaGeneracion) }}</template>
          <template #cell-periodo="{ row }">
            {{ formatearFecha(row.fechaInicio) }} — {{ formatearFecha(row.fechaFin) }}
          </template>
          <template #cell-piezas="{ row }">{{ row.totalPiezas }}</template>
          <template #cell-total="{ row }">
            <strong>{{ formatearMoneda(row.totalVentas) }}</strong>
          </template>
          <template #cell-pdf="{ row }">
            <a
              v-if="row.rutaExportacion"
              :href="row.rutaExportacion"
              target="_blank"
              class="btn btn-secondary btn-sm"
            >
              <FileDown :size="15" />
              PDF
            </a>
          </template>
        </DataTable>
      </section>
    </div>
  </div>
</template>
