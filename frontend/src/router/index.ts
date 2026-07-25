import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { publica: true },
    },
    {
      // Ficha pública del certificado (HU-12): sin sesión, fuera del layout
      path: '/verificar/:id',
      name: 'verificacion-publica',
      component: () => import('@/views/VerificacionPublicaView.vue'),
      meta: { publica: true },
    },
    {
      path: '/',
      component: () => import('@/components/AppLayout.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
        {
          path: 'catalogos',
          name: 'catalogos',
          component: () => import('@/views/CatalogosView.vue'),
        },
        {
          path: 'materia-prima',
          name: 'materia-prima',
          component: () => import('@/views/MateriaPrimaView.vue'),
        },
        {
          path: 'artesanias',
          name: 'artesanias',
          component: () => import('@/views/ArtesaniasView.vue'),
        },
        {
          path: 'artesanias/nueva',
          name: 'artesania-nueva',
          component: () => import('@/views/ArtesaniaFormView.vue'),
        },
        {
          path: 'artesanias/:id',
          name: 'artesania-detalle',
          component: () => import('@/views/ArtesaniaDetalleView.vue'),
        },
        {
          path: 'artesanias/:id/editar',
          name: 'artesania-editar',
          component: () => import('@/views/ArtesaniaFormView.vue'),
        },
        {
          path: 'artesanias/:id/costeo',
          name: 'artesania-costeo',
          component: () => import('@/views/CosteoView.vue'),
        },
        {
          path: 'certificados',
          name: 'certificados',
          component: () => import('@/views/CertificadosView.vue'),
        },
        {
          path: 'reportes',
          name: 'reportes',
          component: () => import('@/views/ReportesView.vue'),
        },
        {
          path: 'ajustes',
          name: 'ajustes',
          component: () => import('@/views/AjustesView.vue'),
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((destino) => {
  const auth = useAuthStore()

  if (!destino.meta.publica && !auth.autenticado) {
    return { name: 'login', query: { redirigir: destino.fullPath } }
  }
  if (destino.name === 'login' && auth.autenticado) {
    return { name: 'dashboard' }
  }
  return true
})

export default router
