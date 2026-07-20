<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus, Pencil, Trash2, History } from '@lucide/vue'
import TopBar from '@/components/ui/TopBar.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseModal from '@/components/BaseModal.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import TextField from '@/components/ui/TextField.vue'
import SelectField, { type OpcionSelect } from '@/components/ui/SelectField.vue'
import { useCatalogosStore, type CatalogoKey } from '@/stores/catalogos'
import { useProveedoresStore } from '@/stores/proveedores'
import { useMateriasPrimasStore } from '@/stores/materiasPrimas'
import { ApiError } from '@/lib/api'
import {
  ETIQUETA_UNIDAD,
  UNIDADES_MEDIDA,
  type MateriaPrima,
  type PrecioHistorico,
  type Proveedor,
} from '@/types'

type TabKey = 'tecnicas' | 'materiales' | 'tipos' | 'categorias' | 'proveedores' | 'galerias'

interface CampoForm {
  key: string
  label: string
  tipo?: 'text' | 'email' | 'tel' | 'textarea' | 'unidad' | 'tipoMaterial'
  placeholder?: string
  obligatorio?: boolean
  anchoMedio?: boolean
}

interface FilaCatalogo {
  id: string
  usos: number
  [campo: string]: unknown
}

interface EsquemaTab {
  etiqueta: string
  singular: string
  articulo: 'el' | 'la'
  usosNoun: string
  ancho?: boolean
  campos: CampoForm[]
  columnas: Array<{ key: string; header: string }>
}

const ESQUEMAS: Record<TabKey, EsquemaTab> = {
  tecnicas: {
    etiqueta: 'Técnicas',
    singular: 'técnica',
    articulo: 'la',
    usosNoun: 'pieza(s)',
    campos: [
      { key: 'nombre', label: 'Nombre de la técnica', obligatorio: true },
      { key: 'descripcion', label: 'Descripción', tipo: 'textarea', placeholder: 'Describe la técnica (opcional)' },
    ],
    columnas: [
      { key: 'nombre', header: 'Técnica' },
      { key: 'descripcion', header: 'Descripción' },
    ],
  },
  materiales: {
    etiqueta: 'Materiales',
    singular: 'material',
    articulo: 'el',
    usosNoun: 'compra(s)',
    ancho: true,
    campos: [
      { key: 'nombre', label: 'Nombre del material', obligatorio: true, placeholder: 'p. ej. Lana cardada' },
      { key: 'idTipoMaterial', label: 'Tipo de material', tipo: 'tipoMaterial', obligatorio: true, anchoMedio: true },
      { key: 'unidadMedida', label: 'Unidad de medida', tipo: 'unidad', obligatorio: true, anchoMedio: true },
    ],
    columnas: [
      { key: 'nombre', header: 'Material' },
      { key: 'tipo', header: 'Tipo' },
      { key: 'unidad', header: 'Unidad' },
    ],
  },
  tipos: {
    etiqueta: 'Tipos de material',
    singular: 'tipo de material',
    articulo: 'el',
    usosNoun: 'material(es)',
    campos: [{ key: 'nombre', label: 'Nombre del tipo de material', obligatorio: true }],
    columnas: [{ key: 'nombre', header: 'Tipo de material' }],
  },
  categorias: {
    etiqueta: 'Categorías',
    singular: 'categoría',
    articulo: 'la',
    usosNoun: 'pieza(s)',
    campos: [{ key: 'nombre', label: 'Nombre de la categoría', obligatorio: true }],
    columnas: [{ key: 'nombre', header: 'Categoría' }],
  },
  proveedores: {
    etiqueta: 'Proveedores',
    singular: 'proveedor',
    articulo: 'el',
    usosNoun: 'compra(s)',
    ancho: true,
    campos: [
      { key: 'nombre', label: 'Nombre del proveedor', obligatorio: true },
      { key: 'correo', label: 'Correo electrónico', tipo: 'email', placeholder: 'nombre@correo.com', anchoMedio: true },
      { key: 'telefono', label: 'Teléfono', tipo: 'tel', placeholder: '951 000 0000', anchoMedio: true },
      { key: 'ciudad', label: 'Ciudad', anchoMedio: true },
      { key: 'estado', label: 'Estado', anchoMedio: true },
    ],
    columnas: [
      { key: 'nombre', header: 'Proveedor' },
      { key: 'telefono', header: 'Teléfono' },
      { key: 'correo', header: 'Correo' },
      { key: 'ubicacion', header: 'Ubicación' },
    ],
  },
  galerias: {
    etiqueta: 'Galerías',
    singular: 'galería',
    articulo: 'la',
    usosNoun: 'pieza(s) en consignación',
    ancho: true,
    campos: [
      { key: 'nombre', label: 'Nombre de la galería', obligatorio: true },
      { key: 'nombreContacto', label: 'Persona de contacto', placeholder: 'Nombre del encargado', anchoMedio: true },
      { key: 'telefono', label: 'Teléfono', tipo: 'tel', placeholder: '951 000 0000', anchoMedio: true },
      { key: 'correo', label: 'Correo electrónico', tipo: 'email', placeholder: 'nombre@correo.com' },
      { key: 'calle', label: 'Calle', anchoMedio: true },
      { key: 'numero', label: 'Número', anchoMedio: true },
      { key: 'colonia', label: 'Colonia', anchoMedio: true },
      { key: 'codigoPostal', label: 'Código postal', anchoMedio: true },
      { key: 'ciudad', label: 'Ciudad', anchoMedio: true },
      { key: 'estado', label: 'Estado', anchoMedio: true },
      { key: 'pais', label: 'País', anchoMedio: true },
    ],
    columnas: [
      { key: 'nombre', header: 'Galería' },
      { key: 'nombreContacto', header: 'Contacto' },
      { key: 'telefono', header: 'Teléfono' },
      { key: 'ciudad', header: 'Ciudad' },
    ],
  },
}

const TABS = Object.entries(ESQUEMAS).map(([key, e]) => ({ key: key as TabKey, etiqueta: e.etiqueta }))

const catalogos = useCatalogosStore()
const proveedoresStore = useProveedoresStore()
const materiasStore = useMateriasPrimasStore()

const tab = ref<TabKey>('tecnicas')
const esquema = computed(() => ESQUEMAS[tab.value])

const aviso = ref<{ texto: string; tono: 'success' | 'warning' | 'error' } | null>(null)
const modalAbierto = ref(false)
const editando = ref<FilaCatalogo | null>(null)
const formulario = reactive<Record<string, string>>({})
const errores = reactive<Record<string, string>>({})
const guardando = ref(false)
const eliminando = ref<FilaCatalogo | null>(null)
const borrando = ref(false)

const historialDe = ref<FilaCatalogo | null>(null)
const historial = ref<PrecioHistorico[]>([])
const cargandoHistorial = ref(false)

onMounted(() => {
  catalogos.cargarTodos()
  proveedoresStore.cargar()
  materiasStore.cargar()
})

const CLAVE_CATALOGO: Partial<Record<TabKey, CatalogoKey>> = {
  tecnicas: 'tecnicas',
  tipos: 'tiposMaterial',
  categorias: 'categorias',
  galerias: 'galerias',
}

const filas = computed<FilaCatalogo[]>(() => {
  switch (tab.value) {
    case 'tecnicas':
      return catalogos.listas.tecnicas.map((t) => ({
        ...t,
        id: t.idTecnica as string,
        usos: (t._count as { artesanias: number } | undefined)?.artesanias ?? 0,
      }))
    case 'tipos':
      return catalogos.listas.tiposMaterial.map((t) => ({
        ...t,
        id: t.idTipoMaterial as string,
        usos: (t._count as { materiasPrimas: number } | undefined)?.materiasPrimas ?? 0,
      }))
    case 'categorias':
      return catalogos.listas.categorias.map((c) => ({
        ...c,
        id: c.idCategoria as string,
        usos: (c._count as { artesanias: number } | undefined)?.artesanias ?? 0,
      }))
    case 'galerias':
      return catalogos.listas.galerias.map((g) => ({ ...g, id: g.idGaleria as string, usos: 0 }))
    case 'proveedores':
      return proveedoresStore.proveedores.map((p) => ({
        ...p,
        id: p.idProveedor,
        usos: p._count?.compras ?? 0,
        ubicacion: [p.ciudad, p.estado].filter(Boolean).join(', '),
      }))
    case 'materiales':
      return materiasStore.materias.map((m) => ({
        ...m,
        id: m.idMateria,
        usos: m._count?.detallesCompra ?? 0,
        tipo: m.tipoMaterial?.nombre ?? '—',
        unidad: ETIQUETA_UNIDAD[m.unidadMedida],
      }))
  }
  return []
})

const columnasTabla = computed(() => [
  ...esquema.value.columnas,
  { key: 'usos', header: 'En uso', width: '160px' },
  { key: 'acciones', header: '', width: tab.value === 'materiales' ? '150px' : '110px', align: 'right' as const },
])

const opcionesUnidad: OpcionSelect[] = UNIDADES_MEDIDA.map((u) => ({
  value: u,
  label: ETIQUETA_UNIDAD[u],
}))
const opcionesTipoMaterial = computed<OpcionSelect[]>(() =>
  catalogos.listas.tiposMaterial.map((t) => ({
    value: t.idTipoMaterial as string,
    label: t.nombre,
  })),
)

function abrirAlta(): void {
  editando.value = null
  limpiarFormulario()
  modalAbierto.value = true
}

function abrirEdicion(fila: FilaCatalogo): void {
  editando.value = fila
  limpiarFormulario()
  for (const campo of esquema.value.campos) {
    const valor = fila[campo.key]
    formulario[campo.key] = typeof valor === 'string' ? valor : ''
  }
  modalAbierto.value = true
}

function limpiarFormulario(): void {
  for (const clave of Object.keys(formulario)) delete formulario[clave]
  for (const clave of Object.keys(errores)) delete errores[clave]
  for (const campo of esquema.value.campos) {
    formulario[campo.key] = campo.key === 'pais' ? 'Mexico' : ''
  }
}

async function guardar(): Promise<void> {
  for (const clave of Object.keys(errores)) delete errores[clave]
  for (const campo of esquema.value.campos) {
    if (campo.obligatorio && !formulario[campo.key]?.trim()) {
      errores[campo.key] =
        campo.tipo === 'unidad' || campo.tipo === 'tipoMaterial'
          ? 'Selecciona una opción.'
          : 'Este campo es obligatorio.'
    }
  }
  if (Object.keys(errores).length > 0) return

  guardando.value = true
  try {
    const datos: Record<string, string | null> = {}
    for (const campo of esquema.value.campos) {
      datos[campo.key] = formulario[campo.key]?.trim() || null
    }
    const id = editando.value?.id

    if (tab.value === 'proveedores') {
      if (id) await proveedoresStore.actualizar(id, datos as Partial<Proveedor>)
      else await proveedoresStore.crear(datos as Partial<Proveedor>)
    } else if (tab.value === 'materiales') {
      if (id) await materiasStore.actualizar(id, datos as Partial<MateriaPrima>)
      else await materiasStore.crear(datos as Partial<MateriaPrima>)
    } else {
      const clave = CLAVE_CATALOGO[tab.value]!
      if (id) await catalogos.actualizar(clave, id, datos)
      else await catalogos.crear(clave, datos)
    }

    modalAbierto.value = false
    const { articulo, singular } = esquema.value
    aviso.value = {
      texto: `Se ${editando.value ? 'actualizó' : 'agregó'} ${articulo === 'el' ? 'el' : 'la'} ${singular} «${datos.nombre}».`,
      tono: 'success',
    }
  } catch (err) {
    errores.nombre = err instanceof ApiError ? err.message : 'No se pudo guardar el elemento'
  } finally {
    guardando.value = false
  }
}

function solicitarEliminar(fila: FilaCatalogo): void {
  if (fila.usos > 0) {
    aviso.value = {
      texto: `No se puede eliminar «${fila.nombre}»: está vinculad${esquema.value.articulo === 'el' ? 'o' : 'a'} a ${fila.usos} ${esquema.value.usosNoun}.`,
      tono: 'warning',
    }
    return
  }
  eliminando.value = fila
}

async function confirmarEliminar(): Promise<void> {
  const fila = eliminando.value
  if (!fila) return
  borrando.value = true
  try {
    if (tab.value === 'proveedores') await proveedoresStore.eliminar(fila.id)
    else if (tab.value === 'materiales') await materiasStore.eliminar(fila.id)
    else await catalogos.eliminar(CLAVE_CATALOGO[tab.value]!, fila.id)
    aviso.value = { texto: `Se eliminó «${fila.nombre}».`, tono: 'success' }
  } catch (err) {
    aviso.value = {
      texto: err instanceof ApiError ? err.message : 'No se pudo eliminar el elemento',
      tono: 'error',
    }
  } finally {
    eliminando.value = null
    borrando.value = false
  }
}

async function verHistorial(fila: FilaCatalogo): Promise<void> {
  historialDe.value = fila
  historial.value = []
  cargandoHistorial.value = true
  try {
    historial.value = await materiasStore.historialPrecios(fila.id)
  } finally {
    cargandoHistorial.value = false
  }
}

function cambiarTab(nueva: TabKey): void {
  tab.value = nueva
  aviso.value = null
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { dateStyle: 'medium', timeZone: 'UTC' })
}
function formatearMoneda(valor: string): string {
  return '$' + Number(valor).toLocaleString('es-MX')
}
</script>

<template>
  <div>
    <TopBar title="Catálogos" subtitle="Técnicas, materiales, categorías, proveedores y galerías">
      <template #actions>
        <BaseButton variant="accent" @click="abrirAlta">
          <template #icon><Plus :size="18" /></template>
          Agregar {{ esquema.singular }}
        </BaseButton>
      </template>
    </TopBar>

    <div class="flex max-w-[1040px] flex-col gap-5" :style="{ padding: 'var(--page-pad)' }">
      <BaseAlert v-if="aviso" :tone="aviso.tono" @cerrar="aviso = null">{{ aviso.texto }}</BaseAlert>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="t in TABS"
          :key="t.key"
          type="button"
          class="pestana"
          :class="{ 'pestana-activa': tab === t.key }"
          @click="cambiarTab(t.key)"
        >
          {{ t.etiqueta }}
        </button>
      </div>

      <DataTable
        :columns="columnasTabla"
        :rows="filas"
        :row-key="(fila: FilaCatalogo) => fila.id"
        empty="No hay elementos registrados en este catálogo."
      >
        <template #cell-nombre="{ row }">
          <strong :style="{ color: 'var(--green-900)' }">{{ row.nombre }}</strong>
        </template>
        <template #cell-descripcion="{ row }">
          <span v-if="row.descripcion">{{ row.descripcion }}</span>
          <span v-else :style="{ color: 'var(--clay-400)' }">—</span>
        </template>
        <template #cell-correo="{ row }">
          <span v-if="row.correo">{{ row.correo }}</span>
          <span v-else :style="{ color: 'var(--clay-400)' }">—</span>
        </template>
        <template #cell-telefono="{ row }">
          <span v-if="row.telefono">{{ row.telefono }}</span>
          <span v-else :style="{ color: 'var(--clay-400)' }">—</span>
        </template>
        <template #cell-ubicacion="{ row }">
          <span v-if="row.ubicacion">{{ row.ubicacion }}</span>
          <span v-else :style="{ color: 'var(--clay-400)' }">—</span>
        </template>
        <template #cell-nombreContacto="{ row }">
          <span v-if="row.nombreContacto">{{ row.nombreContacto }}</span>
          <span v-else :style="{ color: 'var(--clay-400)' }">—</span>
        </template>
        <template #cell-ciudad="{ row }">
          <span v-if="row.ciudad">{{ row.ciudad }}</span>
          <span v-else :style="{ color: 'var(--clay-400)' }">—</span>
        </template>
        <template #cell-usos="{ row }">
          <BaseBadge v-if="row.usos > 0" tone="info" size="sm">{{ row.usos }} {{ esquema.usosNoun }}</BaseBadge>
          <span v-else :style="{ color: 'var(--clay-500)' }">Sin usar</span>
        </template>
        <template #cell-acciones="{ row }">
          <span class="inline-flex gap-1">
            <button
              v-if="tab === 'materiales'"
              type="button"
              class="boton-icono"
              title="Historial de precios"
              @click="verHistorial(row)"
            >
              <History :size="18" />
            </button>
            <button type="button" class="boton-icono" title="Editar" @click="abrirEdicion(row)">
              <Pencil :size="18" />
            </button>
            <button
              type="button"
              class="boton-icono boton-icono-peligro"
              :disabled="row.usos > 0"
              title="Eliminar"
              @click="solicitarEliminar(row)"
            >
              <Trash2 :size="18" />
            </button>
          </span>
        </template>
      </DataTable>
    </div>

    <BaseModal
      :abierto="modalAbierto"
      :titulo="`${editando ? 'Editar' : 'Agregar'} ${esquema.singular}`"
      :ancho="esquema.ancho ? 560 : 460"
      @cerrar="modalAbierto = false"
    >
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <template v-for="campo in esquema.campos" :key="campo.key">
          <SelectField
            v-if="campo.tipo === 'unidad'"
            v-model="formulario[campo.key]"
            :label="campo.label"
            :required="campo.obligatorio"
            :error="errores[campo.key] ?? ''"
            placeholder="Elige una unidad"
            :options="opcionesUnidad"
            :class="campo.anchoMedio ? '' : 'sm:col-span-2'"
          />
          <SelectField
            v-else-if="campo.tipo === 'tipoMaterial'"
            v-model="formulario[campo.key]"
            :label="campo.label"
            :required="campo.obligatorio"
            :error="errores[campo.key] ?? ''"
            placeholder="Elige un tipo"
            :options="opcionesTipoMaterial"
            :help-text="opcionesTipoMaterial.length === 0 ? 'Primero agrega un tipo en la pestaña «Tipos de material».' : ''"
            :class="campo.anchoMedio ? '' : 'sm:col-span-2'"
          />
          <TextField
            v-else
            v-model="formulario[campo.key]"
            :label="campo.label"
            :type="campo.tipo === 'textarea' ? 'text' : (campo.tipo ?? 'text')"
            :multiline="campo.tipo === 'textarea'"
            :rows="3"
            :placeholder="campo.placeholder ?? ''"
            :required="campo.obligatorio"
            :error="errores[campo.key] ?? ''"
            :class="campo.anchoMedio ? '' : 'sm:col-span-2'"
          />
        </template>
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="modalAbierto = false">Cancelar</BaseButton>
        <BaseButton variant="primary" :disabled="guardando" @click="guardar">
          {{ guardando ? 'Guardando…' : 'Guardar' }}
        </BaseButton>
      </template>
    </BaseModal>

    <BaseModal
      :abierto="historialDe !== null"
      :titulo="`Historial de precios — ${historialDe?.nombre ?? ''}`"
      :ancho="560"
      @cerrar="historialDe = null"
    >
      <p v-if="cargandoHistorial" class="py-3 text-center" :style="{ color: 'var(--clay-500)' }">
        Cargando historial…
      </p>
      <p v-else-if="historial.length === 0" class="py-3 text-center" :style="{ color: 'var(--clay-500)' }">
        Este material todavía no tiene compras registradas.
      </p>
      <DataTable
        v-else
        :columns="[
          { key: 'fecha', header: 'Fecha', width: '130px' },
          { key: 'proveedor', header: 'Proveedor' },
          { key: 'cantidad', header: 'Cantidad', align: 'right' },
          { key: 'costoUnitario', header: 'Costo unit.', align: 'right' },
        ]"
        :rows="historial"
        :row-key="(registro: PrecioHistorico) => registro.idDetalle"
      >
        <template #cell-fecha="{ row }">{{ formatearFecha(row.fecha) }}</template>
        <template #cell-proveedor="{ row }">{{ row.proveedor.nombre }}</template>
        <template #cell-costoUnitario="{ row }">
          <strong>{{ formatearMoneda(row.costoUnitario) }}</strong>
        </template>
      </DataTable>
    </BaseModal>

    <ConfirmDialog
      :abierto="eliminando !== null"
      titulo="Confirmar eliminación"
      :mensaje="`¿Deseas eliminar «${eliminando?.nombre}» del catálogo? Esta acción no se puede deshacer.`"
      :procesando="borrando"
      @confirmar="confirmarEliminar"
      @cancelar="eliminando = null"
    />
  </div>
</template>

<style scoped>
.pestana {
  padding: 10px 20px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  font: 700 var(--text-sm) / 1 var(--font-sans);
  border: 1.5px solid var(--cream-300);
  background: var(--cream-50);
  color: var(--green-800);
  transition:
    background var(--duration-fast),
    color var(--duration-fast),
    border-color var(--duration-fast);
}
.pestana-activa {
  border-color: var(--green-700);
  background: var(--green-700);
  color: var(--cream-50);
}
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
.boton-icono:hover:not(:disabled) {
  background: var(--cream-200);
}
.boton-icono-peligro {
  color: var(--terracotta-500);
}
.boton-icono:disabled {
  color: var(--clay-400);
  cursor: not-allowed;
}
</style>
