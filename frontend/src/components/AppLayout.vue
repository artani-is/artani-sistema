<script setup lang="ts">
import { ref, type FunctionalComponent } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import {
  ChartColumn,
  Home,
  Package,
  QrCode,
  Receipt,
  LayoutList,
  LogOut,
  Menu,
  Settings,
} from '@lucide/vue'
import AppLogo from '@/components/ui/AppLogo.vue'
import AppSnackbar from '@/components/ui/AppSnackbar.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const menuAbierto = ref(false)

interface EnlaceMenu {
  etiqueta: string
  icono: FunctionalComponent
  destino: { name: string }
}

const enlaces: EnlaceMenu[] = [
  { etiqueta: 'Inicio', icono: Home, destino: { name: 'dashboard' } },
  { etiqueta: 'Inventario', icono: Package, destino: { name: 'artesanias' } },
  { etiqueta: 'Materia prima', icono: Receipt, destino: { name: 'materia-prima' } },
  { etiqueta: 'Certificados', icono: QrCode, destino: { name: 'certificados' } },
  { etiqueta: 'Reportes', icono: ChartColumn, destino: { name: 'reportes' } },
  { etiqueta: 'Catálogos', icono: LayoutList, destino: { name: 'catalogos' } },
  { etiqueta: 'Ajustes', icono: Settings, destino: { name: 'ajustes' } },
]

function salir(): void {
  auth.cerrarSesion()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen lg:flex">
    <!-- Barra móvil (el diseño es de escritorio; esto es un plegable mínimo) -->
    <header
      class="flex items-center justify-between px-4 py-3 lg:hidden"
      :style="{ background: 'var(--green-700)', color: 'var(--cream-100)' }"
    >
      <AppLogo size="sm" on-dark />
      <button
        type="button"
        class="inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-2"
        :style="{ border: '1.5px solid rgba(255,255,255,0.3)', color: 'var(--cream-100)' }"
        @click="menuAbierto = !menuAbierto"
      >
        <Menu :size="18" /> Menú
      </button>
    </header>

    <aside
      class="w-full shrink-0 flex-col lg:flex lg:min-h-screen"
      :class="menuAbierto ? 'flex' : 'hidden'"
      :style="{ width: 'var(--sidebar-width)', background: 'var(--green-700)', padding: '24px 16px' }"
    >
      <div class="hidden px-3 pb-8 pt-1 lg:block">
        <AppLogo size="sm" on-dark />
      </div>

      <nav class="flex flex-1 flex-col gap-1">
        <RouterLink
          v-for="enlace in enlaces"
          :key="enlace.etiqueta"
          :to="enlace.destino"
          class="nav-item"
          :active-class="enlace.destino.name === 'dashboard' ? '' : 'nav-item-activo'"
          exact-active-class="nav-item-activo"
          @click="menuAbierto = false"
        >
          <span class="marcador" aria-hidden="true" />
          <component :is="enlace.icono" :size="22" />
          {{ enlace.etiqueta }}
        </RouterLink>
      </nav>

      <div :style="{ paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.12)' }">
        <p class="m-0 truncate" :style="{ font: '700 var(--text-sm)/1.3 var(--font-sans)', color: 'var(--cream-50)' }">
          {{ auth.nombreCompleto }}
        </p>
        <p class="m-0 truncate" :style="{ font: '400 var(--text-xs)/1.4 var(--font-sans)', color: 'var(--text-on-dark-muted)' }">
          {{ auth.artesano?.nombreTaller }}
        </p>
        <button type="button" class="nav-item mt-3 w-full" @click="salir">
          <LogOut :size="20" />
          Cerrar sesión
        </button>
      </div>
    </aside>

    <div class="min-w-0 flex-1">
      <RouterView />
    </div>

    <!-- CAM-014: notificaciones globales del panel administrativo -->
    <AppSnackbar />
  </div>
</template>

<style scoped>
.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  text-decoration: none;
  background: transparent;
  color: var(--text-on-dark-muted);
  font: 500 var(--text-body) / 1 var(--font-sans);
  transition:
    background var(--duration-fast),
    color var(--duration-fast);
}
.nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
}
.nav-item-activo {
  background: rgba(255, 255, 255, 0.1);
  color: var(--cream-50);
  font-weight: 700;
}
.marcador {
  display: none;
}
.nav-item-activo .marcador {
  display: block;
  position: absolute;
  left: -4px;
  top: 12px;
  bottom: 12px;
  width: 4px;
  border-radius: var(--radius-pill);
  background: var(--amber-500);
}
</style>
