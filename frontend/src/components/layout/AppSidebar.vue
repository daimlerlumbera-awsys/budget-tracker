<script setup lang="ts">
import { useRoute, RouterLink } from 'vue-router'
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  History,
  Settings,
  X,
} from 'lucide-vue-next'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const route = useRoute()

const navItems = [
  { label: 'Overview',     to: '/',             icon: LayoutDashboard },
  { label: 'Budgets',      to: '/budgets',      icon: Wallet },
  { label: 'Transactions', to: '/transactions', icon: ArrowLeftRight },
  { label: 'History',      to: '/history',      icon: History },
  { label: 'Settings',     to: '/settings',     icon: Settings },
]

function isActive(path: string) {
  return path === '/' ? route.path === '/' : route.path.startsWith(path)
}
</script>

<template>
  <!-- Mobile backdrop -->
  <Transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 z-20 bg-neutral-900/40 lg:hidden"
      aria-hidden="true"
      @click="emit('close')"
    />
  </Transition>

  <!-- Sidebar panel -->
  <aside
    :class="[
      'fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-surface border-r border-border',
      'transition-transform duration-200 ease-in-out',
      'lg:static lg:translate-x-0',
      open ? 'translate-x-0' : '-translate-x-full',
    ]"
    aria-label="Primary navigation"
  >
    <!-- Logo / App name -->
    <div class="flex h-16 shrink-0 items-center justify-between px-5 border-b border-border">
      <div class="flex items-center gap-2.5">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
          <Wallet :size="16" class="text-white" aria-hidden="true" />
        </div>
        <span class="text-base font-semibold text-text tracking-tight">BudgetTracker</span>
      </div>
      <!-- Close button — mobile only -->
      <button
        class="lg:hidden -mr-1 rounded-md p-1.5 text-text-muted hover:bg-surface-alt hover:text-text transition-colors"
        aria-label="Close navigation"
        @click="emit('close')"
      >
        <X :size="18" aria-hidden="true" />
      </button>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto px-3 py-4" aria-label="Main menu">
      <ul class="space-y-0.5" role="list">
        <li v-for="item in navItems" :key="item.to">
          <RouterLink
            :to="item.to"
            :class="[
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive(item.to)
                ? 'bg-primary-50 text-primary-700'
                : 'text-text-muted hover:bg-surface-alt hover:text-text',
            ]"
            :aria-current="isActive(item.to) ? 'page' : undefined"
            @click="emit('close')"
          >
            <component
              :is="item.icon"
              :size="18"
              :class="isActive(item.to) ? 'text-primary-600' : 'text-text-subtle'"
              aria-hidden="true"
            />
            {{ item.label }}
          </RouterLink>
        </li>
      </ul>
    </nav>

    <!-- Bottom spacer / version -->
    <div class="shrink-0 px-5 py-3 border-t border-border">
      <p class="text-xs text-text-subtle">Budget Tracker v0.1</p>
    </div>
  </aside>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
