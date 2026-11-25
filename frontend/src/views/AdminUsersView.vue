<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, Eye, FileText, RefreshCw, TrendingDown, TrendingUp, Wallet } from 'lucide-vue-next'
import { useAdminFinanceStore } from '@/stores/adminFinance'
import { useSettingsStore, formatCurrency } from '@/stores/counter'
import { userDisplayName } from '@/data/users'

const store = useAdminFinanceStore()
const settingsStore = useSettingsStore()

const route = useRoute()
const queryUser = typeof route.query.user === 'string' ? route.query.user : ''
const selectedUser = ref<string>(queryUser || store.selectedUserId || '')
const typeFilter   = ref<'all' | 'income' | 'expense'>('all')
const monthFilter  = ref<string>('')   // YYYY-MM, empty = all months

onMounted(() => {
  if (store.users.length === 0) void store.loadUsers()
})

watch(selectedUser, (id) => {
  if (id) void store.loadUserTransactions(id)
}, { immediate: true })

const selectedEmail = computed(
  () => store.users.find(u => u.id === selectedUser.value)?.email ?? '',
)
const selectedName = computed(
  () => selectedUser.value ? userDisplayName(selectedUser.value, selectedEmail.value) : '',
)

const monthFiltered = computed(() =>
  monthFilter.value
    ? store.transactions.filter(t => t.date.startsWith(monthFilter.value))
    : store.transactions,
)

const visible = computed(() =>
  typeFilter.value === 'all'
    ? monthFiltered.value
    : monthFiltered.value.filter(t => t.type === typeFilter.value),
)

const totalIncome = computed(() =>
  monthFiltered.value.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
)
const totalExpenses = computed(() =>
  monthFiltered.value.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
)
const net = computed(() => totalIncome.value - totalExpenses.value)

function fmt(value: number): string {
  return formatCurrency(value, settingsStore.settings.currency)
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

const typeTabs = [
  { value: 'all',     label: 'All' },
  { value: 'income',  label: 'Income' },
  { value: 'expense', label: 'Expenses' },
] as const
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-text">User Finances</h1>
        <p class="mt-1 text-sm text-text-muted">View any user's incomes and expenses. Read-only.</p>
      </div>
      <div class="flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700">
        <Eye :size="14" aria-hidden="true" />
        Admin view
      </div>
    </div>

    <!-- Users error -->
    <div
      v-if="store.usersError"
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700"
      role="alert"
    >
      <span>Users could not be loaded: {{ store.usersError }}</span>
      <button
        class="flex items-center gap-1.5 rounded-md border border-danger-300 px-3 py-1.5 text-xs font-medium hover:bg-danger-100"
        :disabled="store.usersLoading"
        @click="store.loadUsers()"
      >
        <RefreshCw :size="13" aria-hidden="true" /> Retry
      </button>
    </div>

    <!-- Filters -->
    <section class="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label for="admin-user" class="mb-1.5 block text-sm font-medium text-text">User</label>
          <div class="relative">
            <select
              id="admin-user"
              v-model="selectedUser"
              :disabled="store.usersLoading"
              class="w-full appearance-none rounded-lg border border-border bg-bg px-3 py-2.5 pr-8 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50"
            >
              <option value="" disabled>{{ store.usersLoading ? 'Loading users…' : 'Select a user' }}</option>
              <option v-for="u in store.users" :key="u.id" :value="u.id">{{ userDisplayName(u.id, u.email) }}</option>
            </select>
            <ChevronDown :size="13" class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
          </div>
        </div>
        <div>
          <label for="admin-month" class="mb-1.5 block text-sm font-medium text-text">Month</label>
          <div class="flex gap-2">
            <input
              id="admin-month"
              v-model="monthFilter"
              type="month"
              class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <button
              v-if="monthFilter"
              class="shrink-0 rounded-lg border border-border px-3 text-xs font-medium text-text-muted hover:bg-surface-alt"
              @click="monthFilter = ''"
            >All</button>
          </div>
        </div>
        <div>
          <span class="mb-1.5 block text-sm font-medium text-text">Type</span>
          <div class="flex w-fit overflow-hidden rounded-lg border border-border text-sm">
            <button
              v-for="t in typeTabs"
              :key="t.value"
              type="button"
              :class="[
                'px-4 py-2 font-medium transition-colors',
                typeFilter === t.value ? 'bg-primary-600 text-white' : 'text-text-muted hover:bg-surface-alt',
              ]"
              @click="typeFilter = t.value"
            >{{ t.label }}</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Empty: no user selected -->
    <section v-if="!selectedUser" class="rounded-xl border border-border bg-surface px-5 py-12 text-center shadow-sm">
      <FileText :size="22" class="mx-auto mb-2 text-text-subtle" aria-hidden="true" />
      <p class="text-sm font-medium text-text">Select a user to see their incomes and expenses</p>
    </section>

    <template v-else>
      <!-- Summary -->
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div class="flex items-center gap-2 text-xs font-medium text-text-muted">
            <TrendingUp :size="14" class="text-secondary-600" aria-hidden="true" /> Total Income
          </div>
          <p class="mt-2 text-lg font-semibold text-secondary-700">{{ fmt(totalIncome) }}</p>
        </div>
        <div class="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div class="flex items-center gap-2 text-xs font-medium text-text-muted">
            <TrendingDown :size="14" class="text-danger-600" aria-hidden="true" /> Total Expenses
          </div>
          <p class="mt-2 text-lg font-semibold text-danger-700">{{ fmt(totalExpenses) }}</p>
        </div>
        <div class="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div class="flex items-center gap-2 text-xs font-medium text-text-muted">
            <Wallet :size="14" class="text-primary-600" aria-hidden="true" /> Net
          </div>
          <p class="mt-2 text-lg font-semibold" :class="net >= 0 ? 'text-text' : 'text-danger-700'">{{ fmt(net) }}</p>
        </div>
      </div>

      <!-- Transactions -->
      <section class="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div class="min-w-0">
            <h2 class="text-base font-semibold text-text">Transactions</h2>
            <p class="mt-1 truncate text-xs text-text-muted">
              {{ selectedName }}<span v-if="selectedEmail && selectedEmail !== selectedName"> · {{ selectedEmail }}</span>
            </p>
          </div>
          <span class="text-xs text-text-muted">
            {{ visible.length }} record{{ visible.length === 1 ? '' : 's' }}
          </span>
        </div>

        <div v-if="store.txLoading" class="px-5 py-10 text-center text-sm text-text-muted" role="status">
          Loading transactions…
        </div>
        <div v-else-if="store.txError" class="flex flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-danger-700" role="alert">
          <span>{{ store.txError }}</span>
          <button
            class="flex items-center gap-1.5 rounded-md border border-danger-300 px-3 py-1.5 text-xs font-medium hover:bg-danger-50"
            @click="store.loadUserTransactions(selectedUser)"
          >
            <RefreshCw :size="13" aria-hidden="true" /> Retry
          </button>
        </div>
        <div v-else-if="visible.length === 0" class="px-5 py-12 text-center">
          <FileText :size="22" class="mx-auto mb-2 text-text-subtle" aria-hidden="true" />
          <p class="text-sm font-medium text-text">No transactions found</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[640px] text-sm">
            <thead>
              <tr class="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th class="px-4 py-3">Date</th>
                <th class="px-4 py-3">Description</th>
                <th class="px-4 py-3">Category</th>
                <th class="px-4 py-3">Type</th>
                <th class="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="t in visible" :key="t.id" class="hover:bg-surface-alt">
                <td class="whitespace-nowrap px-4 py-3 text-text-muted">{{ fmtDate(t.date) }}</td>
                <td class="px-4 py-3 text-text">
                  {{ t.description }}
                  <p v-if="t.notes" class="mt-0.5 text-xs text-text-subtle">{{ t.notes }}</p>
                </td>
                <td class="px-4 py-3 text-text-muted">{{ t.category || '—' }}</td>
                <td class="px-4 py-3">
                  <span
                    class="rounded-full border px-2 py-0.5 text-xs"
                    :class="t.type === 'income'
                      ? 'bg-success-50 border-success-200 text-success-700'
                      : 'bg-danger-50 border-danger-200 text-danger-700'"
                  >{{ t.type === 'income' ? 'Income' : 'Expense' }}</span>
                </td>
                <td
                  class="whitespace-nowrap px-4 py-3 text-right font-semibold"
                  :class="t.type === 'income' ? 'text-secondary-700' : 'text-danger-700'"
                >
                  {{ t.type === 'income' ? '+' : '−' }}{{ fmt(t.amount) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
