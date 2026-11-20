import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { seedUser } from '@/services/seedUser'
import AppLayout from '@/layouts/AppLayout.vue'

const seeded = new Set<string>()

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/Login.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/Register.vue'),
    },
    {
      path: '/',
      component: AppLayout,
      children: [
        {
          path: '',
          name: 'overview',
          component: () => import('@/views/OverviewView.vue'),
          meta: { title: 'Overview', requiresAuth: true },
        },
        {
          path: 'budgets',
          name: 'budgets',
          component: () => import('@/views/BudgetView.vue'),
          meta: { title: 'Budgets', requiresAuth: true },
        },
        {
          path: 'transactions',
          name: 'transactions',
          component: () => import('@/views/TranscationView.vue'),
          meta: { title: 'Transactions', requiresAuth: true },
        },
        {
          path: 'history',
          name: 'history',
          component: () => import('@/views/HistoryView.vue'),
          meta: { title: 'History', requiresAuth: true },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/SettingsView.vue'),
          meta: { title: 'Settings', requiresAuth: true },
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.initAuth()

  const isAuthenticated = !!auth.session

  if (isAuthenticated && auth.user && !seeded.has(auth.user.id)) {
    try {
      await seedUser(auth.user.id)
      seeded.add(auth.user.id)
    } catch (e) {
      console.error('seedUser failed:', e)
      return false
    }
  }

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login' }
  }

  if ((to.name === 'login' || to.name === 'register') && isAuthenticated) {
    return { name: 'overview' }
  }
})

export default router
