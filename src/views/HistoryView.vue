<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  ChevronDown, ChevronRight, ChevronUp,
  TrendingUp, TrendingDown, Wallet, CalendarDays,
  ArrowUpRight, ArrowDownRight, History,
} from 'lucide-vue-next'
import {
  useTransactionStore, useBudgetStore, useSettingsStore,
  formatCurrency, type Cutoff,
} from '@/stores/counter'

const store         = useTransactionStore()
const budgetStore   = useBudgetStore()
const settingsStore = useSettingsStore()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function periodLabel(year: number, month: number, cutoff: Cutoff): string {
  const name = MONTH_NAMES[month]
  const start = cutoff === 15 ? 1 : 16
  const end   = cutoff === 15 ? 15 : new Date(year, month, 0).getDate()
  return `${name} ${start}–${end}, ${year}`
}

function periodSortKey(year: number, month: number, cutoff: Cutoff): string {
  return `${year}-${String(month).padStart(2, '0')}-${cutoff}`
}

function formatPHP(v: number) {
  return formatCurrency(v, settingsStore.settings.currency)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

// "Current" period — Nov 2026 15th
const CURRENT_KEY = periodSortKey(2026, 11, 15)

// ---------------------------------------------------------------------------
// Build period summaries derived from transaction store
// ---------------------------------------------------------------------------
interface PeriodSummary {
  key: string
  year: number
  month: number
  cutoff: Cutoff
  label: string
  isCurrent: boolean
  income: number
  expenses: number
  remaining: number
  planned: number
  budgetUsagePct: number
}

const periods = computed((): PeriodSummary[] => {
  // Group transactions by (year, month, cutoff)
  const map = new Map<string, PeriodSummary>()

  for (const tx of store.items) {
    const key = periodSortKey(tx.year, tx.month, tx.cutoff)
    if (!map.has(key)) {
      map.set(key, {
        key,
        year: tx.year, month: tx.month, cutoff: tx.cutoff,
        label: periodLabel(tx.year, tx.month, tx.cutoff),
        isCurrent: key === CURRENT_KEY,
        income: 0, expenses: 0, remaining: 0,
        planned: 0, budgetUsagePct: 0,
      })
    }
    const p = map.get(key)!
    if (tx.type === 'income')  p.income   += tx.amount
    else                       p.expenses += tx.amount
  }

  // Enrich with planned totals from snapshots
  for (const snap of budgetStore.items) {
    const key = periodSortKey(snap.year, snap.month, snap.cutoff)
    const p   = map.get(key)
    if (p) p.planned += snap.planned
  }

  // Compute derived
  for (const [, p] of map) {
    p.remaining      = p.income - p.expenses
    p.budgetUsagePct = p.planned > 0
      ? Math.min(Math.round((p.expenses / p.planned) * 100), 100)
      : 0
  }

  // Sort newest first
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key))
})

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------
const filterYear   = ref<number | 'all'>('all')
const filterCutoff = ref<Cutoff | 'all'>('all')

const availableYears = computed(() => {
  const years = new Set(periods.value.map(p => p.year))
  return [...years].sort((a, b) => b - a)
})

const filteredPeriods = computed(() =>
  periods.value.filter(p =>
    (filterYear.value   === 'all' || p.year   === filterYear.value) &&
    (filterCutoff.value === 'all' || p.cutoff === filterCutoff.value)
  )
)

// ---------------------------------------------------------------------------
// Selected period detail panel
// ---------------------------------------------------------------------------
const selectedKey = ref<string | null>(null)

function togglePeriod(key: string) {
  selectedKey.value = selectedKey.value === key ? null : key
}

const selectedPeriod = computed(() =>
  selectedKey.value ? periods.value.find(p => p.key === selectedKey.value) ?? null : null
)

const selectedTransactions = computed(() => {
  if (!selectedPeriod.value) return []
  const { year, month, cutoff } = selectedPeriod.value
  return store.forPeriod(year, month, cutoff)
    .sort((a, b) => b.date.localeCompare(a.date))
})

const selectedSnapshots = computed(() => {
  if (!selectedPeriod.value) return []
  const { year, month, cutoff } = selectedPeriod.value
  return budgetStore.forPeriod(year, month, cutoff)
})

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------
function usageBgColor(pct: number) {
  if (pct >= 100) return 'bg-danger-500'
  if (pct >= 80)  return 'bg-warning-500'
  return 'bg-secondary-500'
}

function usageTextColor(pct: number) {
  if (pct >= 100) return 'text-danger-600'
  if (pct >= 80)  return 'text-warning-600'
  return 'text-secondary-600'
}
</script>

<template>
  <div class="space-y-5">

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3">
      <!-- Year -->
      <div class="relative">
        <select
          v-model="filterYear"
          class="appearance-none rounded-lg border border-border bg-surface px-3 py-2 pr-8 text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          <option value="all">All years</option>
          <option v-for="y in availableYears" :key="y" :value="y">{{ y }}</option>
        </select>
        <ChevronDown :size="13" class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
      </div>

      <!-- Cutoff -->
      <div class="flex rounded-lg border border-border bg-surface shadow-sm overflow-hidden text-sm">
        <button
          v-for="opt in [{ label: 'All', value: 'all' }, { label: '15th', value: 15 }, { label: '30th', value: 30 }]"
          :key="opt.label"
          :class="[
            'px-3 py-2 font-medium transition-colors',
            filterCutoff === opt.value ? 'bg-primary-600 text-white' : 'text-text-muted hover:bg-surface-alt',
          ]"
          @click="filterCutoff = opt.value as typeof filterCutoff"
        >{{ opt.label }}</button>
      </div>

      <span class="text-xs text-text-muted">{{ filteredPeriods.length }} period{{ filteredPeriods.length !== 1 ? 's' : '' }}</span>
    </div>

    <!-- Empty state -->
    <div v-if="filteredPeriods.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
      <div class="mb-3 rounded-full bg-surface-alt p-4">
        <History :size="24" class="text-text-subtle" aria-hidden="true" />
      </div>
      <p class="text-sm font-medium text-text">No history found</p>
      <p class="mt-1 text-xs text-text-muted">Try adjusting your filters.</p>
    </div>

    <!-- Period list -->
    <div v-else class="space-y-3">
      <div
        v-for="period in filteredPeriods"
        :key="period.key"
        class="rounded-xl bg-surface border border-border shadow-sm overflow-hidden"
      >
        <!-- Period header / summary row -->
        <button
          class="w-full text-left"
          :aria-expanded="selectedKey === period.key"
          @click="togglePeriod(period.key)"
        >
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 hover:bg-surface-alt transition-colors">

            <!-- Label + badge -->
            <div class="flex items-center gap-2.5 min-w-40">
              <CalendarDays :size="16" class="shrink-0 text-primary-500" aria-hidden="true" />
              <div>
                <p class="text-sm font-semibold text-text leading-tight">{{ period.label }}</p>
                <span
                  class="text-xs font-medium px-1.5 py-0.5 rounded-full"
                  :class="period.isCurrent
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-surface-alt text-text-muted border border-border'"
                >{{ period.isCurrent ? 'Current' : 'Completed' }}</span>
              </div>
            </div>

            <!-- Stat chips -->
            <div class="flex flex-wrap items-center gap-4 flex-1">
              <div class="flex items-center gap-1.5">
                <TrendingUp :size="13" class="text-secondary-500" aria-hidden="true" />
                <span class="text-xs text-text-muted">Income</span>
                <span class="text-xs font-semibold text-secondary-600">{{ formatPHP(period.income) }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <TrendingDown :size="13" class="text-danger-400" aria-hidden="true" />
                <span class="text-xs text-text-muted">Expenses</span>
                <span class="text-xs font-semibold text-danger-600">{{ formatPHP(period.expenses) }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <Wallet :size="13" class="text-text-subtle" aria-hidden="true" />
                <span class="text-xs text-text-muted">Remaining</span>
                <span class="text-xs font-semibold"
                      :class="period.remaining >= 0 ? 'text-secondary-600' : 'text-danger-600'">
                  {{ formatPHP(period.remaining) }}
                </span>
              </div>
              <!-- Mini usage bar -->
              <div v-if="period.planned > 0" class="flex items-center gap-2">
                <div class="h-1.5 w-20 rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    :class="['h-full rounded-full', usageBgColor(period.budgetUsagePct)]"
                    :style="{ width: period.budgetUsagePct + '%' }"
                  />
                </div>
                <span class="text-xs font-medium" :class="usageTextColor(period.budgetUsagePct)">
                  {{ period.budgetUsagePct }}%
                </span>
              </div>
            </div>

            <!-- Expand icon -->
            <component
              :is="selectedKey === period.key ? ChevronUp : ChevronRight"
              :size="16"
              class="shrink-0 text-text-subtle"
              aria-hidden="true"
            />
          </div>
        </button>

        <!-- Expanded detail -->
        <Transition name="slide">
          <div v-if="selectedKey === period.key" class="border-t border-border">

            <!-- Detail summary cards -->
            <div class="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
              <div class="rounded-lg bg-bg border border-border p-3">
                <p class="text-xs text-text-muted">Income</p>
                <p class="mt-0.5 text-base font-bold text-secondary-600">{{ formatPHP(period.income) }}</p>
              </div>
              <div class="rounded-lg bg-bg border border-border p-3">
                <p class="text-xs text-text-muted">Planned</p>
                <p class="mt-0.5 text-base font-bold text-text">{{ formatPHP(period.planned) }}</p>
              </div>
              <div class="rounded-lg bg-bg border border-border p-3">
                <p class="text-xs text-text-muted">Actual</p>
                <p class="mt-0.5 text-base font-bold text-danger-600">{{ formatPHP(period.expenses) }}</p>
              </div>
              <div class="rounded-lg bg-bg border border-border p-3"
                   :class="period.remaining >= 0 ? '' : 'bg-danger-50 border-danger-200'">
                <p class="text-xs" :class="period.remaining >= 0 ? 'text-text-muted' : 'text-danger-700'">Remaining</p>
                <p class="mt-0.5 text-base font-bold"
                   :class="period.remaining >= 0 ? 'text-secondary-600' : 'text-danger-600'">
                  {{ formatPHP(period.remaining) }}
                </p>
              </div>
            </div>

            <!-- Budget usage bar -->
            <div v-if="period.planned > 0" class="px-5 pb-4">
              <div class="flex items-baseline justify-between mb-1.5">
                <p class="text-xs font-semibold text-text-muted uppercase tracking-wide">Budget Usage</p>
                <span class="text-xs font-semibold" :class="usageTextColor(period.budgetUsagePct)">
                  {{ period.budgetUsagePct }}%
                </span>
              </div>
              <div class="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
                <div
                  :class="['h-full rounded-full', usageBgColor(period.budgetUsagePct)]"
                  :style="{ width: period.budgetUsagePct + '%' }"
                  role="progressbar"
                  :aria-valuenow="period.budgetUsagePct"
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
              </div>
              <p class="mt-1 text-xs text-text-muted">
                {{ formatPHP(period.expenses) }} of {{ formatPHP(period.planned) }} planned
              </p>
            </div>

            <!-- Two-column detail: budget breakdown + transactions -->
            <div class="grid grid-cols-1 gap-0 lg:grid-cols-2 border-t border-border">

              <!-- Budget breakdown -->
              <div class="border-b lg:border-b-0 lg:border-r border-border">
                <p class="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted border-b border-border bg-surface-alt">
                  Planned vs. Actual
                </p>
                <div v-if="selectedSnapshots.length === 0" class="px-5 py-6 text-xs text-text-muted text-center">
                  No budget data for this period.
                </div>
                <div v-else class="divide-y divide-border">
                  <div
                    v-for="snap in selectedSnapshots"
                    :key="snap.id"
                    class="flex items-center justify-between px-5 py-2.5 text-xs"
                  >
                    <span class="text-text-muted w-28 truncate">{{ snap.category }}</span>
                    <div class="flex items-center gap-3">
                      <span class="w-20 text-right text-text-muted">{{ formatPHP(snap.planned) }}</span>
                      <span class="w-20 text-right font-medium text-text">{{ formatPHP(snap.actual) }}</span>
                      <span class="w-16 text-right font-semibold"
                            :class="snap.planned - snap.actual >= 0 ? 'text-secondary-600' : 'text-danger-600'">
                        {{ formatPHP(Math.abs(snap.planned - snap.actual)) }}
                      </span>
                    </div>
                  </div>
                </div>
                <!-- Snapshot totals -->
                <div v-if="selectedSnapshots.length > 0"
                     class="flex items-center justify-between px-5 py-2.5 bg-surface-alt border-t border-border text-xs font-semibold">
                  <span class="text-text">Total</span>
                  <div class="flex items-center gap-3">
                    <span class="w-20 text-right text-text-muted">
                      {{ formatPHP(selectedSnapshots.reduce((s, b) => s + b.planned, 0)) }}
                    </span>
                    <span class="w-20 text-right text-text">
                      {{ formatPHP(selectedSnapshots.reduce((s, b) => s + b.actual, 0)) }}
                    </span>
                    <span class="w-16 text-right"
                          :class="selectedSnapshots.reduce((s, b) => s + b.planned - b.actual, 0) >= 0 ? 'text-secondary-600' : 'text-danger-600'">
                      {{ formatPHP(Math.abs(selectedSnapshots.reduce((s, b) => s + b.planned - b.actual, 0))) }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Transactions list -->
              <div>
                <p class="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted border-b border-border bg-surface-alt">
                  Transactions
                </p>
                <div v-if="selectedTransactions.length === 0" class="px-5 py-6 text-xs text-text-muted text-center">
                  No transactions for this period.
                </div>
                <ul v-else class="divide-y divide-border max-h-72 overflow-y-auto" role="list">
                  <li
                    v-for="tx in selectedTransactions"
                    :key="tx.id"
                    class="flex items-center justify-between px-5 py-2.5 text-xs"
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <span
                        :class="[
                          'shrink-0 flex h-5 w-5 items-center justify-center rounded-full',
                          tx.type === 'income' ? 'bg-secondary-50' : 'bg-danger-50',
                        ]"
                      >
                        <ArrowUpRight v-if="tx.type === 'income'" :size="10" class="text-secondary-600" aria-hidden="true" />
                        <ArrowDownRight v-else :size="10" class="text-danger-600" aria-hidden="true" />
                      </span>
                      <div class="min-w-0">
                        <p class="font-medium text-text truncate">{{ tx.description }}</p>
                        <p class="text-text-subtle">{{ tx.category }}</p>
                      </div>
                    </div>
                    <div class="ml-3 text-right shrink-0">
                      <p class="font-semibold"
                         :class="tx.type === 'income' ? 'text-secondary-600' : 'text-danger-600'">
                        {{ tx.type === 'income' ? '+' : '−' }}{{ formatPHP(tx.amount) }}
                      </p>
                      <p class="text-text-subtle">{{ formatDate(tx.date) }}</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.2s ease, max-height 0.25s ease;
  overflow: hidden;
  max-height: 1000px;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
