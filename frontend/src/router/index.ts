import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: [
        {
          path: '',
          name: 'overview',
          component: () => import('@/views/OverviewView.vue'),
          meta: { title: 'Overview' },
        },
        {
          path: 'budgets',
          name: 'budgets',
          component: () => import('@/views/BudgetView.vue'),
          meta: { title: 'Budgets' },
        },
        {
          path: 'transactions',
          name: 'transactions',
          component: () => import('@/views/TranscationView.vue'),
          meta: { title: 'Transactions' },
        },
        {
          path: 'history',
          name: 'history',
          component: () => import('@/views/HistoryView.vue'),
          meta: { title: 'History' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/SettingsView.vue'),
          meta: { title: 'Settings' },
        },
      ],
    },
  ],
})

export default router
