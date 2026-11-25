<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ArrowRight, Clock, FileText, RefreshCw, ShieldCheck,
  TrendingDown, TrendingUp, Users, Wallet,
} from 'lucide-vue-next'
import { useAdminFinanceStore } from '@/stores/adminFinance'
import { useBdoLifeStore } from '@/stores/bdoLife'
import { useSettingsStore, formatCurrency } from '@/stores/counter'
import { userDisplayName } from '@/data/users'

const store = useAdminFinanceStore()
const bdoStore = useBdoLifeStore()
const settingsStore = useSettingsStore()

function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const monthFilter = ref<string>(currentMonthKey())   // YYYY-MM, empty = all time

function refresh(): void {
  void store.loadUsers()
  void store.loadAllTransactions()
  void bdoStore.loadSubmissions()
}

onMounted(refresh)

const loading = computed(() => store.usersLoading || store.allLoading)

const periodRows = computed(() =>
  monthFilter.value
    ? store.allTransactions.filter(t => t.date.startsWith(monthFilter.value))
    : store.allTransactions,
)

const totalIncome = computed(() =>
  periodRows.value.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
)
const totalExpenses = computed(() =>
  periodRows.value.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
)

const pendingSubmissions = computed(() =>
  bdoStore.submissions.filter(s => !s.acknowledged_at),
)

interface UserSummary {
  id: string
  name: string
  email: string
  income: number
  expenses: number
  net: number
  count: number
  lastDate: string | null
}

const userSummaries = computed<UserSummary[]>(() => {
  const map = new Map<string, UserSummary>()
  const ensure = (id: string, email = ''): UserSummary => {
    let row = map.get(id)
    if (!row) {
      row = { id, name: userDisplayName(id, email || undefined), email, income: 0, expenses: 0, net: 0, count: 0, lastDate: null }
      map.set(id, row)
    }
    return row
  }

  for (const u of store.users) ensure(u.id, u.email)
  for (const t of periodRows.value) {
    const row = ensure(t.user_id)
    if (t.type === 'income') row.income += t.amount
    else row.expenses += t.amount
    row.count++
    if (!row.lastDate || t.date > row.lastDate) row.lastDate = t.date
  }
  for (const row of map.values()) row.net = row.income - row.expenses

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const periodLabel = computed(() => {
  if (!monthFilter.value) return 'All time'
  const [y, m] = monthFilter.value.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' })
})

function fmt(value: number): string {
  return formatCurrency(value, settingsStore.settings.currency)
}

function fmtDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00.000Z` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    timeZone: iso.length === 10 ? 'UTC' : 'Asia/Singapore',
  })
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-text">Admin Dashboard</h1>
        <p class="mt-1 text-sm text-text-muted">Overview of every user's incomes, expenses and BDO Life deposits.</p>
      </div>
      <div class="flex items-center gap-2">
        <input
          v-model="monthFilter"
          type="month"
          aria-label="Month"
          class="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <button
          type="button"
          :class="[
            'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
            monthFilter ? 'border-border text-text-muted hover:bg-surface-alt' : 'border-primary-600 bg-primary-600 text-white',
          ]"
          @click="monthFilter = ''"
        >All time</button>
        <button
          type="button"
          class="rounded-lg border border-border p-2 text-text-muted transition-colors hover:bg-surface-alt disabled:opacity-50"
          :disabled="loading"
          aria-label="Refresh"
          @click="refresh"
        >
          <RefreshCw :size="16" :class="loading ? 'animate-spin' : ''" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Errors -->
    <div
      v-for="err in [store.usersError, store.allError, bdoStore.error].filter(Boolean)"
      :key="err!"
      class="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700"
      role="alert"
    >{{ err }}</div>

    <!-- Stat cards -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div class="flex items-center gap-2 text-xs font-medium text-text-muted">
          <Users :size="14" class="text-primary-600" aria-hidden="true" /> Users
        </div>
        <p class="mt-2 text-lg font-semibold text-text">{{ userSummaries.length }}</p>
      </div>
      <div class="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div class="flex items-center gap-2 text-xs font-medium text-text-muted">
          <TrendingUp :size="14" class="text-secondary-600" aria-hidden="true" /> Total Income
        </div>
        <p class="mt-2 text-lg font-semibold text-secondary-700">{{ fmt(totalIncome) }}</p>
        <p class="mt-0.5 text-xs text-text-subtle">{{ periodLabel }}</p>
      </div>
      <div class="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div class="flex items-center gap-2 text-xs font-medium text-text-muted">
          <TrendingDown :size="14" class="text-danger-600" aria-hidden="true" /> Total Expenses
        </div>
        <p class="mt-2 text-lg font-semibold text-danger-700">{{ fmt(totalExpenses) }}</p>
        <p class="mt-0.5 text-xs text-text-subtle">{{ periodLabel }}</p>
      </div>
      <RouterLink
        to="/bdo-life"
        class="rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:bg-surface-alt"
      >
        <div class="flex items-center gap-2 text-xs font-medium text-text-muted">
          <Clock :size="14" class="text-warning-600" aria-hidden="true" /> Pending Acknowledgments
        </div>
        <p class="mt-2 text-lg font-semibold" :class="pendingSubmissions.length ? 'text-warning-700' : 'text-text'">
          {{ pendingSubmissions.length }}
        </p>
        <p class="mt-0.5 text-xs text-text-subtle">BDO Life deposits</p>
      </RouterLink>
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Per-user summary -->
      <section class="overflow-hidden rounded-xl border border-border bg-surface shadow-sm lg:col-span-2">
        <div class="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 class="text-base font-semibold text-text">Users</h2>
            <p class="mt-1 text-xs text-text-muted">{{ periodLabel }} · click a user to see their transactions</p>
          </div>
        </div>

        <div v-if="loading && userSummaries.length === 0" class="px-5 py-10 text-center text-sm text-text-muted" role="status">
          Loading…
        </div>
        <div v-else-if="userSummaries.length === 0" class="px-5 py-12 text-center">
          <FileText :size="22" class="mx-auto mb-2 text-text-subtle" aria-hidden="true" />
          <p class="text-sm font-medium text-text">No users found</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[600px] text-sm">
            <thead>
              <tr class="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th class="px-4 py-3">User</th>
                <th class="px-4 py-3 text-right">Income</th>
                <th class="px-4 py-3 text-right">Expenses</th>
                <th class="px-4 py-3 text-right">Net</th>
                <th class="px-4 py-3">Last activity</th>
                <th class="px-4 py-3" aria-label="Open" />
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="u in userSummaries" :key="u.id" class="hover:bg-surface-alt">
                <td class="px-4 py-3">
                  <p class="font-medium text-text">{{ u.name }}</p>
                  <p class="text-xs text-text-subtle">{{ u.count }} transaction{{ u.count === 1 ? '' : 's' }}</p>
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-right text-secondary-700">{{ fmt(u.income) }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-right text-danger-700">{{ fmt(u.expenses) }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-right font-semibold" :class="u.net >= 0 ? 'text-text' : 'text-danger-700'">
                  {{ fmt(u.net) }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-text-muted">{{ u.lastDate ? fmtDate(u.lastDate) : '—' }}</td>
                <td class="px-4 py-3 text-right">
                  <RouterLink
                    :to="{ name: 'admin-users', query: { user: u.id } }"
                    class="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                  >
                    View <ArrowRight :size="13" aria-hidden="true" />
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Pending BDO Life acknowledgments -->
      <section class="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div class="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 class="text-base font-semibold text-text">Awaiting acknowledgment</h2>
            <p class="mt-1 text-xs text-text-muted">BDO Life deposits</p>
          </div>
          <ShieldCheck :size="18" class="text-primary-600" aria-hidden="true" />
        </div>

        <div v-if="bdoStore.loading && bdoStore.submissions.length === 0" class="px-5 py-10 text-center text-sm text-text-muted" role="status">
          Loading…
        </div>
        <div v-else-if="pendingSubmissions.length === 0" class="px-5 py-12 text-center">
          <Wallet :size="22" class="mx-auto mb-2 text-text-subtle" aria-hidden="true" />
          <p class="text-sm font-medium text-text">All caught up</p>
        </div>
        <ul v-else class="divide-y divide-border" role="list">
          <li v-for="s in pendingSubmissions.slice(0, 6)" :key="s.id" class="flex items-center justify-between gap-3 px-5 py-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-text">{{ userDisplayName(s.user_id) }}</p>
              <p class="text-xs text-text-subtle">{{ fmtDate(s.submitted_at) }}</p>
            </div>
            <p class="whitespace-nowrap text-sm font-semibold text-text">{{ fmt(s.amount) }}</p>
          </li>
        </ul>
        <div class="border-t border-border px-5 py-3">
          <RouterLink to="/bdo-life" class="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700">
            Review in BDO Life <ArrowRight :size="13" aria-hidden="true" />
          </RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>
