<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Check } from '@lucide/vue'
import TopBar from '@/components/ui/TopBar.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import PhotoSlot from '@/components/ui/PhotoSlot.vue'
import TextField from '@/components/ui/TextField.vue'
import SelectField, { type OpcionSelect } from '@/components/ui/SelectField.vue'
import { useArtesaniasStore } from '@/stores/artesanias'
import { useCatalogosStore } from '@/stores/catalogos'
import { useSnackbarStore } from '@/stores/snackbar'
import { ApiError } from '@/lib/api'

const route = useRoute()
const router = useRouter()
const store = useArtesaniasStore()
const catalogos = useCatalogosStore()
const snackbar = useSnackbarStore()

/** CAM-014: estado previo de la ficha para poder deshacer una edición. */
let fichaPrevia: { nombre: string; descripcion: string | null; idTecnica: string; idCategoria: string } | null = null

const idArtesania = computed(() =>
  typeof route.params.id === 'string' ? route.params.id : null,
)
const editando = computed(() => idArtesania.value !== null)

const formulario = reactive({ nombre: '', descripcion: '', idTecnica: '', idCategoria: '' })
const error = ref<string | null>(null)
const cargandoPieza = ref(false)
const guardando = ref(false)

const archivos = ref<File[]>([])
const vistaPrevia = ref<string | null>(null)

const opcionesTecnica = computed<OpcionSelect[]>(() =>
  catalogos.listas.tecnicas.map((t) => ({ value: t.idTecnica as string, label: t.nombre })),
)
const opcionesCategoria = computed<OpcionSelect[]>(() =>
  catalogos.listas.categorias.map((c) => ({ value: c.idCategoria as string, label: c.nombre })),
)

onMounted(async () => {
  catalogos.cargar('tecnicas')
  catalogos.cargar('categorias')

  if (idArtesania.value) {
    cargandoPieza.value = true
    try {
      const pieza = await store.obtener(idArtesania.value)
      Object.assign(formulario, {
        nombre: pieza.nombre,
        descripcion: pieza.descripcion ?? '',
        idTecnica: pieza.idTecnica,
        idCategoria: pieza.idCategoria,
      })
      fichaPrevia = {
        nombre: pieza.nombre,
        descripcion: pieza.descripcion,
        idTecnica: pieza.idTecnica,
        idCategoria: pieza.idCategoria,
      }
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : 'No se pudo cargar la pieza'
    } finally {
      cargandoPieza.value = false
    }
  }
})

function seleccionarFotos(evento: Event): void {
  const entrada = evento.target as HTMLInputElement
  archivos.value = Array.from(entrada.files ?? [])
  if (vistaPrevia.value) URL.revokeObjectURL(vistaPrevia.value)
  vistaPrevia.value = archivos.value[0] ? URL.createObjectURL(archivos.value[0]) : null
}

async function guardar(): Promise<void> {
  guardando.value = true
  error.value = null
  try {
    const datos = {
      nombre: formulario.nombre.trim(),
      descripcion: formulario.descripcion.trim() || null,
      idTecnica: formulario.idTecnica,
      idCategoria: formulario.idCategoria,
    }
    const pieza = idArtesania.value
      ? await store.actualizar(idArtesania.value, datos)
      : await store.crear(datos)

    if (!idArtesania.value && archivos.value.length > 0) {
      await store.subirFotos(pieza.idArtesania, archivos.value)
    }
    // CAM-014: confirmación visual; la edición puede deshacerse
    if (idArtesania.value && fichaPrevia) {
      const id = idArtesania.value
      const anterior = fichaPrevia
      snackbar.exito(`Ficha actualizada: ${pieza.nombre}.`, async () => {
        await store.actualizar(id, anterior)
      })
    } else {
      snackbar.exito(`Pieza registrada: ${pieza.nombre}.`)
    }
    router.push({ name: 'artesania-detalle', params: { id: pieza.idArtesania } })
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'No se pudo guardar la pieza'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div>
    <TopBar
      :title="editando ? 'Editar pieza' : 'Nueva pieza'"
      :subtitle="editando ? 'Actualiza la ficha técnica' : 'Registra una artesanía en el inventario'"
    >
      <template #actions>
        <BaseButton variant="ghost" @click="router.push({ name: 'artesanias' })">
          <template #icon><ArrowLeft :size="18" /></template>
          {{ editando ? 'Volver' : 'Cancelar' }}
        </BaseButton>
      </template>
    </TopBar>

    <div
      class="grid max-w-[940px] grid-cols-1 items-start gap-7 lg:grid-cols-[1fr_300px]"
      :style="{ padding: 'var(--page-pad)' }"
    >
      <p v-if="cargandoPieza" :style="{ color: 'var(--clay-500)' }">Cargando pieza…</p>

      <form v-else class="card card-padded flex flex-col gap-5" @submit.prevent="guardar">
        <TextField
          v-model="formulario.nombre"
          label="Nombre de la pieza"
          placeholder="p. ej. Jarrón de barro negro"
          required
          :maxlength="200"
        />
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField
            v-model="formulario.idTecnica"
            label="Técnica"
            placeholder="Elige una técnica"
            required
            :options="opcionesTecnica"
          />
          <SelectField
            v-model="formulario.idCategoria"
            label="Categoría"
            placeholder="Elige una categoría"
            required
            :options="opcionesCategoria"
          />
        </div>
        <TextField
          v-model="formulario.descripcion"
          label="Descripción"
          multiline
          :rows="4"
          placeholder="Historia, dimensiones, detalles de elaboración…"
        />

        <p
          v-if="opcionesTecnica.length === 0 || opcionesCategoria.length === 0"
          class="m-0"
          :style="{ font: '400 var(--text-sm)/1.4 var(--font-sans)', color: 'var(--clay-500)' }"
        >
          Necesitas al menos una técnica y una categoría en «Catálogos» para registrar piezas.
        </p>

        <BaseAlert v-if="error" tone="error" @cerrar="error = null">{{ error }}</BaseAlert>

        <div class="flex gap-3 pt-1">
          <BaseButton type="submit" variant="primary" :disabled="guardando">
            <template #icon><Check :size="18" /></template>
            {{ guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar pieza' }}
          </BaseButton>
          <BaseButton variant="secondary" @click="router.push({ name: 'artesanias' })">
            Cancelar
          </BaseButton>
        </div>
      </form>

      <div v-if="!editando" class="flex flex-col gap-3">
        <span :style="{ font: '700 var(--text-label)/1 var(--font-sans)', color: 'var(--green-900)' }">
          Fotografías <span :style="{ color: 'var(--terracotta-500)' }">*</span>
        </span>
        <label class="cursor-pointer">
          <PhotoSlot
            :src="vistaPrevia ?? ''"
            caption="Haz clic para elegir fotografías"
            aspect="3 / 4"
          />
          <input
            type="file"
            accept="image/png,image/jpeg"
            multiple
            class="hidden"
            @change="seleccionarFotos"
          />
        </label>
        <span :style="{ font: '400 var(--text-label)/1.4 var(--font-sans)', color: 'var(--clay-500)' }">
          PNG o JPG · máx. 5 MB por archivo.
          {{ archivos.length > 0 ? `${archivos.length} archivo(s) seleccionado(s); se subirán al guardar.` : 'Se requiere al menos una foto para el certificado.' }}
        </span>
      </div>
      <div v-else class="flex flex-col gap-3">
        <span :style="{ font: '700 var(--text-label)/1 var(--font-sans)', color: 'var(--green-900)' }">
          Fotografías
        </span>
        <p class="m-0" :style="{ font: '400 var(--text-sm)/1.5 var(--font-sans)', color: 'var(--clay-500)' }">
          Las fotografías se administran desde la ficha de la pieza.
        </p>
      </div>
    </div>
  </div>
</template>
