<script setup lang="ts">
import { computed, onMounted, type FunctionalComponent } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Package, Store, Receipt, Truck, Plus, PackagePlus, ShoppingCart, LayoutList, ChevronRight } from '@lucide/vue'
import TopBar from '@/components/ui/TopBar.vue'
import StatCard from '@/components/ui/StatCard.vue'
import DataTable from '@/components/ui/DataTable.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useArtesaniasStore } from '@/stores/artesanias'
import { useComprasStore } from '@/stores/compras'
import { useProveedoresStore } from '@/stores/proveedores'
import { ETIQUETA_ESTADO, type Artesania, type EstadoArtesania } from '@/types'

const auth = useAuthStore()
const router = useRouter()
const artesaniasStore = useArtesaniasStore()
const comprasStore = useComprasStore()
const proveedoresStore = useProveedoresStore()

onMounted(() => {
  artesaniasStore.filtros.busqueda = ''
  artesaniasStore.filtros.estado = ''
  artesaniasStore.filtros.idTecnica = ''
  artesaniasStore.filtros.idCategoria = ''
  artesaniasStore.cargar()
  comprasStore.cargar()
  proveedoresStore.cargar()
})

const disponibles = computed(
  () => artesaniasStore.artesanias.filter((a) => a.estado === 'DISPONIBLE').length,
)
const enConsignacion = computed(
  () => artesaniasStore.artesanias.filter((a) => a.estado === 'EN_CONSIGNACION').length,
)
const gastoInsumos = computed(() =>
  comprasStore.compras.reduce(
    (suma, compra) =>
      suma +
      compra.detalles.reduce(
        (s, d) => s + Number(d.cantidad) * Number(d.costoUnitario),
        0,
      ),
    0,
  ),
)

const recientes = computed(() => artesaniasStore.artesanias.slice(0, 5))

const TONO_ESTADO: Record<EstadoArtesania, 'available' | 'consignment' | 'sold'> = {
  DISPONIBLE: 'available',
  EN_CONSIGNACION: 'consignment',
  VENDIDA: 'sold',
}

interface AccionRapida {
  etiqueta: string
  icono: FunctionalComponent
  destino: { name: string }
}

const acciones: AccionRapida[] = [
  { etiqueta: 'Registrar nueva artesanía', icono: PackagePlus, destino: { name: 'artesania-nueva' } },
  { etiqueta: 'Registrar entrada de materia prima', icono: ShoppingCart, destino: { name: 'materia-prima' } },
  { etiqueta: 'Administrar catálogos maestros', icono: LayoutList, destino: { name: 'catalogos' } },
  { etiqueta: 'Ver inventario completo', icono: Package, destino: { name: 'artesanias' } },
]

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
</script>

<template>
  <div>
    <TopBar title="Inicio" :subtitle="auth.artesano?.nombreTaller ?? 'Tu taller artesanal'">
      <template #actions>
        <BaseButton variant="accent" @click="router.push({ name: 'artesania-nueva' })">
          <template #icon><Plus :size="18" /></template>
          Nueva pieza
        </BaseButton>
      </template>
    </TopBar>

    <div class="flex flex-col gap-7" :style="{ padding: 'var(--page-pad)' }">
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Piezas disponibles" :value="disponibles" hint="Listas para vender">
          <template #icon><Package :size="20" /></template>
        </StatCard>
        <StatCard label="En consignación" :value="enConsignacion" tone="amber" hint="En galerías">
          <template #icon><Store :size="20" /></template>
        </StatCard>
        <StatCard label="Gasto en insumos" :value="formatearMoneda(gastoInsumos)" tone="green" hint="Acumulado">
          <template #icon><Receipt :size="20" /></template>
        </StatCard>
        <StatCard label="Proveedores" :value="proveedoresStore.proveedores.length" tone="amber" hint="Registrados">
          <template #icon><Truck :size="20" /></template>
        </StatCard>
      </div>

      <div class="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div class="flex flex-col gap-3.5">
          <h3 class="m-0" :style="{ font: '600 var(--text-h3)/1.1 var(--font-serif)', color: 'var(--green-900)' }">
            Piezas recientes
          </h3>
          <DataTable
            :columns="[
              { key: 'nombre', header: 'Pieza' },
              { key: 'tecnica', header: 'Técnica' },
              { key: 'fecha', header: 'Registro', width: '140px' },
              { key: 'estado', header: 'Estado', width: '170px' },
            ]"
            :rows="recientes"
            :row-key="(p: Artesania) => p.idArtesania"
            empty="Aún no hay piezas registradas. Crea la primera con «Nueva pieza»."
            clickable
            @row-click="(p: Artesania) => router.push({ name: 'artesania-detalle', params: { id: p.idArtesania } })"
          >
            <template #cell-nombre="{ row }">
              <strong :style="{ color: 'var(--green-900)' }">{{ row.nombre }}</strong>
            </template>
            <template #cell-tecnica="{ row }">{{ row.tecnica?.nombre ?? '—' }}</template>
            <template #cell-fecha="{ row }">{{ formatearFecha(row.fechaRegistro) }}</template>
            <template #cell-estado="{ row }">
              <BaseBadge :tone="TONO_ESTADO[row.estado]">{{ ETIQUETA_ESTADO[row.estado] }}</BaseBadge>
            </template>
          </DataTable>
        </div>

        <div class="card card-padded flex flex-col gap-4">
          <h3 class="m-0" :style="{ font: '600 21px/1.1 var(--font-serif)', color: 'var(--green-900)' }">
            Acciones rápidas
          </h3>
          <RouterLink
            v-for="accion in acciones"
            :key="accion.etiqueta"
            :to="accion.destino"
            class="accion-rapida"
          >
            <span
              class="inline-flex items-center justify-center"
              :style="{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--green-50)',
                color: 'var(--green-700)',
              }"
            >
              <component :is="accion.icono" :size="20" />
            </span>
            {{ accion.etiqueta }}
            <span class="ml-auto" :style="{ color: 'var(--clay-400)' }">
              <ChevronRight :size="18" />
            </span>
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.accion-rapida {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  text-align: left;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  cursor: pointer;
  background: transparent;
  border: 1.5px solid var(--cream-300);
  font: 600 16px / 1.2 var(--font-sans);
  color: var(--green-900);
  text-decoration: none;
  transition: background var(--duration-fast);
}
.accion-rapida:hover {
  background: var(--cream-100);
}
</style>
