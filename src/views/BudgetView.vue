<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { Plus, Pencil, Trash2, X, Check, ChevronDown } from 'lucide-vue-next'
import {
  useBudgetStore, useSettingsStore,
  formatCurrency,
  type BudgetItem, type Cutoff,
} from '@/stores/counter'

const budgetStore   = useBudgetStore()
const settingsStore = useSettingsStore()

// ---------------------------------------------------------------------------
// Form type (string inputs parsed on save)
// ---------------------------------------------------------------------------
interface BudgetForm {
  category: string
  planned: string
  actual: string
  cutoff: Cutoff
  month: number
  year: number
}

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------
const filterCutoff = ref<Cutoff | 'all'>('all')
const filterMonth  = ref<number>(11)
const filterYear   = ref<number>(2026)

const months = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' },   { value: 4, label: 'April' },
  { value: 5, label: 'May' },     { value: 6, label: 'June' },
  { value: 7, label: 'July' },    { value: 8, label: 'August' },
  { value: 9, label: 'September'},{ value: 10, label: 'October' },
  { value: 11, label: 'November'},{ value: 12, label: 'December' },
]

const filteredItems = computed(() =>
  budgetStore.items.filter(i =>
    i.month === filterMonth.value &&
    i.year  === filterYear.value &&
    (filterCutoff.value === 'all' || i.cutoff === filterCutoff.value)
  )
)

const totalPlanned = computed(() => filteredItems.value.reduce((s, i) => s + i.planned, 0))
const totalActual  = computed(() => filteredItems.value.reduce((s, i) => s + i.actual, 0))

function remaining(item: BudgetItem) { return item.planned - item.actual }

// ---------------------------------------------------------------------------
// Add / Edit modal
// ---------------------------------------------------------------------------
const modalOpen    = ref(false)
const editingId    = ref<string | null>(null)

const emptyForm = (): BudgetForm => ({
  category: settingsStore.expenseCategories[0] ?? '',
  planned:  '',
  actual:   '',
  cutoff:   15,
  month:    filterMonth.value,
  year:     filterYear.value,
})

const form = reactive<BudgetForm>(emptyForm())
const formErrors = reactive({ category: '', planned: '', actual: '' })

function openAdd() {
  editingId.value = null
  Object.assign(form, emptyForm())
  clearErrors()
  modalOpen.value = true
}

function openEdit(item: BudgetItem) {
  editingId.value = item.id
  Object.assign(form, {
    category: item.category,
    planned:  String(item.planned),
    actual:   String(item.actual),
    cutoff:   item.cutoff,
    month:    item.month,
    year:     item.year,
  })
  clearErrors()
  modalOpen.value = true
}

function clearErrors() {
  formErrors.category = ''
  formErrors.planned  = ''
  formErrors.actual   = ''
}

function validate(): boolean {
  clearErrors()
  let ok = true
  if (!form.category.trim()) { formErrors.category = 'Category is required.'; ok = false }
  if (!form.planned || isNaN(Number(form.planned)) || Number(form.planned) < 0) {
    formErrors.planned = 'Enter a valid amount.'; ok = false
  }
  if (form.actual !== '' && (isNaN(Number(form.actual)) || Number(form.actual) < 0)) {
    formErrors.actual = 'Enter a valid amount.'; ok = false
  }
  return ok
}

function saveForm() {
  if (!validate()) return

  const payload: Omit<BudgetItem, 'id'> = {
    category: form.category.trim(),
    planned:  Number(form.planned),
    actual:   form.actual === '' ? 0 : Number(form.actual),
    cutoff:   form.cutoff,
    month:    form.month,
    year:     form.year,
  }

  if (editingId.value) {
    budgetStore.update(editingId.value, payload)
  } else {
    budgetStore.add(payload)
  }
  modalOpen.value = false
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------
const deleteTarget = ref<BudgetItem | null>(null)

function confirmDelete(item: BudgetItem) { deleteTarget.value = item }

function executeDelete() {
  if (!deleteTarget.value) return
  budgetStore.remove(deleteTarget.value.id)
  deleteTarget.value = null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPHP(value: number) {
  return formatCurrency(value, settingsStore.settings.currency)
}

function usagePct(item: BudgetItem) {
  if (item.planned === 0) return 0
  return Math.min(Math.round((item.actual / item.planned) * 100), 100)
}

function usageColor(pct: number) {
  if (pct >= 100) return 'bg-danger-500'
  if (pct >= 80)  return 'bg-warning-500'
  return 'bg-secondary-500'
}

function remainingColor(item: BudgetItem) {
  const r = remaining(item)
  if (r < 0)  return 'text-danger-600'
  if (r === 0) return 'text-text-muted'
  return 'text-secondary-600'
}

</script>

<template>
  <div class="space-y-6">

    <!-- Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- Month -->
        <div class="relative">
          <select
            v-model.number="filterMonth"
            class="appearance-none rounded-lg border border-border bg-surface px-3 py-2 pr-8 text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
          <ChevronDown :size="14" class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
        </div>

        <!-- Year -->
        <div class="relative">
          <select
            v-model.number="filterYear"
            class="appearance-none rounded-lg border border-border bg-surface px-3 py-2 pr-8 text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option :value="2025">2025</option>
            <option :value="2026">2026</option>
            <option :value="2027">2027</option>
          </select>
          <ChevronDown :size="14" class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
        </div>

        <!-- Cutoff -->
        <div class="flex rounded-lg border border-border bg-surface shadow-sm overflow-hidden text-sm">
          <button
            v-for="opt in [{ label: 'All', value: 'all' }, { label: '15th', value: 15 }, { label: '30th', value: 30 }]"
            :key="opt.label"
            :class="[
              'px-3 py-2 font-medium transition-colors',
              filterCutoff === opt.value
                ? 'bg-primary-600 text-white'
                : 'text-text-muted hover:bg-surface-alt',
            ]"
            @click="filterCutoff = opt.value as typeof filterCutoff"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Add button -->
      <button
        class="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400"
        @click="openAdd"
      >
        <Plus :size="16" aria-hidden="true" />
        Add Budget Item
      </button>
    </div>

    <!-- Summary row -->
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <div class="rounded-xl bg-surface border border-border p-4 shadow-sm">
        <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Total Planned</p>
        <p class="mt-1 text-xl font-bold text-text">{{ formatPHP(totalPlanned) }}</p>
      </div>
      <div class="rounded-xl bg-surface border border-border p-4 shadow-sm">
        <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Total Actual</p>
        <p class="mt-1 text-xl font-bold text-text">{{ formatPHP(totalActual) }}</p>
      </div>
      <div class="rounded-xl border p-4 shadow-sm col-span-2 sm:col-span-1"
           :class="totalPlanned - totalActual >= 0 ? 'bg-secondary-50 border-secondary-200' : 'bg-danger-50 border-danger-200'">
        <p class="text-xs font-medium uppercase tracking-wide"
           :class="totalPlanned - totalActual >= 0 ? 'text-secondary-700' : 'text-danger-700'">Remaining</p>
        <p class="mt-1 text-xl font-bold"
           :class="totalPlanned - totalActual >= 0 ? 'text-secondary-700' : 'text-danger-700'">
          {{ formatPHP(totalPlanned - totalActual) }}
        </p>
      </div>
    </div>

    <!-- Budget table -->
    <div class="rounded-xl bg-surface border border-border shadow-sm overflow-hidden">

      <!-- Empty state -->
      <div v-if="filteredItems.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
        <div class="mb-3 rounded-full bg-surface-alt p-4">
          <Plus :size="24" class="text-text-subtle" aria-hidden="true" />
        </div>
        <p class="text-sm font-medium text-text">No budget items</p>
        <p class="mt-1 text-xs text-text-muted">Add a budget item to get started.</p>
        <button
          class="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          @click="openAdd"
        >
          <Plus :size="14" aria-hidden="true" /> Add Budget Item
        </button>
      </div>

      <!-- Table -->
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-border bg-surface-alt text-xs font-semibold uppercase tracking-wide text-text-muted">
            <th class="px-5 py-3 text-left">Category</th>
            <th class="px-4 py-3 text-left hidden sm:table-cell">Cutoff</th>
            <th class="px-4 py-3 text-right">Planned</th>
            <th class="px-4 py-3 text-right">Actual</th>
            <th class="px-4 py-3 text-right">Remaining</th>
            <th class="px-4 py-3 text-left hidden md:table-cell">Usage</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr
            v-for="item in filteredItems"
            :key="item.id"
            class="hover:bg-surface-alt transition-colors"
          >
            <td class="px-5 py-3 font-medium text-text">{{ item.category }}</td>
            <td class="px-4 py-3 text-text-muted hidden sm:table-cell">
              <span class="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                {{ item.cutoff }}th
              </span>
            </td>
            <td class="px-4 py-3 text-right text-text-muted">{{ formatPHP(item.planned) }}</td>
            <td class="px-4 py-3 text-right font-medium text-text">{{ formatPHP(item.actual) }}</td>
            <td class="px-4 py-3 text-right font-semibold" :class="remainingColor(item)">
              {{ formatPHP(remaining(item)) }}
            </td>
            <td class="px-4 py-3 hidden md:table-cell">
              <div class="flex items-center gap-2">
                <div class="h-1.5 w-24 rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    :class="['h-full rounded-full', usageColor(usagePct(item))]"
                    :style="{ width: usagePct(item) + '%' }"
                  />
                </div>
                <span class="text-xs text-text-muted w-8">{{ usagePct(item) }}%</span>
              </div>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-1">
                <button
                  class="rounded-md p-1.5 text-text-subtle hover:bg-primary-50 hover:text-primary-600 transition-colors"
                  aria-label="Edit"
                  @click="openEdit(item)"
                >
                  <Pencil :size="14" aria-hidden="true" />
                </button>
                <button
                  class="rounded-md p-1.5 text-text-subtle hover:bg-danger-50 hover:text-danger-600 transition-colors"
                  aria-label="Delete"
                  @click="confirmDelete(item)"
                >
                  <Trash2 :size="14" aria-hidden="true" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t border-border bg-surface-alt text-sm font-semibold">
            <td class="px-5 py-3 text-text" colspan="2">Total</td>
            <td class="px-4 py-3 text-right text-text-muted">{{ formatPHP(totalPlanned) }}</td>
            <td class="px-4 py-3 text-right text-text">{{ formatPHP(totalActual) }}</td>
            <td class="px-4 py-3 text-right"
                :class="totalPlanned - totalActual >= 0 ? 'text-secondary-600' : 'text-danger-600'">
              {{ formatPHP(totalPlanned - totalActual) }}
            </td>
            <td class="hidden md:table-cell" colspan="2" />
          </tr>
        </tfoot>
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
        <div class="w-full max-w-md rounded-2xl bg-surface shadow-xl border border-border">
          <!-- Modal header -->
          <div class="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 class="text-base font-semibold text-text">
              {{ editingId ? 'Edit Budget Item' : 'Add Budget Item' }}
            </h2>
            <button
              class="rounded-md p-1.5 text-text-subtle hover:bg-surface-alt hover:text-text transition-colors"
              aria-label="Close"
              @click="modalOpen = false"
            >
              <X :size="18" aria-hidden="true" />
            </button>
          </div>

          <!-- Form -->
          <form class="space-y-4 px-6 py-5" @submit.prevent="saveForm">

            <!-- Category -->
            <div>
              <label class="mb-1 block text-xs font-medium text-text-muted" for="f-category">Category</label>
              <div class="relative">
                <select
                  id="f-category"
                  v-model="form.category"
                  :class="[
                    'w-full appearance-none rounded-lg border px-3 py-2 pr-8 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400',
                    formErrors.category ? 'border-danger-400 bg-danger-50' : 'border-border bg-surface',
                  ]"
                >
                  <option value="" disabled>Select category…</option>
                  <option v-for="c in settingsStore.expenseCategories" :key="c" :value="c">{{ c }}</option>
                </select>
                <ChevronDown :size="12" class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
              </div>
              <p v-if="formErrors.category" class="mt-1 text-xs text-danger-600">{{ formErrors.category }}</p>
            </div>

            <!-- Planned -->
            <div>
              <label class="mb-1 block text-xs font-medium text-text-muted" for="f-planned">Planned Amount (₱)</label>
              <input
                id="f-planned"
                v-model="form.planned"
                type="number"
                min="0"
                placeholder="0"
                :class="[
                  'w-full rounded-lg border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary-400',
                  formErrors.planned ? 'border-danger-400 bg-danger-50' : 'border-border bg-surface',
                ]"
              />
              <p v-if="formErrors.planned" class="mt-1 text-xs text-danger-600">{{ formErrors.planned }}</p>
            </div>

            <!-- Actual -->
            <div>
              <label class="mb-1 block text-xs font-medium text-text-muted" for="f-actual">Actual Amount (₱) <span class="text-text-subtle">(optional)</span></label>
              <input
                id="f-actual"
                v-model="form.actual"
                type="number"
                min="0"
                placeholder="0"
                :class="[
                  'w-full rounded-lg border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary-400',
                  formErrors.actual ? 'border-danger-400 bg-danger-50' : 'border-border bg-surface',
                ]"
              />
              <p v-if="formErrors.actual" class="mt-1 text-xs text-danger-600">{{ formErrors.actual }}</p>
            </div>

            <!-- Cutoff + Month + Year row -->
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="mb-1 block text-xs font-medium text-text-muted" for="f-cutoff">Cutoff</label>
                <div class="relative">
                  <select
                    id="f-cutoff"
                    v-model.number="form.cutoff"
                    class="w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2 pr-7 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
                  >
                    <option :value="15">15th</option>
                    <option :value="30">30th</option>
                  </select>
                  <ChevronDown :size="12" class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
                </div>
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-text-muted" for="f-month">Month</label>
                <div class="relative">
                  <select
                    id="f-month"
                    v-model.number="form.month"
                    class="w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2 pr-7 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
                  >
                    <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label.slice(0, 3) }}</option>
                  </select>
                  <ChevronDown :size="12" class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
                </div>
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-text-muted" for="f-year">Year</label>
                <div class="relative">
                  <select
                    id="f-year"
                    v-model.number="form.year"
                    class="w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2 pr-7 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
                  >
                    <option :value="2025">2025</option>
                    <option :value="2026">2026</option>
                    <option :value="2027">2027</option>
                  </select>
                  <ChevronDown :size="12" class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-3 pt-1">
              <button
                type="button"
                class="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-alt transition-colors"
                @click="modalOpen = false"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <Check :size="14" aria-hidden="true" />
                {{ editingId ? 'Save Changes' : 'Add Item' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- ------------------------------------------------------------------ -->
    <!-- Delete confirmation dialog                                          -->
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
          <h2 class="text-base font-semibold text-text">Delete Budget Item?</h2>
          <p class="mt-1 text-sm text-text-muted">
            <strong>{{ deleteTarget?.category }}</strong> will be permanently removed. This cannot be undone.
          </p>
          <div class="mt-5 flex justify-end gap-3">
            <button
              class="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-alt transition-colors"
              @click="deleteTarget = null"
            >
              Cancel
            </button>
            <button
              class="rounded-lg bg-danger-600 px-4 py-2 text-sm font-medium text-white hover:bg-danger-700 transition-colors"
              @click="executeDelete"
            >
              Delete
            </button>
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
