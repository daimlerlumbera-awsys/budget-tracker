<script setup lang="ts">
import { computed } from 'vue'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CircleDollarSign,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
} from 'lucide-vue-next'

// ---------------------------------------------------------------------------
// Types — mirrors future Supabase schema
// ---------------------------------------------------------------------------
interface Transaction {
  id: string
  date: string        // ISO date string
  description: string
  category: string
  amount: number      // positive = income, negative = expense
  type: 'income' | 'expense'
}

interface BudgetItem {
  id: string
  category: string
  planned: number
  actual: number
}

interface CutoffPeriod {
  label: string       // e.g. "Nov 1 – Nov 15"
  cutoff: 15 | 30
  year: number
  month: number       // 1-based
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const currentPeriod: CutoffPeriod = {
  label: 'Nov 1 – Nov 15',
  cutoff: 15,
  year: 2026,
  month: 11,
}

const income = 42500

const budgetItems: BudgetItem[] = [
  { id: '1', category: 'Housing',       planned: 12000, actual: 12000 },
  { id: '2', category: 'Food',          planned: 5000,  actual: 4320 },
  { id: '3', category: 'Transport',     planned: 2000,  actual: 2450 },
  { id: '4', category: 'Utilities',     planned: 1800,  actual: 1650 },
  { id: '5', category: 'Health',        planned: 1500,  actual: 800 },
  { id: '6', category: 'Entertainment', planned: 1000,  actual: 1200 },
  { id: '7', category: 'Savings',       planned: 8000,  actual: 8000 },
  { id: '8', category: 'Others',        planned: 2000,  actual: 1540 },
]

const recentTransactions: Transaction[] = [
  { id: 't1', date: '2026-11-10', description: 'Salary',          category: 'Income',       amount:  42500, type: 'income' },
  { id: 't2', date: '2026-11-10', description: 'Rent',            category: 'Housing',      amount: -12000, type: 'expense' },
  { id: 't3', date: '2026-11-09', description: 'Groceries',       category: 'Food',         amount:  -2100, type: 'expense' },
  { id: 't4', date: '2026-11-08', description: 'Electric bill',   category: 'Utilities',    amount:  -1650, type: 'expense' },
  { id: 't5', date: '2026-11-08', description: 'Grab ride',       category: 'Transport',    amount:   -350, type: 'expense' },
  { id: 't6', date: '2026-11-07', description: 'Netflix',         category: 'Entertainment',amount:   -449, type: 'expense' },
  { id: 't7', date: '2026-11-07', description: 'Restaurant',      category: 'Food',         amount:  -1250, type: 'expense' },
  { id: 't8', date: '2026-11-06', description: 'Savings transfer',category: 'Savings',      amount:  -8000, type: 'expense' },
]

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------
const totalPlanned = computed(() => budgetItems.reduce((s, i) => s + i.planned, 0))
const totalActual  = computed(() => budgetItems.reduce((s, i) => s + i.actual, 0))
const remaining    = computed(() => income - totalActual.value)
const usagePct     = computed(() => Math.min(Math.round((totalActual.value / income) * 100), 100))

// Progress bar color
const progressColor = computed(() => {
  if (usagePct.value >= 95) return 'bg-danger-500'
  if (usagePct.value >= 80) return 'bg-warning-500'
  return 'bg-primary-500'
})

function formatPHP(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function variance(item: BudgetItem) {
  return item.planned - item.actual  // positive = under budget
}
</script>

<template>
  <div class="space-y-6">

    <!-- Period banner -->
    <div class="flex items-center gap-2 text-sm text-text-muted">
      <CalendarDays :size="16" class="text-primary-500" aria-hidden="true" />
      <span>Cutoff period: <strong class="text-text font-semibold">{{ currentPeriod.label }}</strong> ({{ currentPeriod.cutoff }}th)</span>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">

      <!-- Income -->
      <div class="rounded-xl bg-surface p-4 shadow-sm border border-border">
        <div class="flex items-start justify-between">
          <p class="text-xs font-medium text-text-muted uppercase tracking-wide">Income</p>
          <span class="rounded-full bg-secondary-50 p-1.5">
            <TrendingUp :size="14" class="text-secondary-600" aria-hidden="true" />
          </span>
        </div>
        <p class="mt-2 text-2xl font-bold text-text">{{ formatPHP(income) }}</p>
      </div>

      <!-- Planned expenses -->
      <div class="rounded-xl bg-surface p-4 shadow-sm border border-border">
        <div class="flex items-start justify-between">
          <p class="text-xs font-medium text-text-muted uppercase tracking-wide">Planned</p>
          <span class="rounded-full bg-primary-50 p-1.5">
            <CircleDollarSign :size="14" class="text-primary-600" aria-hidden="true" />
          </span>
        </div>
        <p class="mt-2 text-2xl font-bold text-text">{{ formatPHP(totalPlanned) }}</p>
      </div>

      <!-- Actual expenses -->
      <div class="rounded-xl bg-surface p-4 shadow-sm border border-border">
        <div class="flex items-start justify-between">
          <p class="text-xs font-medium text-text-muted uppercase tracking-wide">Actual</p>
          <span class="rounded-full bg-warning-50 p-1.5">
            <TrendingDown :size="14" class="text-warning-600" aria-hidden="true" />
          </span>
        </div>
        <p class="mt-2 text-2xl font-bold text-text">{{ formatPHP(totalActual) }}</p>
      </div>

      <!-- Remaining -->
      <div
        :class="[
          'rounded-xl p-4 shadow-sm border',
          remaining >= 0 ? 'bg-secondary-50 border-secondary-200' : 'bg-danger-50 border-danger-200',
        ]"
      >
        <div class="flex items-start justify-between">
          <p class="text-xs font-medium uppercase tracking-wide"
             :class="remaining >= 0 ? 'text-secondary-700' : 'text-danger-700'">Remaining</p>
          <span class="rounded-full p-1.5"
                :class="remaining >= 0 ? 'bg-secondary-100' : 'bg-danger-100'">
            <Wallet :size="14"
                    :class="remaining >= 0 ? 'text-secondary-600' : 'text-danger-600'"
                    aria-hidden="true" />
          </span>
        </div>
        <p class="mt-2 text-2xl font-bold"
           :class="remaining >= 0 ? 'text-secondary-700' : 'text-danger-700'">
          {{ formatPHP(remaining) }}
        </p>
      </div>
    </div>

    <!-- Budget usage bar -->
    <div class="rounded-xl bg-surface p-5 shadow-sm border border-border">
      <div class="flex items-baseline justify-between mb-3">
        <h2 class="text-sm font-semibold text-text">Budget Usage</h2>
        <span class="text-sm font-semibold" :class="usagePct >= 95 ? 'text-danger-600' : usagePct >= 80 ? 'text-warning-600' : 'text-primary-600'">
          {{ usagePct }}%
        </span>
      </div>
      <div class="h-2.5 w-full rounded-full bg-neutral-100 overflow-hidden">
        <div
          :class="['h-full rounded-full transition-all duration-500', progressColor]"
          :style="{ width: usagePct + '%' }"
          role="progressbar"
          :aria-valuenow="usagePct"
          aria-valuemin="0"
          aria-valuemax="100"
        />
      </div>
      <p class="mt-2 text-xs text-text-muted">{{ formatPHP(totalActual) }} spent of {{ formatPHP(income) }}</p>
    </div>

    <!-- Planned vs Actual breakdown + Recent transactions -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">

      <!-- Breakdown table -->
      <div class="rounded-xl bg-surface shadow-sm border border-border overflow-hidden">
        <div class="px-5 py-4 border-b border-border">
          <h2 class="text-sm font-semibold text-text">Planned vs. Actual</h2>
        </div>
        <div class="divide-y divide-border">
          <div
            v-for="item in budgetItems"
            :key="item.id"
            class="flex items-center justify-between px-5 py-3 text-sm"
          >
            <span class="text-text-muted w-32 truncate">{{ item.category }}</span>
            <div class="flex items-center gap-4">
              <span class="w-24 text-right text-text-muted">{{ formatPHP(item.planned) }}</span>
              <span class="w-24 text-right font-medium text-text">{{ formatPHP(item.actual) }}</span>
              <span
                :class="[
                  'flex items-center gap-0.5 w-20 text-right text-xs font-semibold',
                  variance(item) >= 0 ? 'text-secondary-600' : 'text-danger-600',
                ]"
              >
                <ArrowUpRight v-if="variance(item) >= 0" :size="12" aria-hidden="true" />
                <ArrowDownRight v-else :size="12" aria-hidden="true" />
                {{ formatPHP(Math.abs(variance(item))) }}
              </span>
            </div>
          </div>
        </div>
        <div class="flex items-center justify-between px-5 py-3 bg-surface-alt text-sm font-semibold border-t border-border">
          <span class="text-text">Total</span>
          <div class="flex items-center gap-4">
            <span class="w-24 text-right text-text-muted">{{ formatPHP(totalPlanned) }}</span>
            <span class="w-24 text-right text-text">{{ formatPHP(totalActual) }}</span>
            <span
              :class="[
                'w-20 text-right text-xs font-semibold',
                totalPlanned - totalActual >= 0 ? 'text-secondary-600' : 'text-danger-600',
              ]"
            >
              {{ formatPHP(Math.abs(totalPlanned - totalActual)) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Recent transactions -->
      <div class="rounded-xl bg-surface shadow-sm border border-border overflow-hidden">
        <div class="px-5 py-4 border-b border-border">
          <h2 class="text-sm font-semibold text-text">Recent Transactions</h2>
        </div>
        <ul class="divide-y divide-border" role="list">
          <li
            v-for="tx in recentTransactions"
            :key="tx.id"
            class="flex items-center justify-between px-5 py-3 text-sm"
          >
            <div class="flex items-center gap-3 min-w-0">
              <span
                :class="[
                  'shrink-0 flex h-7 w-7 items-center justify-center rounded-full',
                  tx.type === 'income' ? 'bg-secondary-50' : 'bg-danger-50',
                ]"
              >
                <ArrowUpRight v-if="tx.type === 'income'"  :size="13" class="text-secondary-600" aria-hidden="true" />
                <ArrowDownRight v-else :size="13" class="text-danger-600" aria-hidden="true" />
              </span>
              <div class="min-w-0">
                <p class="font-medium text-text truncate">{{ tx.description }}</p>
                <p class="text-xs text-text-subtle">{{ tx.category }}</p>
              </div>
            </div>
            <div class="ml-4 text-right shrink-0">
              <p
                :class="[
                  'font-semibold',
                  tx.type === 'income' ? 'text-secondary-600' : 'text-danger-600',
                ]"
              >
                {{ tx.type === 'income' ? '+' : '' }}{{ formatPHP(tx.amount) }}
              </p>
              <p class="text-xs text-text-subtle">{{ formatDate(tx.date) }}</p>
            </div>
          </li>
        </ul>
      </div>

    </div>
  </div>
</template>
