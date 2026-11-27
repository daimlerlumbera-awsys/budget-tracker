<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { TrendingUp, TrendingDown, Wallet, PiggyBank, ChartPie, ChartColumn, FileBarChart } from 'lucide-vue-next'
import {
  useTransactionStore, useSettingsStore, cutoffPeriodName, formatCurrency,
  type Transaction, type Cutoff,
} from '@/stores/counter'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useTheme'
import DonutChart, { type DonutSlice } from '@/components/reports/DonutChart.vue'
import BarChart, { type BarSeries } from '@/components/reports/BarChart.vue'

const txStore       = useTransactionStore()
const settingsStore = useSettingsStore()
const authStore     = useAuthStore()
const { isDark }    = useTheme()

onMounted(async () => {
  const userId = authStore.user?.id
  if (!userId) return
  if (txStore.transactionsUserId !== userId || !txStore.transactionsLoaded) {
    if (txStore.transactionsLoading && txStore.transactionsRequestedUserId === userId) return
    await txStore.loadTransactions(userId)
  }
})

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------
type ReportMode = 'monthly' | 'yearly'
type ChartType  = 'pie' | 'bar'

const today     = new Date()
const mode      = ref<ReportMode>('monthly')
const chartType = ref<ChartType>('pie')
const year      = ref(today.getFullYear())
const month     = ref(today.getMonth() + 1)

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG  = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const years = computed(() => {
  const set = new Set<number>(txStore.items.map(t => t.year))
  set.add(today.getFullYear())
  return [...set].sort((a, b) => b - a)
})

const periodLabel = computed(() =>
  mode.value === 'monthly' ? `${MONTHS_LONG[month.value - 1]} ${year.value}` : `${year.value}`,
)

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const scoped = computed<Transaction[]>(() =>
  txStore.items.filter(t =>
    t.year === year.value && (mode.value === 'yearly' || t.month === month.value),
  ),
)

const sum = (list: Transaction[]) => list.reduce((s, t) => s + t.amount, 0)

const income   = computed(() => sum(scoped.value.filter(t => t.type === 'income')))
const expenses = computed(() => sum(scoped.value.filter(t => t.type === 'expense')))
const net      = computed(() => income.value - expenses.value)
const savingsRate = computed(() =>
  income.value > 0 ? Math.round((net.value / income.value) * 100) : null,
)

// Income / expense colors validated for CVD + contrast on both light and dark surfaces
const INCOME_COLOR  = '#059669'
const EXPENSE_COLOR = '#f43f5e'

// Categorical palette in fixed order (light / dark steps of the same hues)
const PALETTE_LIGHT = ['#257de0', '#f47230', '#00b894', '#f2a600', '#ee7fac', '#008a17', '#6a4ce2', '#ec4647']
const PALETTE_DARK  = ['#338ced', '#e76624', '#00a888', '#d28e05', '#e24d8b', '#0aac23', '#9887ef', '#eb6263']
const OTHER_COLOR   = computed(() => (isDark.value ? '#64748b' : '#94a3b8'))
const MAX_SLICES    = 7

// Expenses by category: top 7, the rest folded into "Other"
const categorySlices = computed<DonutSlice[]>(() => {
  const totals = new Map<string, number>()
  for (const t of scoped.value) {
    if (t.type !== 'expense') continue
    const key = t.category || 'Uncategorized'
    totals.set(key, (totals.get(key) ?? 0) + t.amount)
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1])
  const palette = isDark.value ? PALETTE_DARK : PALETTE_LIGHT
  const top = sorted.slice(0, MAX_SLICES).map(([label, value], i) => ({ label, value, color: palette[i]! }))
  const rest = sorted.slice(MAX_SLICES).reduce((s, [, v]) => s + v, 0)
  if (rest > 0) top.push({ label: 'Other', value: rest, color: OTHER_COLOR.value })
  return top
})

const maxCategory = computed(() => Math.max(1, ...categorySlices.value.map(s => s.value)))

// Income vs expenses: per cutoff (monthly) or per month (yearly)
const trend = computed<{ labels: string[]; series: BarSeries[] }>(() => {
  if (mode.value === 'monthly') {
    const cutoffs: Cutoff[] = ['A', 'B']
    const by = (type: Transaction['type']) =>
      cutoffs.map(c => sum(scoped.value.filter(t => t.type === type && t.cutoff === c)))
    return {
      labels: cutoffs.map(cutoffPeriodName),
      series: [
        { name: 'Income',   color: INCOME_COLOR,  values: by('income') },
        { name: 'Expenses', color: EXPENSE_COLOR, values: by('expense') },
      ],
    }
  }
  const by = (type: Transaction['type']) =>
    MONTHS_SHORT.map((_, i) => sum(scoped.value.filter(t => t.type === type && t.month === i + 1)))
  return {
    labels: MONTHS_SHORT,
    series: [
      { name: 'Income',   color: INCOME_COLOR,  values: by('income') },
      { name: 'Expenses', color: EXPENSE_COLOR, values: by('expense') },
    ],
  }
})

// Month-by-month table for the yearly report
const monthlyRows = computed(() =>
  MONTHS_LONG.map((name, i) => {
    const inc = trend.value.series[0]?.values[i] ?? 0
    const exp = trend.value.series[1]?.values[i] ?? 0
    return { name, income: inc, expenses: exp, net: inc - exp }
  }).filter(r => r.income > 0 || r.expenses > 0),
)

const hasData = computed(() => scoped.value.length > 0)

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
function formatMoney(v: number) {
  return formatCurrency(v, settingsStore.settings.currency)
}

function formatAxis(v: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: settingsStore.settings.currency,
    notation: 'compact', maximumFractionDigits: 1,
  }).format(v)
}

function pct(v: number) {
  return expenses.value > 0 ? `${((v / expenses.value) * 100).toFixed(1)}%` : '0%'
}
</script>

<template>
  <div class="space-y-6">

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="inline-flex rounded-lg border border-border bg-surface p-0.5" role="tablist" aria-label="Report type">
        <button
          v-for="m in (['monthly', 'yearly'] as const)" :key="m"
          role="tab" :aria-selected="mode === m"
          :class="[
            'rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors',
            mode === m ? 'bg-primary-600 text-white' : 'text-text-muted hover:text-text',
          ]"
          @click="mode = m"
        >{{ m }}</button>
      </div>

      <select
        v-if="mode === 'monthly'" v-model.number="month" aria-label="Month"
        class="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option v-for="(name, i) in MONTHS_LONG" :key="name" :value="i + 1">{{ name }}</option>
      </select>

      <select
        v-model.number="year" aria-label="Year"
        class="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
      </select>

      <div class="ml-auto inline-flex rounded-lg border border-border bg-surface p-0.5" aria-label="Chart type">
        <button
          :class="['flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                   chartType === 'pie' ? 'bg-surface-alt text-text' : 'text-text-muted hover:text-text']"
          :aria-pressed="chartType === 'pie'"
          @click="chartType = 'pie'"
        >
          <ChartPie :size="15" aria-hidden="true" /> Pie
        </button>
        <button
          :class="['flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                   chartType === 'bar' ? 'bg-surface-alt text-text' : 'text-text-muted hover:text-text']"
          :aria-pressed="chartType === 'bar'"
          @click="chartType = 'bar'"
        >
          <ChartColumn :size="15" aria-hidden="true" /> Bar
        </button>
      </div>
    </div>

    <p v-if="txStore.transactionsLoading" class="text-sm text-text-muted">Loading transactions…</p>
    <p v-else-if="txStore.transactionsError" class="text-sm text-danger-600">{{ txStore.transactionsError }}</p>

    <!-- Summary -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div class="rounded-xl bg-surface p-4 shadow-sm border border-border">
        <div class="flex items-start justify-between">
          <p class="text-xs font-medium text-text-muted uppercase tracking-wide">Income</p>
          <span class="rounded-full bg-secondary-50 p-1.5"><TrendingUp :size="14" class="text-secondary-600" aria-hidden="true" /></span>
        </div>
        <p class="mt-2 text-2xl font-bold text-text tabular-nums">{{ formatMoney(income) }}</p>
        <p class="mt-1 text-xs text-text-subtle">{{ periodLabel }}</p>
      </div>
      <div class="rounded-xl bg-surface p-4 shadow-sm border border-border">
        <div class="flex items-start justify-between">
          <p class="text-xs font-medium text-text-muted uppercase tracking-wide">Expenses</p>
          <span class="rounded-full bg-danger-50 p-1.5"><TrendingDown :size="14" class="text-danger-600" aria-hidden="true" /></span>
        </div>
        <p class="mt-2 text-2xl font-bold text-text tabular-nums">{{ formatMoney(expenses) }}</p>
        <p class="mt-1 text-xs text-text-subtle">{{ periodLabel }}</p>
      </div>
      <div class="rounded-xl bg-surface p-4 shadow-sm border border-border">
        <div class="flex items-start justify-between">
          <p class="text-xs font-medium text-text-muted uppercase tracking-wide">Net</p>
          <span class="rounded-full bg-primary-50 p-1.5"><Wallet :size="14" class="text-primary-600" aria-hidden="true" /></span>
        </div>
        <p :class="['mt-2 text-2xl font-bold tabular-nums', net >= 0 ? 'text-secondary-700' : 'text-danger-700']">
          {{ formatMoney(net) }}
        </p>
        <p class="mt-1 text-xs text-text-subtle">Income − expenses</p>
      </div>
      <div class="rounded-xl bg-surface p-4 shadow-sm border border-border">
        <div class="flex items-start justify-between">
          <p class="text-xs font-medium text-text-muted uppercase tracking-wide">Savings rate</p>
          <span class="rounded-full bg-warning-50 p-1.5"><PiggyBank :size="14" class="text-warning-600" aria-hidden="true" /></span>
        </div>
        <p class="mt-2 text-2xl font-bold text-text tabular-nums">{{ savingsRate === null ? '—' : `${savingsRate}%` }}</p>
        <p class="mt-1 text-xs text-text-subtle">Share of income kept</p>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="!hasData && !txStore.transactionsLoading"
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center"
    >
      <FileBarChart :size="32" class="text-text-subtle" aria-hidden="true" />
      <p class="mt-3 text-sm font-medium text-text">No transactions for {{ periodLabel }}</p>
      <p class="mt-1 text-xs text-text-muted">Pick another period or add transactions to see a report.</p>
    </div>

    <div v-else-if="hasData" class="grid grid-cols-1 gap-6 xl:grid-cols-2">

      <!-- Spending by category -->
      <section class="rounded-xl bg-surface shadow-sm border border-border">
        <div class="px-5 py-4 border-b border-border">
          <h2 class="text-sm font-semibold text-text">Spending by category</h2>
          <p class="text-xs text-text-muted">{{ periodLabel }}</p>
        </div>
        <div class="p-5">
          <p v-if="categorySlices.length === 0" class="py-8 text-center text-sm text-text-muted">No expenses in this period.</p>

          <DonutChart
            v-else-if="chartType === 'pie'"
            :slices="categorySlices" :format="formatMoney" total-label="Total spent"
          />

          <ul v-else class="space-y-3" role="list">
            <li v-for="s in categorySlices" :key="s.label">
              <div class="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span class="truncate text-text">{{ s.label }}</span>
                <span class="shrink-0 tabular-nums">
                  <span class="font-medium text-text">{{ formatMoney(s.value) }}</span>
                  <span class="ml-2 text-xs text-text-muted">{{ pct(s.value) }}</span>
                </span>
              </div>
              <div class="h-2.5 w-full overflow-hidden rounded-full bg-surface-alt">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :style="{ width: `${(s.value / maxCategory) * 100}%`, background: EXPENSE_COLOR }"
                />
              </div>
            </li>
          </ul>
        </div>
      </section>

      <!-- Income vs expenses -->
      <section class="rounded-xl bg-surface shadow-sm border border-border">
        <div class="px-5 py-4 border-b border-border">
          <h2 class="text-sm font-semibold text-text">Income vs. expenses</h2>
          <p class="text-xs text-text-muted">{{ mode === 'monthly' ? 'By cutoff' : 'By month' }} · {{ periodLabel }}</p>
        </div>
        <div class="p-5">
          <DonutChart
            v-if="chartType === 'pie'"
            :slices="[
              { label: 'Income', value: income, color: INCOME_COLOR },
              { label: 'Expenses', value: expenses, color: EXPENSE_COLOR },
            ]"
            :format="formatMoney" total-label="Total flow"
          />
          <BarChart
            v-else
            :labels="trend.labels" :series="trend.series"
            :format="formatMoney" :axis-format="formatAxis"
          />
        </div>
      </section>

      <!-- Yearly month-by-month table -->
      <section v-if="mode === 'yearly'" class="rounded-xl bg-surface shadow-sm border border-border overflow-hidden xl:col-span-2">
        <div class="px-5 py-4 border-b border-border">
          <h2 class="text-sm font-semibold text-text">Monthly breakdown · {{ year }}</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-surface-alt text-xs font-semibold uppercase tracking-wide text-text-muted">
              <tr>
                <th class="px-5 py-2 text-left">Month</th>
                <th class="px-5 py-2 text-right">Income</th>
                <th class="px-5 py-2 text-right">Expenses</th>
                <th class="px-5 py-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="r in monthlyRows" :key="r.name">
                <td class="px-5 py-2.5 text-text">{{ r.name }}</td>
                <td class="px-5 py-2.5 text-right tabular-nums text-text">{{ formatMoney(r.income) }}</td>
                <td class="px-5 py-2.5 text-right tabular-nums text-text">{{ formatMoney(r.expenses) }}</td>
                <td :class="['px-5 py-2.5 text-right font-medium tabular-nums', r.net >= 0 ? 'text-secondary-600' : 'text-danger-600']">
                  {{ formatMoney(r.net) }}
                </td>
              </tr>
            </tbody>
            <tfoot class="bg-surface-alt font-semibold">
              <tr>
                <td class="px-5 py-2.5 text-text">Total</td>
                <td class="px-5 py-2.5 text-right tabular-nums text-text">{{ formatMoney(income) }}</td>
                <td class="px-5 py-2.5 text-right tabular-nums text-text">{{ formatMoney(expenses) }}</td>
                <td :class="['px-5 py-2.5 text-right tabular-nums', net >= 0 ? 'text-secondary-600' : 'text-danger-600']">
                  {{ formatMoney(net) }}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>
