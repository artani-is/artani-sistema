<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus, Pencil, Trash2, History } from '@lucide/vue'
import TopBar from '@/components/ui/TopBar.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseModal from '@/components/BaseModal.vue'
import DataTable from '@/components/ui/DataTable.vue'
import TextField from '@/components/ui/TextField.vue'
import SelectField, { type OpcionSelect } from '@/components/ui/SelectField.vue'
import { CONFIG_CATALOGOS, useCatalogosStore, type CatalogoKey } from '@/stores/catalogos'
import { useProveedoresStore } from '@/stores/proveedores'
import { useMateriasPrimasStore } from '@/stores/materiasPrimas'
import { useSnackbarStore } from '@/stores/snackbar'
import { ApiError } from '@/lib/api'
import {
  ETIQUETA_UNIDAD,
  UNIDADES_MEDIDA,
  UNIDAD_CORTA,
  type MateriaPrima,
  type PrecioHistorico,
  type Proveedor,
  type UnidadMedida,
} from '@/types'

// CAM-009: la pestaña «Tipos de material» se eliminó del módulo
type TabKey = 'tecnicas' | 'materiales' | 'categorias' | 'proveedores' | 'galerias'

interface CampoForm {
  key: string
  label: string
  tipo?: 'text' | 'email' | 'tel' | 'textarea' | 'unidad' | 'seccion'
  placeholder?: string
  obligatorio?: boolean
  anchoMedio?: boolean
  helpText?: string
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
    // CAM-009: el material se identifica solo por nombre y unidad de medida
    campos: [
      { key: 'nombre', label: 'Nombre del material', obligatorio: true, placeholder: 'p. ej. Lana cardada' },
      { key: 'unidadMedida', label: 'Unidad de medida', tipo: 'unidad', obligatorio: true },
    ],
    columnas: [
      { key: 'nombre', header: 'Material' },
      { key: 'unidad', header: 'Unidad' },
    ],
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
    // CAM-015: domicilio completo en sección propia; solo el nombre es obligatorio
    campos: [
      { key: 'nombre', label: 'Nombre del proveedor', obligatorio: true },
      { key: '_contacto', label: 'Datos de contacto', tipo: 'seccion' },
      { key: 'correo', label: 'Correo electrónico', tipo: 'email', placeholder: 'nombre@correo.com', anchoMedio: true },
      { key: 'telefono', label: 'Teléfono', tipo: 'tel', placeholder: '951 000 0000', anchoMedio: true },
      { key: '_domicilio', label: 'Domicilio (opcional)', tipo: 'seccion' },
      { key: 'calle', label: 'Calle', anchoMedio: true },
      { key: 'numero', label: 'Número exterior', placeholder: 'p. ej. 12 o S/N', anchoMedio: true },
      { key: 'numeroInterior', label: 'Número interior', placeholder: 'Opcional', anchoMedio: true },
      { key: 'colonia', label: 'Colonia', anchoMedio: true },
      { key: 'codigoPostal', label: 'Código postal', anchoMedio: true },
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
const snackbar = useSnackbarStore()

const tab = ref<TabKey>('tecnicas')
const esquema = computed(() => ESQUEMAS[tab.value])

const aviso = ref<{ texto: string; tono: 'warning' | 'error' } | null>(null)
const modalAbierto = ref(false)
const editando = ref<FilaCatalogo | null>(null)
const formulario = reactive<Record<string, string>>({})
const errores = reactive<Record<string, string>>({})
const guardando = ref(false)

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
        // CAM-015: la columna muestra la versión resumida (ciudad y estado)
        ubicacion: [p.ciudad, p.estado].filter(Boolean).join(', '),
      }))
    case 'materiales':
      return materiasStore.materias.map((m) => ({
        ...m,
        id: m.idMateria,
        usos: m._count?.detallesCompra ?? 0,
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

function abrirAlta(): void {
  editando.value = null
  limpiarFormulario()
  modalAbierto.value = true
}

function abrirEdicion(fila: FilaCatalogo): void {
  editando.value = fila
  limpiarFormulario()
  for (const campo of camposDeDatos()) {
    const valor = fila[campo.key]
    formulario[campo.key] = typeof valor === 'string' ? valor : ''
  }
  modalAbierto.value = true
}

/** Campos que capturan datos (excluye los encabezados de sección). */
function camposDeDatos(): CampoForm[] {
  return esquema.value.campos.filter((campo) => campo.tipo !== 'seccion')
}

function limpiarFormulario(): void {
  for (const clave of Object.keys(formulario)) delete formulario[clave]
  for (const clave of Object.keys(errores)) delete errores[clave]
  for (const campo of camposDeDatos()) {
    formulario[campo.key] = campo.key === 'pais' ? 'Mexico' : ''
  }
}

/** Datos actuales de una fila con la forma que espera la API (para editar o recrear). */
function datosDeFila(fila: FilaCatalogo): Record<string, string | null> {
  const datos: Record<string, string | null> = {}
  for (const campo of camposDeDatos()) {
    const valor = fila[campo.key]
    datos[campo.key] = typeof valor === 'string' && valor ? valor : null
  }
  return datos
}

async function persistir(
  datos: Record<string, string | null>,
  id: string | undefined,
): Promise<{ id: string }> {
  if (tab.value === 'proveedores') {
    if (id) {
      await proveedoresStore.actualizar(id, datos as Partial<Proveedor>)
      return { id }
    }
    const proveedor = await proveedoresStore.crear(datos as Partial<Proveedor>)
    return { id: proveedor.idProveedor }
  }
  if (tab.value === 'materiales') {
    if (id) {
      await materiasStore.actualizar(id, datos as Partial<MateriaPrima>)
      return { id }
    }
    const materia = await materiasStore.crear(datos as Partial<MateriaPrima>)
    return { id: materia.idMateria }
  }
  const clave = CLAVE_CATALOGO[tab.value]!
  if (id) {
    await catalogos.actualizar(clave, id, datos)
    return { id }
  }
  const elemento = await catalogos.crear(clave, datos)
  return { id: elemento[CONFIG_CATALOGOS[clave].idCampo] as string }
}

async function eliminarPorId(pestana: TabKey, id: string): Promise<void> {
  if (pestana === 'proveedores') await proveedoresStore.eliminar(id)
  else if (pestana === 'materiales') await materiasStore.eliminar(id)
  else await catalogos.eliminar(CLAVE_CATALOGO[pestana]!, id)
}

async function guardar(): Promise<void> {
  for (const clave of Object.keys(errores)) delete errores[clave]
  for (const campo of camposDeDatos()) {
    if (campo.obligatorio && !formulario[campo.key]?.trim()) {
      errores[campo.key] =
        campo.tipo === 'unidad' ? 'Selecciona una opción.' : 'Este campo es obligatorio.'
    }
  }
  if (Object.keys(errores).length > 0) return

  guardando.value = true
  const pestana = tab.value
  try {
    const datos: Record<string, string | null> = {}
    for (const campo of camposDeDatos()) {
      datos[campo.key] = formulario[campo.key]?.trim() || null
    }
    const anterior = editando.value ? datosDeFila(editando.value) : null
    const idPrevio = editando.value?.id
    const { id } = await persistir(datos, idPrevio)

    modalAbierto.value = false
    const { articulo, singular } = esquema.value
    // CAM-014: confirmación con «Deshacer» (revierte la edición o retira el alta)
    if (anterior && idPrevio) {
      snackbar.exito(`Se actualizó ${articulo} ${singular} «${datos.nombre}».`, async () => {
        tab.value = pestana
        await persistir(anterior, idPrevio)
      })
    } else {
      snackbar.exito(`Se agregó ${articulo} ${singular} «${datos.nombre}».`, async () => {
        await eliminarPorId(pestana, id)
      })
    }
  } catch (err) {
    errores.nombre = err instanceof ApiError ? err.message : 'No se pudo guardar el elemento'
  } finally {
    guardando.value = false
  }
}

/**
 * CAM-014: las eliminaciones de catálogos no requieren justificación,
 * por lo que se ejecutan directo con opción de «Deshacer» (sin diálogo previo).
 */
async function eliminarElemento(fila: FilaCatalogo): Promise<void> {
  const { articulo, singular, usosNoun } = esquema.value
  if (fila.usos > 0) {
    aviso.value = {
      texto: `No se puede eliminar «${fila.nombre}»: está vinculad${articulo === 'el' ? 'o' : 'a'} a ${fila.usos} ${usosNoun}.`,
      tono: 'warning',
    }
    return
  }
  const pestana = tab.value
  const datos = datosDeFila(fila)
  try {
    await eliminarPorId(pestana, fila.id)
    snackbar.exito(`Se eliminó ${articulo} ${singular} «${fila.nombre}».`, async () => {
      tab.value = pestana
      await persistir(datos, undefined)
    })
  } catch (err) {
    snackbar.error(err instanceof ApiError ? err.message : 'No se pudo eliminar el elemento')
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

function unidadCortaDe(fila: FilaCatalogo): string {
  return UNIDAD_CORTA[fila.unidadMedida as UnidadMedida] ?? ''
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
              @click="eliminarElemento(row)"
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
          <!-- CAM-015: encabezados que agrupan contacto y domicilio -->
          <h4 v-if="campo.tipo === 'seccion'" class="titulo-seccion sm:col-span-2">
            {{ campo.label }}
          </h4>
          <SelectField
            v-else-if="campo.tipo === 'unidad'"
            v-model="formulario[campo.key]"
            :label="campo.label"
            :required="campo.obligatorio"
            :error="errores[campo.key] ?? ''"
            placeholder="Elige una unidad"
            :options="opcionesUnidad"
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
        <template #cell-cantidad="{ row }">
          {{ Number(row.cantidad) }} {{ historialDe ? unidadCortaDe(historialDe) : '' }}
        </template>
        <template #cell-costoUnitario="{ row }">
          <strong>{{ formatearMoneda(row.costoUnitario) }}</strong>
        </template>
      </DataTable>
    </BaseModal>
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
.titulo-seccion {
  margin: 6px 0 0;
  padding-bottom: 6px;
  border-bottom: 1.5px solid var(--cream-300);
  font: 700 13px / 1 var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--clay-500);
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
