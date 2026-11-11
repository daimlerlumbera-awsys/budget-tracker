<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import {
  Plus, Pencil, Trash2, X, Check,
  ArrowUpRight, ArrowDownRight, Search, ChevronDown,
} from 'lucide-vue-next'
import { useTransactionStore, useSettingsStore, formatCurrency, type Transaction, type Cutoff } from '@/stores/counter'

const store    = useTransactionStore()
const settings = useSettingsStore()

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------
const search       = ref('')
const filterType   = ref<'all' | 'income' | 'expense'>('all')
const filterCat    = ref<string>('all')
const filterCutoff = ref<Cutoff | 'all'>('all')
const filterFrom   = ref('')
const filterTo     = ref('')

const months = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' },   { value: 4, label: 'April' },
  { value: 5, label: 'May' },     { value: 6, label: 'June' },
  { value: 7, label: 'July' },    { value: 8, label: 'August' },
  { value: 9, label: 'September'},{ value: 10, label: 'October' },
  { value: 11, label: 'November'},{ value: 12, label: 'December' },
]

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return store.items
    .filter(t => {
      if (filterType.value !== 'all' && t.type !== filterType.value) return false
      if (filterCat.value !== 'all' && t.category !== filterCat.value) return false
      if (filterCutoff.value !== 'all' && t.cutoff !== filterCutoff.value) return false
      if (filterFrom.value && t.date < filterFrom.value) return false
      if (filterTo.value   && t.date > filterTo.value)   return false
      if (q && !t.description.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q)) return false
      return true
    })
    .sort((a, b) => b.date.localeCompare(a.date))
})

const summaryIncome   = computed(() => filtered.value.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))
const summaryExpenses = computed(() => filtered.value.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))
const summaryNet      = computed(() => summaryIncome.value - summaryExpenses.value)

function resetFilters() {
  search.value       = ''
  filterType.value   = 'all'
  filterCat.value    = 'all'
  filterCutoff.value = 'all'
  filterFrom.value   = ''
  filterTo.value     = ''
}

// ---------------------------------------------------------------------------
// Add / Edit modal
// ---------------------------------------------------------------------------
type FormType = 'income' | 'expense'

interface TxForm {
  description: string
  amount: string
  category: string
  type: FormType
  date: string
  cutoff: Cutoff
  month: number
  year: number
  notes: string
}

const modalOpen = ref(false)
const editingId = ref<string | null>(null)

function emptyForm(): TxForm {
  const today = new Date()
  return {
    description: '',
    amount:      '',
    category:    'Food',
    type:        'expense',
    date:        today.toISOString().slice(0, 10),
    cutoff:      15,
    month:       today.getMonth() + 1,
    year:        today.getFullYear(),
    notes:       '',
  }
}

const form       = reactive<TxForm>(emptyForm())
const formErrors = reactive({ description: '', amount: '' })

function openAdd() {
  editingId.value = null
  Object.assign(form, emptyForm())
  clearErrors()
  modalOpen.value = true
}

function openEdit(tx: Transaction) {
  editingId.value = tx.id
  Object.assign(form, {
    description: tx.description,
    amount:      String(tx.amount),
    category:    tx.category,
    type:        tx.type,
    date:        tx.date,
    cutoff:      tx.cutoff,
    month:       tx.month,
    year:        tx.year,
    notes:       tx.notes ?? '',
  })
  clearErrors()
  modalOpen.value = true
}

function clearErrors() {
  formErrors.description = ''
  formErrors.amount      = ''
}

function validate(): boolean {
  clearErrors()
  let ok = true
  if (!form.description.trim())                              { formErrors.description = 'Description is required.'; ok = false }
  if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) { formErrors.amount = 'Enter a valid positive amount.'; ok = false }
  return ok
}

function saveForm() {
  if (!validate()) return

  const payload: Omit<Transaction, 'id'> = {
    description: form.description.trim(),
    amount:      Number(form.amount),
    category:    form.category,
    type:        form.type,
    date:        form.date,
    cutoff:      form.cutoff,
    month:       form.month,
    year:        form.year,
    notes:       form.notes.trim() || undefined,
  }

  if (editingId.value) {
    store.update(editingId.value, payload)
  } else {
    store.add(payload)
  }
  modalOpen.value = false
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------
const deleteTarget = ref<Transaction | null>(null)

function confirmDelete(tx: Transaction) { deleteTarget.value = tx }

function executeDelete() {
  if (!deleteTarget.value) return
  store.remove(deleteTarget.value.id)
  deleteTarget.value = null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatPHP(value: number) {
  return formatCurrency(value, settings.settings.currency)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const expenseCategories = computed(() => settings.expenseCategories)
</script>

<template>
  <div class="space-y-5">

    <!-- Summary cards -->
    <div class="grid grid-cols-3 gap-4">
      <div class="rounded-xl bg-surface border border-border p-4 shadow-sm">
        <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Income</p>
        <p class="mt-1 text-xl font-bold text-secondary-600">{{ formatPHP(summaryIncome) }}</p>
      </div>
      <div class="rounded-xl bg-surface border border-border p-4 shadow-sm">
        <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Expenses</p>
        <p class="mt-1 text-xl font-bold text-danger-600">{{ formatPHP(summaryExpenses) }}</p>
      </div>
      <div class="rounded-xl border p-4 shadow-sm"
           :class="summaryNet >= 0 ? 'bg-secondary-50 border-secondary-200' : 'bg-danger-50 border-danger-200'">
        <p class="text-xs font-medium uppercase tracking-wide"
           :class="summaryNet >= 0 ? 'text-secondary-700' : 'text-danger-700'">Net</p>
        <p class="mt-1 text-xl font-bold"
           :class="summaryNet >= 0 ? 'text-secondary-700' : 'text-danger-700'">
          {{ summaryNet >= 0 ? '+' : '' }}{{ formatPHP(summaryNet) }}
        </p>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="rounded-xl bg-surface border border-border shadow-sm p-4 space-y-3">
      <!-- Row 1: search + add -->
      <div class="flex flex-wrap items-center gap-3">
        <!-- Search -->
        <div class="relative flex-1 min-w-48">
          <Search :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
          <input
            v-model="search"
            type="text"
            placeholder="Search transactions…"
            class="w-full rounded-lg border border-border bg-bg pl-9 pr-3 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <!-- Add -->
        <button
          class="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400"
          @click="openAdd"
        >
          <Plus :size="15" aria-hidden="true" />
          Add Transaction
        </button>
      </div>

      <!-- Row 2: filters -->
      <div class="flex flex-wrap items-center gap-2">

        <!-- Type toggle -->
        <div class="flex rounded-lg border border-border bg-bg overflow-hidden text-sm">
          <button
            v-for="opt in [{ label: 'All', value: 'all' }, { label: 'Income', value: 'income' }, { label: 'Expense', value: 'expense' }]"
            :key="opt.value"
            :class="[
              'px-3 py-1.5 font-medium transition-colors',
              filterType === opt.value ? 'bg-primary-600 text-white' : 'text-text-muted hover:bg-surface-alt',
            ]"
            @click="filterType = opt.value as typeof filterType"
          >{{ opt.label }}</button>
        </div>

        <!-- Cutoff toggle -->
        <div class="flex rounded-lg border border-border bg-bg overflow-hidden text-sm">
          <button
            v-for="opt in [{ label: 'All', value: 'all' }, { label: '15th', value: 15 }, { label: '30th', value: 30 }]"
            :key="opt.label"
            :class="[
              'px-3 py-1.5 font-medium transition-colors',
              filterCutoff === opt.value ? 'bg-primary-600 text-white' : 'text-text-muted hover:bg-surface-alt',
            ]"
            @click="filterCutoff = opt.value as typeof filterCutoff"
          >{{ opt.label }}</button>
        </div>

        <!-- Category -->
        <div class="relative">
          <select
            v-model="filterCat"
            class="appearance-none rounded-lg border border-border bg-bg px-3 py-1.5 pr-7 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="all">All categories</option>
            <option v-for="c in settings.categories" :key="c" :value="c">{{ c }}</option>
          </select>
          <ChevronDown :size="12" class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
        </div>

        <!-- Date range -->
        <input
          v-model="filterFrom"
          type="date"
          class="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <span class="text-text-subtle text-xs">to</span>
        <input
          v-model="filterTo"
          type="date"
          class="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
        />

        <!-- Reset -->
        <button
          class="text-xs text-primary-600 hover:underline"
          @click="resetFilters"
        >Reset</button>
      </div>
    </div>

    <!-- Results count -->
    <p class="text-xs text-text-muted px-1">
      {{ filtered.length }} transaction{{ filtered.length !== 1 ? 's' : '' }}
    </p>

    <!-- Table -->
    <div class="rounded-xl bg-surface border border-border shadow-sm overflow-hidden">

      <!-- Empty state -->
      <div v-if="filtered.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
        <div class="mb-3 rounded-full bg-surface-alt p-4">
          <Search :size="22" class="text-text-subtle" aria-hidden="true" />
        </div>
        <p class="text-sm font-medium text-text">No transactions found</p>
        <p class="mt-1 text-xs text-text-muted">Try adjusting your filters or add a new transaction.</p>
        <button
          class="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          @click="openAdd"
        >
          <Plus :size="14" aria-hidden="true" /> Add Transaction
        </button>
      </div>

      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-border bg-surface-alt text-xs font-semibold uppercase tracking-wide text-text-muted">
            <th class="px-5 py-3 text-left">Date</th>
            <th class="px-4 py-3 text-left">Description</th>
            <th class="px-4 py-3 text-left hidden sm:table-cell">Category</th>
            <th class="px-4 py-3 text-left hidden md:table-cell">Cutoff</th>
            <th class="px-4 py-3 text-right">Amount</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr
            v-for="tx in filtered"
            :key="tx.id"
            class="hover:bg-surface-alt transition-colors"
          >
            <td class="px-5 py-3 text-text-muted whitespace-nowrap">{{ formatDate(tx.date) }}</td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2.5">
                <span
                  :class="[
                    'shrink-0 flex h-6 w-6 items-center justify-center rounded-full',
                    tx.type === 'income' ? 'bg-secondary-50' : 'bg-danger-50',
                  ]"
                >
                  <ArrowUpRight v-if="tx.type === 'income'" :size="12" class="text-secondary-600" aria-hidden="true" />
                  <ArrowDownRight v-else :size="12" class="text-danger-600" aria-hidden="true" />
                </span>
                <div>
                  <p class="font-medium text-text">{{ tx.description }}</p>
                  <p v-if="tx.notes" class="text-xs text-text-subtle truncate max-w-48">{{ tx.notes }}</p>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 hidden sm:table-cell">
              <span class="rounded-full bg-surface-alt px-2 py-0.5 text-xs font-medium text-text-muted border border-border">
                {{ tx.category }}
              </span>
            </td>
            <td class="px-4 py-3 text-text-muted hidden md:table-cell">
              <span class="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                {{ tx.cutoff }}th
              </span>
            </td>
            <td class="px-4 py-3 text-right font-semibold whitespace-nowrap"
                :class="tx.type === 'income' ? 'text-secondary-600' : 'text-danger-600'">
              {{ tx.type === 'income' ? '+' : '−' }}{{ formatPHP(tx.amount) }}
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-1">
                <button
                  class="rounded-md p-1.5 text-text-subtle hover:bg-primary-50 hover:text-primary-600 transition-colors"
                  aria-label="Edit transaction"
                  @click="openEdit(tx)"
                >
                  <Pencil :size="13" aria-hidden="true" />
                </button>
                <button
                  class="rounded-md p-1.5 text-text-subtle hover:bg-danger-50 hover:text-danger-600 transition-colors"
                  aria-label="Delete transaction"
                  @click="confirmDelete(tx)"
                >
                  <Trash2 :size="13" aria-hidden="true" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ------------------------------------------------------------------ -->
    <!-- Add / Edit modal                                                    -->
    <!-- ------------------------------------------------------------------ -->
    <Transition name="fade">
      <div
        v-if="modalOpen"
        class="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/40 p-4"
        @click.self="modalOpen = false"
      >
        <div class="w-full max-w-lg rounded-2xl bg-surface shadow-xl border border-border max-h-[90vh] overflow-y-auto">
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-border px-6 py-4 sticky top-0 bg-surface z-10">
            <h2 class="text-base font-semibold text-text">
              {{ editingId ? 'Edit Transaction' : 'Add Transaction' }}
            </h2>
            <button
              class="rounded-md p-1.5 text-text-subtle hover:bg-surface-alt transition-colors"
              aria-label="Close"
              @click="modalOpen = false"
            >
              <X :size="18" aria-hidden="true" />
            </button>
          </div>

          <!-- Form -->
          <form class="space-y-4 px-6 py-5" @submit.prevent="saveForm">

            <!-- Type toggle -->
            <div>
              <p class="mb-1.5 text-xs font-medium text-text-muted">Type</p>
              <div class="flex rounded-lg border border-border overflow-hidden text-sm">
                <button
                  type="button"
                  :class="[
                    'flex-1 py-2 font-medium transition-colors',
                    form.type === 'expense' ? 'bg-danger-600 text-white' : 'text-text-muted hover:bg-surface-alt',
                  ]"
                  @click="form.type = 'expense'; form.category = 'Food'"
                >Expense</button>
                <button
                  type="button"
                  :class="[
                    'flex-1 py-2 font-medium transition-colors',
                    form.type === 'income' ? 'bg-secondary-600 text-white' : 'text-text-muted hover:bg-surface-alt',
                  ]"
                  @click="form.type = 'income'; form.category = 'Income'"
                >Income</button>
              </div>
            </div>

            <!-- Description -->
            <div>
              <label class="mb-1 block text-xs font-medium text-text-muted" for="tx-desc">Description</label>
              <input
                id="tx-desc"
                v-model="form.description"
                type="text"
                placeholder="e.g. Grocery run"
                :class="[
                  'w-full rounded-lg border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary-400',
                  formErrors.description ? 'border-danger-400 bg-danger-50' : 'border-border bg-surface',
                ]"
              />
              <p v-if="formErrors.description" class="mt-1 text-xs text-danger-600">{{ formErrors.description }}</p>
            </div>

            <!-- Amount -->
            <div>
              <label class="mb-1 block text-xs font-medium text-text-muted" for="tx-amount">Amount (₱)</label>
              <input
                id="tx-amount"
                v-model="form.amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                :class="[
                  'w-full rounded-lg border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary-400',
                  formErrors.amount ? 'border-danger-400 bg-danger-50' : 'border-border bg-surface',
                ]"
              />
              <p v-if="formErrors.amount" class="mt-1 text-xs text-danger-600">{{ formErrors.amount }}</p>
            </div>

            <!-- Category -->
            <div>
              <label class="mb-1 block text-xs font-medium text-text-muted" for="tx-cat">Category</label>
              <div class="relative">
                <select
                  id="tx-cat"
                  v-model="form.category"
                  class="w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2 pr-7 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  <option v-if="form.type === 'income'" value="Income">Income</option>
                  <option v-for="c in expenseCategories" :key="c" :value="c">{{ c }}</option>
                </select>
                <ChevronDown :size="12" class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
              </div>
            </div>

            <!-- Date -->
            <div>
              <label class="mb-1 block text-xs font-medium text-text-muted" for="tx-date">Date</label>
              <input
                id="tx-date"
                v-model="form.date"
                type="date"
                class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            <!-- Cutoff / Month / Year -->
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="mb-1 block text-xs font-medium text-text-muted" for="tx-cutoff">Cutoff</label>
                <div class="relative">
                  <select id="tx-cutoff" v-model.number="form.cutoff"
                    class="w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2 pr-7 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400">
                    <option :value="15">15th</option>
                    <option :value="30">30th</option>
                  </select>
                  <ChevronDown :size="12" class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
                </div>
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-text-muted" for="tx-month">Month</label>
                <div class="relative">
                  <select id="tx-month" v-model.number="form.month"
                    class="w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2 pr-7 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400">
                    <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label.slice(0, 3) }}</option>
                  </select>
                  <ChevronDown :size="12" class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
                </div>
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-text-muted" for="tx-year">Year</label>
                <div class="relative">
                  <select id="tx-year" v-model.number="form.year"
                    class="w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2 pr-7 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400">
                    <option :value="2025">2025</option>
                    <option :value="2026">2026</option>
                    <option :value="2027">2027</option>
                  </select>
                  <ChevronDown :size="12" class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
                </div>
              </div>
            </div>

            <!-- Notes -->
            <div>
              <label class="mb-1 block text-xs font-medium text-text-muted" for="tx-notes">
                Notes <span class="text-text-subtle">(optional)</span>
              </label>
              <textarea
                id="tx-notes"
                v-model="form.notes"
                rows="2"
                placeholder="Any additional details…"
                class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
              />
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-3 pt-1">
              <button type="button"
                class="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-alt transition-colors"
                @click="modalOpen = false">Cancel</button>
              <button type="submit"
                class="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400">
                <Check :size="14" aria-hidden="true" />
                {{ editingId ? 'Save Changes' : 'Add Transaction' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- ------------------------------------------------------------------ -->
    <!-- Delete confirmation                                                 -->
    <!-- ------------------------------------------------------------------ -->
    <Transition name="fade">
      <div
        v-if="deleteTarget"
        class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4"
        @click.self="deleteTarget = null"
      >
        <div class="w-full max-w-sm rounded-2xl bg-surface shadow-xl border border-border p-6">
          <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-danger-50">
            <Trash2 :size="20" class="text-danger-600" aria-hidden="true" />
          </div>
          <h2 class="text-base font-semibold text-text">Delete Transaction?</h2>
          <p class="mt-1 text-sm text-text-muted">
            <strong>{{ deleteTarget?.description }}</strong> ({{ deleteTarget ? formatPHP(deleteTarget.amount) : '' }}) will be permanently removed.
          </p>
          <div class="mt-5 flex justify-end gap-3">
            <button
              class="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-alt transition-colors"
              @click="deleteTarget = null"
            >Cancel</button>
            <button
              class="rounded-lg bg-danger-600 px-4 py-2 text-sm font-medium text-white hover:bg-danger-700 transition-colors"
              @click="executeDelete"
            >Delete</button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }
</style>
