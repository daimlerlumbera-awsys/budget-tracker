import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

// ---------------------------------------------------------------------------
// Types — mirrors future MySQL schema
// ---------------------------------------------------------------------------
export type Cutoff = 15 | 30

export interface Transaction {
  id: string
  date: string         // ISO date string YYYY-MM-DD
  description: string
  category: string
  type: 'income' | 'expense'
  amount: number       // always positive; sign derived from type
  cutoff: Cutoff
  month: number        // 1-based
  year: number
  notes?: string
}

export interface BudgetItem {
  id: string
  category: string
  planned: number    // user-set budget plan
  actual: number     // derived from transactions (computed on backend later)
  cutoff: Cutoff
  month: number      // 1-based
  year: number
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useTransactionStore = defineStore('transactions', () => {
  const items = ref<Transaction[]>([
    // Nov 2026 — 15th cutoff (current)
    { id: 't1',  date: '2026-11-10', description: 'Salary',            category: 'Income',        type: 'income',  amount: 42500, cutoff: 15, month: 11, year: 2026 },
    { id: 't2',  date: '2026-11-10', description: 'Rent',              category: 'Housing',       type: 'expense', amount: 12000, cutoff: 15, month: 11, year: 2026 },
    { id: 't3',  date: '2026-11-09', description: 'Groceries',         category: 'Food',          type: 'expense', amount: 2100,  cutoff: 15, month: 11, year: 2026 },
    { id: 't4',  date: '2026-11-08', description: 'Electric bill',     category: 'Utilities',     type: 'expense', amount: 1650,  cutoff: 15, month: 11, year: 2026 },
    { id: 't5',  date: '2026-11-08', description: 'Grab ride',         category: 'Transport',     type: 'expense', amount: 350,   cutoff: 15, month: 11, year: 2026 },
    { id: 't6',  date: '2026-11-07', description: 'Netflix',           category: 'Entertainment', type: 'expense', amount: 449,   cutoff: 15, month: 11, year: 2026 },
    { id: 't7',  date: '2026-11-07', description: 'Restaurant',        category: 'Food',          type: 'expense', amount: 1250,  cutoff: 15, month: 11, year: 2026 },
    { id: 't8',  date: '2026-11-06', description: 'Savings transfer',  category: 'Savings',       type: 'expense', amount: 8000,  cutoff: 15, month: 11, year: 2026 },
    // Oct 2026 — 30th cutoff
    { id: 't9',  date: '2026-10-25', description: 'Freelance project', category: 'Income',        type: 'income',  amount: 8000,  cutoff: 30, month: 10, year: 2026 },
    { id: 't10', date: '2026-10-24', description: 'Medicine',          category: 'Health',        type: 'expense', amount: 800,   cutoff: 30, month: 10, year: 2026 },
    { id: 't11', date: '2026-10-22', description: 'Groceries',         category: 'Food',          type: 'expense', amount: 1800,  cutoff: 30, month: 10, year: 2026 },
    { id: 't12', date: '2026-10-20', description: 'Transport card',    category: 'Transport',     type: 'expense', amount: 500,   cutoff: 30, month: 10, year: 2026 },
    // Oct 2026 — 15th cutoff
    { id: 't13', date: '2026-10-10', description: 'Salary',            category: 'Income',        type: 'income',  amount: 42500, cutoff: 15, month: 10, year: 2026 },
    { id: 't14', date: '2026-10-10', description: 'Rent',              category: 'Housing',       type: 'expense', amount: 12000, cutoff: 15, month: 10, year: 2026 },
    { id: 't15', date: '2026-10-09', description: 'Groceries',         category: 'Food',          type: 'expense', amount: 2300,  cutoff: 15, month: 10, year: 2026 },
    { id: 't16', date: '2026-10-08', description: 'Electric bill',     category: 'Utilities',     type: 'expense', amount: 1720,  cutoff: 15, month: 10, year: 2026 },
    { id: 't17', date: '2026-10-07', description: 'Gym membership',    category: 'Health',        type: 'expense', amount: 1200,  cutoff: 15, month: 10, year: 2026 },
    { id: 't18', date: '2026-10-06', description: 'Savings transfer',  category: 'Savings',       type: 'expense', amount: 8000,  cutoff: 15, month: 10, year: 2026 },
    // Sep 2026 — 30th cutoff
    { id: 't19', date: '2026-09-28', description: 'Bonus',             category: 'Income',        type: 'income',  amount: 5000,  cutoff: 30, month: 9,  year: 2026 },
    { id: 't20', date: '2026-09-27', description: 'Dining out',        category: 'Food',          type: 'expense', amount: 2800,  cutoff: 30, month: 9,  year: 2026 },
    { id: 't21', date: '2026-09-25', description: 'Concert tickets',   category: 'Entertainment', type: 'expense', amount: 1500,  cutoff: 30, month: 9,  year: 2026 },
    { id: 't22', date: '2026-09-24', description: 'Transport card',    category: 'Transport',     type: 'expense', amount: 500,   cutoff: 30, month: 9,  year: 2026 },
    // Sep 2026 — 15th cutoff
    { id: 't23', date: '2026-09-10', description: 'Salary',            category: 'Income',        type: 'income',  amount: 42500, cutoff: 15, month: 9,  year: 2026 },
    { id: 't24', date: '2026-09-10', description: 'Rent',              category: 'Housing',       type: 'expense', amount: 12000, cutoff: 15, month: 9,  year: 2026 },
    { id: 't25', date: '2026-09-09', description: 'Groceries',         category: 'Food',          type: 'expense', amount: 1950,  cutoff: 15, month: 9,  year: 2026 },
    { id: 't26', date: '2026-09-08', description: 'Electric bill',     category: 'Utilities',     type: 'expense', amount: 1580,  cutoff: 15, month: 9,  year: 2026 },
    { id: 't27', date: '2026-09-07', description: 'Grab rides',        category: 'Transport',     type: 'expense', amount: 620,   cutoff: 15, month: 9,  year: 2026 },
    { id: 't28', date: '2026-09-06', description: 'Savings transfer',  category: 'Savings',       type: 'expense', amount: 8000,  cutoff: 15, month: 9,  year: 2026 },
  ])

  // Derived
  const totalIncome   = computed(() => items.value.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))
  const totalExpenses = computed(() => items.value.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))
  const net           = computed(() => totalIncome.value - totalExpenses.value)

  // CRUD
  function add(tx: Omit<Transaction, 'id'>) {
    items.value.unshift({ id: Date.now().toString(), ...tx })
  }

  function update(id: string, tx: Omit<Transaction, 'id'>) {
    const idx = items.value.findIndex(t => t.id === id)
    if (idx !== -1) items.value[idx] = { id, ...tx }
  }

  function remove(id: string) {
    items.value = items.value.filter(t => t.id !== id)
  }

  // Recent N items sorted by date desc (for Overview)
  function recent(n = 8) {
    return [...items.value]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, n)
  }

  // All transactions for a specific period
  function forPeriod(year: number, month: number, cutoff: Cutoff) {
    return items.value.filter(t => t.year === year && t.month === month && t.cutoff === cutoff)
  }

  return { items, totalIncome, totalExpenses, net, add, update, remove, recent, forPeriod }
})

// Static fallback (used only where reactive store is unavailable)
export const CATEGORIES = [
  'Income', 'Housing', 'Food', 'Transport', 'Utilities',
  'Health', 'Entertainment', 'Savings', 'Others',
]

// ---------------------------------------------------------------------------
// Settings store
// ---------------------------------------------------------------------------
export interface AppSettings {
  appName: string
  currency: string
  dateFormat: string
  theme: 'light' | 'dark'
  cutoff1: number   // first cutoff day (default 15)
  cutoff2: number   // second cutoff day (default 30)
}

const DEFAULT_CATEGORIES = [...CATEGORIES]

const DEFAULT_SETTINGS: AppSettings = {
  appName:    'BudgetTracker',
  currency:   'PHP',
  dateFormat: 'MMM D, YYYY',
  theme:      'light',
  cutoff1:    15,
  cutoff2:    30,
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings   = ref<AppSettings>(loadFromStorage('bt_settings', { ...DEFAULT_SETTINGS }))
  const categories = ref<string[]>(loadFromStorage('bt_categories', [...DEFAULT_CATEGORIES]))

  function saveSettings(patch: Partial<AppSettings>) {
    Object.assign(settings.value, patch)
    localStorage.setItem('bt_settings', JSON.stringify(settings.value))
  }

  function resetSettings() {
    settings.value = { ...DEFAULT_SETTINGS }
    localStorage.setItem('bt_settings', JSON.stringify(settings.value))
  }

  function addCategory(name: string) {
    const trimmed = name.trim()
    if (!trimmed || categories.value.includes(trimmed)) return false
    categories.value.push(trimmed)
    localStorage.setItem('bt_categories', JSON.stringify(categories.value))
    return true
  }

  function renameCategory(oldName: string, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed || categories.value.includes(trimmed)) return false
    const idx = categories.value.indexOf(oldName)
    if (idx === -1) return false
    categories.value[idx] = trimmed
    localStorage.setItem('bt_categories', JSON.stringify(categories.value))
    return true
  }

  function removeCategory(name: string) {
    categories.value = categories.value.filter(c => c !== name)
    localStorage.setItem('bt_categories', JSON.stringify(categories.value))
  }

  function resetCategories() {
    categories.value = [...DEFAULT_CATEGORIES]
    localStorage.setItem('bt_categories', JSON.stringify(categories.value))
  }

  const expenseCategories = computed(() => categories.value.filter(c => c !== 'Income'))

  // Built-in categories that cannot be deleted
  const builtInCategories = DEFAULT_CATEGORIES

  return {
    settings, categories, expenseCategories, builtInCategories,
    saveSettings, resetSettings,
    addCategory, renameCategory, removeCategory, resetCategories,
  }
})

// ---------------------------------------------------------------------------
// Budget store — replaces local BudgetItem[] in BudgetView and static BUDGET_SNAPSHOTS
// ---------------------------------------------------------------------------
export const useBudgetStore = defineStore('budgets', () => {
  const items = ref<BudgetItem[]>([
    // Nov 2026 — 15th
    { id: 'b1',  category: 'Housing',       planned: 12000, actual: 12000, cutoff: 15, month: 11, year: 2026 },
    { id: 'b2',  category: 'Food',          planned: 5000,  actual: 4320,  cutoff: 15, month: 11, year: 2026 },
    { id: 'b3',  category: 'Transport',     planned: 2000,  actual: 2450,  cutoff: 15, month: 11, year: 2026 },
    { id: 'b4',  category: 'Utilities',     planned: 1800,  actual: 1650,  cutoff: 15, month: 11, year: 2026 },
    { id: 'b5',  category: 'Health',        planned: 1500,  actual: 800,   cutoff: 15, month: 11, year: 2026 },
    { id: 'b6',  category: 'Entertainment', planned: 1000,  actual: 1200,  cutoff: 15, month: 11, year: 2026 },
    { id: 'b7',  category: 'Savings',       planned: 8000,  actual: 8000,  cutoff: 15, month: 11, year: 2026 },
    // Oct 2026 — 30th
    { id: 'b8',  category: 'Food',          planned: 3000,  actual: 1800,  cutoff: 30, month: 10, year: 2026 },
    { id: 'b9',  category: 'Health',        planned: 1500,  actual: 800,   cutoff: 30, month: 10, year: 2026 },
    { id: 'b10', category: 'Transport',     planned: 800,   actual: 500,   cutoff: 30, month: 10, year: 2026 },
    // Oct 2026 — 15th
    { id: 'b11', category: 'Housing',       planned: 12000, actual: 12000, cutoff: 15, month: 10, year: 2026 },
    { id: 'b12', category: 'Food',          planned: 5000,  actual: 2300,  cutoff: 15, month: 10, year: 2026 },
    { id: 'b13', category: 'Utilities',     planned: 1800,  actual: 1720,  cutoff: 15, month: 10, year: 2026 },
    { id: 'b14', category: 'Health',        planned: 1500,  actual: 1200,  cutoff: 15, month: 10, year: 2026 },
    { id: 'b15', category: 'Savings',       planned: 8000,  actual: 8000,  cutoff: 15, month: 10, year: 2026 },
    // Sep 2026 — 30th
    { id: 'b16', category: 'Food',          planned: 3000,  actual: 2800,  cutoff: 30, month: 9,  year: 2026 },
    { id: 'b17', category: 'Entertainment', planned: 1000,  actual: 1500,  cutoff: 30, month: 9,  year: 2026 },
    { id: 'b18', category: 'Transport',     planned: 800,   actual: 500,   cutoff: 30, month: 9,  year: 2026 },
    // Sep 2026 — 15th
    { id: 'b19', category: 'Housing',       planned: 12000, actual: 12000, cutoff: 15, month: 9,  year: 2026 },
    { id: 'b20', category: 'Food',          planned: 5000,  actual: 1950,  cutoff: 15, month: 9,  year: 2026 },
    { id: 'b21', category: 'Utilities',     planned: 1800,  actual: 1580,  cutoff: 15, month: 9,  year: 2026 },
    { id: 'b22', category: 'Transport',     planned: 2000,  actual: 620,   cutoff: 15, month: 9,  year: 2026 },
    { id: 'b23', category: 'Savings',       planned: 8000,  actual: 8000,  cutoff: 15, month: 9,  year: 2026 },
  ])

  function forPeriod(year: number, month: number, cutoff: Cutoff) {
    return items.value.filter(b => b.year === year && b.month === month && b.cutoff === cutoff)
  }

  function add(item: Omit<BudgetItem, 'id'>) {
    items.value.push({ id: Date.now().toString(), ...item })
  }

  function update(id: string, item: Omit<BudgetItem, 'id'>) {
    const idx = items.value.findIndex(b => b.id === id)
    if (idx !== -1) items.value[idx] = { id, ...item }
  }

  function remove(id: string) {
    items.value = items.value.filter(b => b.id !== id)
  }

  return { items, forPeriod, add, update, remove }
})

// ---------------------------------------------------------------------------
// Shared currency formatter — reads from settings store at call time
// ---------------------------------------------------------------------------
export function formatCurrency(value: number, currency = 'PHP'): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(value)
}
