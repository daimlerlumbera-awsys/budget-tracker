<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  AlertTriangle, CalendarDays, Check,
  ChevronDown, Pencil, Plus, Search, Trash2, TrendingDown, TrendingUp,
  Wallet, X,
} from 'lucide-vue-next'
import {
  deriveCutoffPeriod, formatCurrency, useSettingsStore, useTransactionStore,
  type CutoffPeriod, type Transaction,
} from '@/stores/counter'
import { useAuthStore } from '@/stores/auth'

const store = useTransactionStore()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()

type TransactionType = Transaction['type']

interface TransactionForm {
  description: string
  amount: string
  category_id: string
  type: TransactionType
  date: string
  notes: string
}

function localDateInput(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function categoriesFor(type: TransactionType) {
  return settingsStore.categories.filter(category => category.type === type)
}

function defaultCategoryId(type: TransactionType): string {
  return categoriesFor(type)[0]?.id ?? ''
}

function emptyForm(): TransactionForm {
  return {
    description: '',
    amount: '',
    category_id: defaultCategoryId('expense'),
    type: 'expense',
    date: localDateInput(),
    notes: '',
  }
}

const search = ref('')
const filterType = ref<'all' | TransactionType>('all')
const filterCategory = ref('all')
const filterCutoff = ref<'all' | CutoffPeriod>('all')
const filterFrom = ref('')
const filterTo = ref('')

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const formSaving = ref(false)
const formError = ref<string | null>(null)
const form = reactive<TransactionForm>(emptyForm())

const deleteTarget = ref<Transaction | null>(null)
const deleteSaving = ref(false)
const deleteError = ref<string | null>(null)

const editingTransaction = computed(() =>
  editingId.value
    ? store.items.find(transaction => transaction.id === editingId.value) ?? null
    : null,
)

const formCategories = computed(() => {
  const categories = categoriesFor(form.type)
  const historical = editingTransaction.value
  if (
    historical &&
    historical.type === form.type &&
    historical.category_id === form.category_id &&
    !categories.some(category => category.id === historical.category_id)
  ) {
    return [...categories, {
      id: historical.category_id,
      name: historical.category,
      type: historical.type,
      is_builtin: false,
    }]
  }
  return categories
})

const availableCategories = computed(() => {
  const names = new Set([
    ...settingsStore.categories.map(category => category.name),
    ...store.items.map(transaction => transaction.category).filter(Boolean),
  ])
  return [...names].sort((a, b) => a.localeCompare(b))
})

const filteredTransactions = computed(() => {
  const query = search.value.trim().toLowerCase()
  return [...store.items]
    .filter(transaction => {
      if (filterType.value !== 'all' && transaction.type !== filterType.value) return false
      if (filterCategory.value !== 'all' && transaction.category !== filterCategory.value) return false
      if (filterCutoff.value !== 'all' && transaction.cutoff_period !== filterCutoff.value) return false
      if (filterFrom.value && transaction.date < filterFrom.value) return false
      if (filterTo.value && transaction.date > filterTo.value) return false
      if (
        query &&
        !transaction.description.toLowerCase().includes(query) &&
        !transaction.category.toLowerCase().includes(query) &&
        !(transaction.notes ?? '').toLowerCase().includes(query)
      ) return false
      return true
    })
    .sort((a, b) => b.date.localeCompare(a.date))
})

const summaryIncome = computed(() =>
  filteredTransactions.value
    .filter(transaction => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0),
)

const summaryExpenses = computed(() =>
  filteredTransactions.value
    .filter(transaction => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0),
)

const summaryNet = computed(() => summaryIncome.value - summaryExpenses.value)

const previewCutoff = computed(() => form.date
  ? deriveCutoffPeriod(form.date, settingsStore.settings.cutoff1, settingsStore.settings.cutoff2)
  : null
)

watch(
  () => authStore.user?.id,
  userId => {
    if (!userId) {
      store.clearTransactions()
      return
    }
    void loadUserData(userId)
  },
  { immediate: true },
)

async function loadUserData(userId: string): Promise<void> {
  const isCurrentUser = () => authStore.user?.id === userId
  if (!isCurrentUser()) return

  let settingsReadyForUser =
    !settingsStore.settingsLoading &&
    settingsStore.settingsLoaded &&
    settingsStore.settingsUserId === userId

  if (settingsStore.settingsLoading) {
    const loadingUserMatches = settingsStore.settingsLoadingUserId === userId
    await waitForLoading(() => settingsStore.settingsLoading)
    if (!isCurrentUser()) return
    settingsReadyForUser =
      loadingUserMatches &&
      settingsStore.settingsLoaded &&
      settingsStore.settingsUserId === userId
  }

  if (!settingsReadyForUser) {
    await settingsStore.loadSettings(userId)
    if (!isCurrentUser()) return
  }
  if (!settingsStore.settingsLoaded || settingsStore.settingsUserId !== userId) return

  if (settingsStore.categoriesLoading) {
    await waitForLoading(() => settingsStore.categoriesLoading)
    if (!isCurrentUser()) return
  }

  if (settingsStore.categoriesUserId !== userId || !settingsStore.categoriesLoaded) {
    await settingsStore.loadCategories(userId)
    if (!isCurrentUser()) return
  }

  if (store.transactionsUserId !== userId || !store.transactionsLoaded) {
    if (store.transactionsLoading && store.transactionsRequestedUserId === userId) return
    await store.loadTransactions(userId)
    if (!isCurrentUser()) return
  }
}

function waitForLoading(isLoading: () => boolean): Promise<void> {
  if (!isLoading()) return Promise.resolve()

  return new Promise(resolve => {
    const stop = watch(isLoading, loading => {
      if (!loading) {
        stop()
        resolve()
      }
    }, { flush: 'sync' })
  })
}

function formatPHP(amount: number): string {
  return formatCurrency(amount, settingsStore.settings.currency)
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function resetFilters(): void {
  search.value = ''
  filterType.value = 'all'
  filterCategory.value = 'all'
  filterCutoff.value = 'all'
  filterFrom.value = ''
  filterTo.value = ''
}

function openAdd(): void {
  editingId.value = null
  Object.assign(form, emptyForm())
  formError.value = null
  modalOpen.value = true
}

function openEdit(transaction: Transaction): void {
  editingId.value = transaction.id
  Object.assign(form, {
    description: transaction.description,
    amount: String(transaction.amount),
    category_id: transaction.category_id,
    type: transaction.type,
    date: transaction.date,
    notes: transaction.notes ?? '',
  })
  formError.value = null
  modalOpen.value = true
}

function changeType(type: TransactionType): void {
  form.type = type
  form.category_id = defaultCategoryId(type)
}

function validateForm(): boolean {
  formError.value = null

  if (!form.description.trim()) {
    formError.value = 'Description is required.'
    return false
  }
  if (!form.amount || !Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
    formError.value = 'Enter a valid positive amount.'
    return false
  }
  if (!form.date) {
    formError.value = 'Transaction date is required.'
    return false
  }

  const activeCategory = settingsStore.categories.some(
    category => category.id === form.category_id && category.type === form.type,
  )
  const retainedHistoricalCategory = editingTransaction.value?.category_id === form.category_id &&
    editingTransaction.value.type === form.type
  if (!form.category_id || (!activeCategory && !retainedHistoricalCategory)) {
    formError.value = 'Please select a category for this transaction type.'
    return false
  }
  return true
}

async function saveTransaction(): Promise<void> {
  if (!validateForm()) return
  const userId = authStore.user?.id
  if (!userId) {
    formError.value = 'You must be signed in to save a transaction.'
    return
  }

  const payload = {
    description: form.description.trim(),
    amount: Number(form.amount),
    category_id: form.category_id,
    type: form.type,
    date: form.date,
    cutoff_period: deriveCutoffPeriod(
      form.date,
      settingsStore.settings.cutoff1,
      settingsStore.settings.cutoff2,
    ),
    notes: form.notes.trim() || undefined,
  }

  formSaving.value = true
  formError.value = null
  try {
    const result = editingId.value
      ? await store.updateTransaction(editingId.value, payload, userId)
      : await store.addTransaction(payload, userId)

    if (!result.success) {
      formError.value = result.error ?? 'Failed to save transaction.'
      return
    }
    modalOpen.value = false
  } finally {
    formSaving.value = false
  }
}

function requestDelete(transaction: Transaction): void {
  deleteTarget.value = transaction
  deleteError.value = null
}

async function confirmDelete(): Promise<void> {
  const transaction = deleteTarget.value
  const userId = authStore.user?.id
  if (!transaction || !userId) {
    deleteError.value = 'You must be signed in to delete a transaction.'
    return
  }

  deleteSaving.value = true
  deleteError.value = null
  try {
    const result = await store.deleteTransaction(transaction.id, userId)
    if (!result.success) {
      deleteError.value = result.error ?? 'Failed to delete transaction.'
      return
    }
    deleteTarget.value = null
  } finally {
    deleteSaving.value = false
  }
}

function retryLoad(): void {
  const userId = authStore.user?.id
  if (userId && !store.transactionsLoading) void loadUserData(userId)
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-lg font-semibold text-text">Transactions</h1>
        <p class="mt-0.5 text-sm text-text-muted">Track and manage your income and expenses.</p>
      </div>
      <button
        class="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!authStore.user?.id || !store.transactionsLoaded || store.transactionsLoading"
        @click="openAdd"
      >
        <Plus :size="16" aria-hidden="true" />
        Add Transaction
      </button>
    </div>

    <div
      v-if="settingsStore.settingsError"
      class="flex flex-col gap-3 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <div class="flex items-start gap-2">
        <AlertTriangle :size="16" class="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{{ settingsStore.settingsError }}</span>
      </div>
      <button
        class="shrink-0 rounded-md border border-danger-300 px-3 py-1.5 text-xs font-medium hover:bg-danger-100"
        @click="retryLoad"
      >
        Try again
      </button>
    </div>

    <div
      v-if="settingsStore.categoriesError"
      class="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800"
      role="status"
    >
      <AlertTriangle :size="16" class="mt-0.5 shrink-0" aria-hidden="true" />
      <span>Categories could not be loaded: {{ settingsStore.categoriesError }}</span>
    </div>

    <div
      v-if="store.transactionsError"
      class="flex flex-col gap-3 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <div class="flex items-start gap-2">
        <AlertTriangle :size="16" class="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{{ store.transactionsError }}</span>
      </div>
      <button
        class="shrink-0 rounded-md border border-danger-300 px-3 py-1.5 text-xs font-medium hover:bg-danger-100 disabled:opacity-50"
        :disabled="store.transactionsLoading"
        @click="retryLoad"
      >
        Try again
      </button>
    </div>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div class="flex items-start justify-between">
          <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Transactions</p>
          <span class="rounded-full bg-primary-50 p-1.5">
            <CalendarDays :size="14" class="text-primary-600" aria-hidden="true" />
          </span>
        </div>
        <p class="mt-2 text-xl font-bold text-text">{{ filteredTransactions.length }}</p>
      </div>
      <div class="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div class="flex items-start justify-between">
          <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Income</p>
          <span class="rounded-full bg-secondary-50 p-1.5">
            <TrendingUp :size="14" class="text-secondary-600" aria-hidden="true" />
          </span>
        </div>
        <p class="mt-2 text-xl font-bold text-secondary-700">{{ formatPHP(summaryIncome) }}</p>
      </div>
      <div class="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div class="flex items-start justify-between">
          <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Expenses</p>
          <span class="rounded-full bg-danger-50 p-1.5">
            <TrendingDown :size="14" class="text-danger-600" aria-hidden="true" />
          </span>
        </div>
        <p class="mt-2 text-xl font-bold text-danger-700">{{ formatPHP(summaryExpenses) }}</p>
      </div>
      <div
        class="rounded-xl border p-4 shadow-sm"
        :class="summaryNet >= 0 ? 'border-secondary-200 bg-secondary-50' : 'border-danger-200 bg-danger-50'"
      >
        <div class="flex items-start justify-between">
          <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Net</p>
          <span class="rounded-full bg-white/70 p-1.5">
            <Wallet :size="14" :class="summaryNet >= 0 ? 'text-secondary-600' : 'text-danger-600'" aria-hidden="true" />
          </span>
        </div>
        <p class="mt-2 text-xl font-bold" :class="summaryNet >= 0 ? 'text-secondary-700' : 'text-danger-700'">
          {{ formatPHP(summaryNet) }}
        </p>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label class="relative lg:col-span-2">
          <span class="sr-only">Search transactions</span>
          <Search :size="15" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
          <input
            v-model="search"
            type="search"
            placeholder="Search transactions..."
            class="w-full rounded-lg border border-border bg-bg py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </label>

        <label class="relative">
          <span class="sr-only">Filter by category</span>
          <select
            v-model="filterCategory"
            class="w-full appearance-none rounded-lg border border-border bg-bg px-3 py-2 pr-8 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="all">All categories</option>
            <option v-for="category in availableCategories" :key="category" :value="category">{{ category }}</option>
          </select>
          <ChevronDown :size="13" class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
        </label>

        <label class="relative">
          <span class="sr-only">Filter by cutoff period</span>
          <select
            v-model="filterCutoff"
            class="w-full appearance-none rounded-lg border border-border bg-bg px-3 py-2 pr-8 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="all">All periods</option>
            <option value="A">Period A</option>
            <option value="B">Period B</option>
            <option value="C">Period C</option>
          </select>
          <ChevronDown :size="13" class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
        </label>

        <label>
          <span class="sr-only">From date</span>
          <input
            v-model="filterFrom"
            type="date"
            aria-label="From date"
            class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </label>

        <label>
          <span class="sr-only">To date</span>
          <input
            v-model="filterTo"
            type="date"
            aria-label="To date"
            class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </label>
      </div>

      <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div class="flex rounded-lg border border-border bg-bg text-sm">
          <button
            v-for="option in [
              { label: 'All', value: 'all' },
              { label: 'Income', value: 'income' },
              { label: 'Expense', value: 'expense' },
            ]"
            :key="option.value"
            :class="[
              'px-3 py-1.5 font-medium transition-colors first:rounded-l-lg last:rounded-r-lg',
              filterType === option.value ? 'bg-primary-600 text-white' : 'text-text-muted hover:bg-surface-alt',
            ]"
            @click="filterType = option.value as typeof filterType"
          >
            {{ option.label }}
          </button>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-text-muted">
            {{ filteredTransactions.length }} transaction{{ filteredTransactions.length === 1 ? '' : 's' }}
          </span>
          <button
            v-if="search || filterType !== 'all' || filterCategory !== 'all' || filterCutoff !== 'all' || filterFrom || filterTo"
            class="text-xs font-medium text-primary-600 hover:text-primary-700"
            @click="resetFilters"
          >
            Clear filters
          </button>
        </div>
      </div>
    </div>

    <div v-if="store.transactionsLoading && !store.transactionsLoaded" class="space-y-2 rounded-xl border border-border bg-surface p-5" aria-busy="true">
      <div v-for="row in 5" :key="row" class="h-12 animate-pulse rounded-lg bg-surface-alt" />
      <span class="sr-only">Loading transactions...</span>
    </div>
    <div v-else-if="store.transactionsLoading" class="text-xs text-text-muted" role="status">
      Refreshing transactions...
    </div>

    <div
      v-if="!store.transactionsLoading || store.transactionsLoaded"
      class="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
    >
      <div v-if="filteredTransactions.length === 0" class="flex flex-col items-center justify-center px-5 py-16 text-center">
        <div class="mb-3 rounded-full bg-surface-alt p-4">
          <Search :size="22" class="text-text-subtle" aria-hidden="true" />
        </div>
        <p class="text-sm font-medium text-text">
          {{ store.items.length === 0 ? 'No transactions yet' : 'No matching transactions' }}
        </p>
        <p class="mt-1 text-xs text-text-muted">
          {{ store.items.length === 0 ? 'Add an income or expense transaction to get started.' : 'Try changing your search or filters.' }}
        </p>
        <button
          v-if="store.items.length === 0 && store.transactionsLoaded"
          class="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          @click="openAdd"
        >
          <Plus :size="14" aria-hidden="true" />
          Add Transaction
        </button>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[800px] text-sm">
          <thead>
            <tr class="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
              <th class="px-5 py-3">Description</th>
              <th class="px-4 py-3">Category</th>
              <th class="px-4 py-3">Date</th>
              <th class="px-4 py-3">Period</th>
              <th class="px-4 py-3 text-right">Amount</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="transaction in filteredTransactions" :key="transaction.id" class="hover:bg-surface-alt">
              <td class="max-w-64 px-5 py-3">
                <p class="truncate font-medium text-text">{{ transaction.description }}</p>
                <p v-if="transaction.notes" class="mt-0.5 truncate text-xs text-text-subtle">{{ transaction.notes }}</p>
              </td>
              <td class="px-4 py-3 text-text-muted">{{ transaction.category || 'Uncategorized' }}</td>
              <td class="whitespace-nowrap px-4 py-3 text-text-muted">{{ formatDate(transaction.date) }}</td>
              <td class="px-4 py-3">
                <span class="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                  Period {{ transaction.cutoff_period }}
                </span>
              </td>
              <td
                class="whitespace-nowrap px-4 py-3 text-right font-semibold"
                :class="transaction.type === 'income' ? 'text-secondary-600' : 'text-danger-600'"
              >
                {{ transaction.type === 'income' ? '+' : '−' }}{{ formatPHP(transaction.amount) }}
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-1">
                  <button
                    class="rounded-md p-2 text-text-muted transition-colors hover:bg-primary-50 hover:text-primary-600"
                    :aria-label="`Edit ${transaction.description}`"
                    title="Edit transaction"
                    @click="openEdit(transaction)"
                  >
                    <Pencil :size="15" aria-hidden="true" />
                  </button>
                  <button
                    class="rounded-md p-2 text-text-muted transition-colors hover:bg-danger-50 hover:text-danger-600"
                    :aria-label="`Delete ${transaction.description}`"
                    title="Delete transaction"
                    @click="requestDelete(transaction)"
                  >
                    <Trash2 :size="15" aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="modalOpen" class="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
      <section
        class="my-auto w-full max-w-lg rounded-2xl border border-border bg-surface shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-modal-title"
      >
        <div class="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="transaction-modal-title" class="text-base font-semibold text-text">
            {{ editingId ? 'Edit Transaction' : 'Add Transaction' }}
          </h2>
          <button
            class="rounded-md p-1.5 text-text-muted hover:bg-surface-alt"
            aria-label="Close dialog"
            @click="modalOpen = false"
          >
            <X :size="18" aria-hidden="true" />
          </button>
        </div>

        <form class="space-y-4 p-5" @submit.prevent="saveTransaction">
          <div class="grid grid-cols-2 gap-2 rounded-lg bg-surface-alt p-1">
            <button
              type="button"
              :class="[
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                form.type === 'expense' ? 'bg-white text-danger-700 shadow-sm' : 'text-text-muted hover:text-text',
              ]"
              @click="changeType('expense')"
            >
              Expense
            </button>
            <button
              type="button"
              :class="[
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                form.type === 'income' ? 'bg-white text-secondary-700 shadow-sm' : 'text-text-muted hover:text-text',
              ]"
              @click="changeType('income')"
            >
              Income
            </button>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-text-muted" for="transaction-description">Description</label>
            <input
              id="transaction-description"
              v-model="form.description"
              type="text"
              maxlength="120"
              autofocus
              placeholder="e.g. Monthly salary"
              class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs font-medium text-text-muted" for="transaction-amount">Amount</label>
              <input
                id="transaction-amount"
                v-model="form.amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-text-muted" for="transaction-date">Date</label>
              <input
                id="transaction-date"
                v-model="form.date"
                type="date"
                class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-text-muted" for="transaction-category">Category</label>
            <div class="relative">
              <select
                id="transaction-category"
                v-model="form.category_id"
                :disabled="settingsStore.categoriesLoading"
                class="w-full appearance-none rounded-lg border border-border bg-bg px-3 py-2 pr-8 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-60"
              >
                <option value="" disabled>
                  {{ settingsStore.categoriesLoading ? 'Loading categories...' : 'Select category...' }}
                </option>
                <option v-for="category in formCategories" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </select>
              <ChevronDown :size="13" class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
            </div>
            <p v-if="!settingsStore.categoriesLoading && formCategories.length === 0" class="mt-1 text-xs text-text-muted">
              No {{ form.type }} categories are available.
            </p>
          </div>

          <div class="flex items-center gap-2 rounded-lg bg-surface-alt px-3 py-2 text-xs text-text-muted">
            <CalendarDays :size="14" class="text-primary-500" aria-hidden="true" />
            <span>
              Cutoff period:
              <strong class="font-semibold text-text">
                {{ previewCutoff ? `Period ${previewCutoff}` : 'Select a date' }}
              </strong>
            </span>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-text-muted" for="transaction-notes">
              Notes <span class="text-text-subtle">(optional)</span>
            </label>
            <textarea
              id="transaction-notes"
              v-model="form.notes"
              rows="3"
              maxlength="500"
              placeholder="Add additional details..."
              class="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          <p v-if="formError" class="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700" role="alert">
            {{ formError }}
          </p>

          <div class="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              class="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-alt"
              :disabled="formSaving"
              @click="modalOpen = false"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="formSaving || !store.transactionsLoaded || store.transactionsLoading"
            >
              <Check :size="14" aria-hidden="true" />
              {{ formSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Transaction' }}
            </button>
          </div>
        </form>
      </section>
    </div>

    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section
        class="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-transaction-title"
      >
        <div class="mb-3 flex items-start gap-3">
          <span class="rounded-full bg-danger-50 p-2 text-danger-600">
            <AlertTriangle :size="18" aria-hidden="true" />
          </span>
          <div>
            <h2 id="delete-transaction-title" class="text-sm font-semibold text-text">Delete transaction?</h2>
            <p class="mt-1 text-xs text-text-muted">
              “{{ deleteTarget.description }}” will be permanently deleted.
            </p>
          </div>
        </div>
        <p v-if="deleteError" class="mb-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700" role="alert">
          {{ deleteError }}
        </p>
        <div class="flex justify-end gap-2">
          <button
            class="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface-alt"
            :disabled="deleteSaving"
            @click="deleteTarget = null"
          >
            Cancel
          </button>
          <button
            class="rounded-lg bg-danger-600 px-3 py-2 text-sm font-medium text-white hover:bg-danger-700 disabled:opacity-50"
            :disabled="deleteSaving || store.transactionsLoading"
            @click="confirmDelete"
          >
            {{ deleteSaving ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
``` пат