<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Pencil, Search } from '@lucide/vue'
import TopBar from '@/components/ui/TopBar.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import DataTable from '@/components/ui/DataTable.vue'
import TextField from '@/components/ui/TextField.vue'
import SelectField, { type OpcionSelect } from '@/components/ui/SelectField.vue'
import { useArtesaniasStore } from '@/stores/artesanias'
import { useCatalogosStore } from '@/stores/catalogos'
import {
  ESTADOS_ARTESANIA,
  ETIQUETA_ESTADO,
  type Artesania,
  type EstadoArtesania,
} from '@/types'

const router = useRouter()
const store = useArtesaniasStore()
const catalogos = useCatalogosStore()

onMounted(() => {
  store.cargar()
  catalogos.cargar('tecnicas')
  catalogos.cargar('categorias')
})

const disponibles = computed(
  () => store.artesanias.filter((a) => a.estado === 'DISPONIBLE').length,
)

const opcionesEstado: OpcionSelect[] = ESTADOS_ARTESANIA.map((estado) => ({
  value: estado,
  label: ETIQUETA_ESTADO[estado],
}))
const opcionesTecnica = computed<OpcionSelect[]>(() =>
  catalogos.listas.tecnicas.map((t) => ({ value: t.idTecnica as string, label: t.nombre })),
)
const opcionesCategoria = computed<OpcionSelect[]>(() =>
  catalogos.listas.categorias.map((c) => ({ value: c.idCategoria as string, label: c.nombre })),
)

const TONO_ESTADO: Record<EstadoArtesania, 'available' | 'consignment' | 'sold'> = {
  DISPONIBLE: 'available',
  EN_CONSIGNACION: 'consignment',
  VENDIDA: 'sold',
}

function idCorto(pieza: Artesania): string {
  return 'ART-' + pieza.idArtesania.slice(0, 4).toUpperCase()
}

function abrirDetalle(pieza: Artesania): void {
  router.push({ name: 'artesania-detalle', params: { id: pieza.idArtesania } })
}
</script>

<template>
  <div>
    <TopBar
      title="Inventario"
      :subtitle="`${store.artesanias.length} piezas · ${disponibles} disponibles`"
    >
      <template #actions>
        <BaseButton variant="accent" @click="router.push({ name: 'artesania-nueva' })">
          <template #icon><Plus :size="18" /></template>
          Nueva pieza
        </BaseButton>
      </template>
    </TopBar>

    <div class="flex flex-col gap-5" :style="{ padding: 'var(--page-pad)' }">
      <form
        class="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_220px_220px_220px_auto]"
        @submit.prevent="store.cargar()"
      >
        <TextField
          v-model="store.filtros.busqueda"
          label="Buscar"
          type="search"
          placeholder="Nombre de la pieza…"
        />
        <SelectField
          v-model="store.filtros.estado"
          label="Estado"
          placeholder="Todos los estados"
          :options="opcionesEstado"
          @update:model-value="store.cargar()"
        />
        <SelectField
          v-model="store.filtros.idTecnica"
          label="Técnica"
          placeholder="Todas las técnicas"
          :options="opcionesTecnica"
          @update:model-value="store.cargar()"
        />
        <SelectField
          v-model="store.filtros.idCategoria"
          label="Categoría"
          placeholder="Todas las categorías"
          :options="opcionesCategoria"
          @update:model-value="store.cargar()"
        />
        <BaseButton type="submit" variant="primary">
          <template #icon><Search :size="18" /></template>
          Buscar
        </BaseButton>
      </form>

      <DataTable
        :columns="[
          { key: 'id', header: 'ID', width: '110px' },
          { key: 'nombre', header: 'Pieza' },
          { key: 'tecnica', header: 'Técnica' },
          { key: 'categoria', header: 'Categoría' },
          { key: 'estado', header: 'Estado', width: '180px' },
          { key: 'acciones', header: '', width: '70px', align: 'right' },
        ]"
        :rows="store.artesanias"
        :row-key="(pieza: Artesania) => pieza.idArtesania"
        empty="No se encontraron piezas con esos criterios."
        clickable
        @row-click="abrirDetalle"
      >
        <template #cell-id="{ row }">
          <span :style="{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--clay-600)' }">
            {{ idCorto(row) }}
          </span>
        </template>
        <template #cell-nombre="{ row }">
          <strong :style="{ color: 'var(--green-900)' }">{{ row.nombre }}</strong>
        </template>
        <template #cell-tecnica="{ row }">{{ row.tecnica?.nombre ?? '—' }}</template>
        <template #cell-categoria="{ row }">{{ row.categoria?.nombre ?? '—' }}</template>
        <template #cell-estado="{ row }">
          <BaseBadge :tone="TONO_ESTADO[row.estado]">{{ ETIQUETA_ESTADO[row.estado] }}</BaseBadge>
        </template>
        <template #cell-acciones="{ row }">
          <button
            type="button"
            class="boton-icono"
            title="Ver ficha"
            @click.stop="abrirDetalle(row)"
          >
            <Pencil :size="18" />
          </button>
        </template>
      </DataTable>
    </div>
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
</style>
