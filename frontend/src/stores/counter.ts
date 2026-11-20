import { ref, computed, onScopeDispose } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type CutoffPeriod = 'A' | 'B' | 'C'
export type Cutoff = CutoffPeriod

export interface Transaction {
  id: string
  date: string            // ISO date string YYYY-MM-DD
  description: string
  category: string        // display name, resolved from categories join
  category_id: string     // UUID FK → categories.id
  type: 'income' | 'expense'
  amount: number          // always positive; sign derived from type
  cutoff_period: CutoffPeriod
  cutoff: Cutoff          // alias of cutoff_period for period helpers
  month: number           // 1-based, derived from date
  year: number            // derived from date
  notes?: string
}

export interface BudgetItem {
  id: string
  category_id?: string
  category: string
  planned: number    // user-set budget plan
  actual: number     // derived from expense transactions; never persisted
  cutoff: Cutoff
  month: number      // 1-based
  year: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine the cutoff period label (A/B/C) from a date and the two configured
 * cutoff end-days. Period A: day 1 → cutoff1. Period B: cutoff1+1 → cutoff2.
 * Period C: cutoff2+1 → end of month.
 */
export function deriveCutoffPeriod(
  date: string,
  cutoff1: number,
  cutoff2: number,
): CutoffPeriod {
  const day = new Date(date).getUTCDate()
  if (day <= cutoff1) return 'A'
  if (day <= cutoff2) return 'B'
  return 'C'
}

export function cutoffPeriodBounds(
  period: CutoffPeriod,
  cutoff1: number,
  cutoff2: number,
  year: number,
  month: number,
): { start: number; end: number } {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (period === 'A') return { start: 1, end: cutoff1 }
  if (period === 'B') return { start: cutoff1 + 1, end: cutoff2 }
  return { start: cutoff2 + 1, end: daysInMonth }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useTransactionStore = defineStore('transactions', () => {
  const items               = ref<Transaction[]>([])
  const transactionsLoading = ref(false)
  const transactionsLoaded  = ref(false)
  const transactionsError   = ref<string | null>(null)
  const transactionsRequestedUserId = ref<string | null>(null)
  const transactionsUserId  = ref<string | null>(null)
  let   _txGeneration       = 0

  // Derived
  const totalIncome   = computed(() => items.value.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))
  const totalExpenses = computed(() => items.value.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))
  const net           = computed(() => totalIncome.value - totalExpenses.value)

  // ---------------------------------------------------------------------------
  // DB row → Transaction
  // ---------------------------------------------------------------------------
  type DbRow = {
    id: string
    date: string
    description: string
    notes: string | null
    type: 'income' | 'expense'
    amount: number
    cutoff_period: CutoffPeriod
    category_id: string
    categories: { name: string } | null
  }

  function rowToTransaction(row: DbRow): Transaction {
    const d = new Date(row.date)
    return {
      id:            row.id,
      date:          row.date,
      description:   row.description,
      notes:         row.notes ?? undefined,
      type:          row.type,
      amount:        row.amount,
      cutoff_period: row.cutoff_period,
      cutoff:        row.cutoff_period,
      month:         d.getUTCMonth() + 1,
      year:          d.getUTCFullYear(),
      category_id:   row.category_id,
      category:      row.categories?.name ?? '',
    }
  }

  function isCurrentTransactionOwner(userId: string, generation: number): boolean {
    return !transactionsLoading.value &&
      generation === _txGeneration &&
      transactionsRequestedUserId.value === userId &&
      transactionsUserId.value === userId &&
      transactionsLoaded.value
  }

  async function verifyTransactionOwner(
    userId: string,
    generation: number,
  ): Promise<{ current: boolean; error?: string }> {
    if (!isCurrentTransactionOwner(userId, generation)) {
      return { current: false, error: 'Transactions are no longer loaded for this user.' }
    }

    const { data, error } = await supabase.auth.getSession()
    if (error) return { current: false, error: error.message }

    if (data.session?.user.id !== userId || !isCurrentTransactionOwner(userId, generation)) {
      return { current: false, error: 'The authenticated user changed; the transaction response was discarded.' }
    }
    return { current: true }
  }

  function clearTransactions(): void {
    _txGeneration++
    items.value = []
    transactionsLoading.value = false
    transactionsLoaded.value = false
    transactionsError.value = null
    transactionsRequestedUserId.value = null
    transactionsUserId.value = null
  }

  const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    const activeUserId = session?.user.id ?? null
    const trackedUserId = transactionsRequestedUserId.value ?? transactionsUserId.value
    if (trackedUserId && trackedUserId !== activeUserId) clearTransactions()
  })
  onScopeDispose(() => authSubscription.unsubscribe())

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------
  async function loadTransactions(userId: string): Promise<void> {
    const generation = ++_txGeneration

    if (transactionsUserId.value !== userId) {
      items.value              = []
      transactionsLoaded.value = false
      transactionsUserId.value = null
    }
    transactionsRequestedUserId.value = userId
    transactionsLoading.value = true
    transactionsError.value   = null

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, date, description, notes, type, amount, cutoff_period, category_id, categories(name)')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .overrideTypes<DbRow[]>()

      if (generation !== _txGeneration) return
      if (error) { transactionsError.value = error.message; return }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (generation !== _txGeneration) return
      if (sessionError) { transactionsError.value = sessionError.message; return }
      if (sessionData.session?.user.id !== userId) {
        clearTransactions()
        return
      }

      items.value              = (data ?? []).map(rowToTransaction)
      transactionsLoaded.value = true
      transactionsUserId.value = userId
    } catch (e) {
      if (generation !== _txGeneration) return
      transactionsError.value = e instanceof Error ? e.message : 'Failed to load transactions.'
    } finally {
      if (generation === _txGeneration) {
        transactionsLoading.value = false
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Add
  // ---------------------------------------------------------------------------
  async function addTransaction(
    payload: {
      description: string
      amount: number
      category_id: string
      type: 'income' | 'expense'
      date: string
      cutoff_period: CutoffPeriod
      notes?: string
    },
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const generation = _txGeneration
    if (!isCurrentTransactionOwner(userId, generation)) {
      return { success: false, error: 'Transactions are no longer loaded for this user.' }
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id:       userId,
          description:   payload.description,
          amount:        payload.amount,
          category_id:   payload.category_id,
          type:          payload.type,
          date:          payload.date,
          cutoff_period: payload.cutoff_period,
          notes:         payload.notes ?? null,
        })
        .select('id, date, description, notes, type, amount, cutoff_period, category_id, categories(name)')
        .single()
        .overrideTypes<DbRow>()

      const owner = await verifyTransactionOwner(userId, generation)
      if (!owner.current) return { success: false, error: owner.error }
      if (error) return { success: false, error: error.message }
      items.value.unshift(rowToTransaction(data))
      return { success: true }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to add transaction.' }
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  async function updateTransaction(
    id: string,
    payload: {
      description: string
      amount: number
      category_id: string
      type: 'income' | 'expense'
      date: string
      cutoff_period: CutoffPeriod
      notes?: string
    },
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const generation = _txGeneration
    if (!isCurrentTransactionOwner(userId, generation)) {
      return { success: false, error: 'Transactions are no longer loaded for this user.' }
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .update({
          description:   payload.description,
          amount:        payload.amount,
          category_id:   payload.category_id,
          type:          payload.type,
          date:          payload.date,
          cutoff_period: payload.cutoff_period,
          notes:         payload.notes ?? null,
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select('id, date, description, notes, type, amount, cutoff_period, category_id, categories(name)')
        .overrideTypes<DbRow[]>()

      const owner = await verifyTransactionOwner(userId, generation)
      if (!owner.current) return { success: false, error: owner.error }
      if (error) return { success: false, error: error.message }
      if (!data || data.length === 0) return { success: false, error: 'Transaction not found in database.' }

      const updated = rowToTransaction(data[0]!)
      const idx = items.value.findIndex(t => t.id === id)
      if (idx !== -1) items.value[idx] = updated
      return { success: true }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to update transaction.' }
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  async function deleteTransaction(
    id: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const generation = _txGeneration
    if (!isCurrentTransactionOwner(userId, generation)) {
      return { success: false, error: 'Transactions are no longer loaded for this user.' }
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .select('id')

      const owner = await verifyTransactionOwner(userId, generation)
      if (!owner.current) return { success: false, error: owner.error }
      if (error) return { success: false, error: error.message }
      if (!data || data.length === 0) return { success: false, error: 'Transaction not found in database.' }

      items.value = items.value.filter(t => t.id !== id)
      return { success: true }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to delete transaction.' }
    }
  }

  // ---------------------------------------------------------------------------
  // Read helpers (backward-compatible with Overview + Budget)
  // ---------------------------------------------------------------------------
  function recent(n = 8) {
    return [...items.value]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, n)
  }

  function forPeriod(year: number, month: number, cutoff: Cutoff) {
    return items.value.filter(t => t.year === year && t.month === month && t.cutoff === cutoff)
  }

  return {
    items, totalIncome, totalExpenses, net,
    transactionsLoading, transactionsLoaded, transactionsError,
    transactionsRequestedUserId, transactionsUserId,
    loadTransactions, clearTransactions, addTransaction, updateTransaction, deleteTransaction,
    recent, forPeriod,
  }
})

// ---------------------------------------------------------------------------
// Settings store
// ---------------------------------------------------------------------------
export interface AppSettings {
  appName: string
  currency: string
  dateFormat: string
  theme: 'light' | 'dark' | 'system'
  cutoff1: number   // first cutoff day (maps to cutoff_a_end)
  cutoff2: number   // second cutoff day (maps to cutoff_b_end)
}

export interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  is_builtin: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  appName:    'Budget Tracker',
  currency:   'PHP',
  dateFormat: 'MM/DD/YYYY',
  theme:      'system',
  cutoff1:    10,
  cutoff2:    25,
}

// ---------------------------------------------------------------------------
// DB key ↔ store field mapping
// ---------------------------------------------------------------------------
type DbKey = 'app_name' | 'currency' | 'date_format' | 'theme' | 'cutoff_a_end' | 'cutoff_b_end'

function dbRowsToSettings(rows: { key: string; value: string }[]): Partial<AppSettings> {
  const patch: Partial<AppSettings> = {}
  for (const { key, value } of rows) {
    switch (key as DbKey) {
      case 'app_name':     patch.appName    = value; break
      case 'currency':     patch.currency   = value; break
      case 'date_format':  patch.dateFormat = value; break
      case 'theme':        patch.theme      = value as AppSettings['theme']; break
      case 'cutoff_a_end': patch.cutoff1    = Number(value); break
      case 'cutoff_b_end': patch.cutoff2    = Number(value); break
    }
  }
  return patch
}

function settingsPatchToRows(
  userId: string,
  patch: Partial<AppSettings>,
): { user_id: string; key: string; value: string }[] {
  const rows: { user_id: string; key: string; value: string }[] = []
  if (patch.appName    !== undefined) rows.push({ user_id: userId, key: 'app_name',     value: patch.appName })
  if (patch.currency   !== undefined) rows.push({ user_id: userId, key: 'currency',     value: patch.currency })
  if (patch.dateFormat !== undefined) rows.push({ user_id: userId, key: 'date_format',  value: patch.dateFormat })
  if (patch.theme      !== undefined) rows.push({ user_id: userId, key: 'theme',        value: patch.theme })
  if (patch.cutoff1    !== undefined) rows.push({ user_id: userId, key: 'cutoff_a_end', value: String(patch.cutoff1) })
  if (patch.cutoff2    !== undefined) rows.push({ user_id: userId, key: 'cutoff_b_end', value: String(patch.cutoff2) })
  return rows
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
  const settings            = ref<AppSettings>(loadFromStorage('bt_settings', { ...DEFAULT_SETTINGS }))
  const categories          = ref<Category[]>([])
  const settingsLoading     = ref(false)
  const settingsLoaded      = ref(false)
  const settingsUserId      = ref<string | null>(null)
  const settingsLoadingUserId = ref<string | null>(null)
  const settingsError       = ref<string | null>(null)
  const categoriesLoading   = ref(false)
  const categoriesLoaded    = ref(false)
  const categoriesError     = ref<string | null>(null)
  const categoriesUserId    = ref<string | null>(null)
  let   _categoriesGeneration = 0
  let   _settingsGeneration  = 0

  async function loadSettings(userId: string): Promise<void> {
    const generation = ++_settingsGeneration
    if (settingsUserId.value !== userId) {
      settings.value = { ...DEFAULT_SETTINGS }
      settingsUserId.value = null
    }
    settingsLoading.value = true
    settingsLoadingUserId.value = userId
    settingsLoaded.value  = false
    settingsError.value   = null
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .eq('user_id', userId)
      if (generation !== _settingsGeneration) return
      if (error) { settingsError.value = error.message; return }
      if (data && data.length > 0) {
        const patch = dbRowsToSettings(data as { key: string; value: string }[])
        Object.assign(settings.value, patch)
      }
      settingsLoaded.value = true
      settingsUserId.value = userId
    } catch (e) {
      if (generation !== _settingsGeneration) return
      settingsError.value = e instanceof Error ? e.message : 'Failed to load settings.'
    } finally {
      if (generation === _settingsGeneration) {
        settingsLoading.value = false
        settingsLoadingUserId.value = null
      }
    }
  }

  async function saveSettings(patch: Partial<AppSettings>, userId?: string): Promise<void> {
    if (!userId) {
      settingsError.value = 'Cannot save settings: no authenticated user.'
      return
    }

    const generation = ++_settingsGeneration
    settingsLoading.value = true
    settingsLoadingUserId.value = userId
    settingsError.value   = null

    try {
      const rows = settingsPatchToRows(userId, patch)
      if (rows.length > 0) {
        const { error } = await supabase
          .from('settings')
          .upsert(rows, { onConflict: 'user_id,key', ignoreDuplicates: false })
        if (generation !== _settingsGeneration) return
        if (error) {
          settingsError.value = error.message
          return
        }
      }
      // Commit to reactive state only after confirmed save
      Object.assign(settings.value, patch)
    } catch (e) {
      if (generation !== _settingsGeneration) return
      settingsError.value = e instanceof Error ? e.message : 'Failed to save settings.'
    } finally {
      if (generation === _settingsGeneration) {
        settingsLoading.value = false
        settingsLoadingUserId.value = null
      }
    }
  }

  function resetSettings() {
    settings.value = { ...DEFAULT_SETTINGS }
    localStorage.setItem('bt_settings', JSON.stringify(settings.value))
  }

  async function loadCategories(userId: string): Promise<void> {
    // Claim this request's generation slot; any earlier in-flight request is now stale
    const generation = ++_categoriesGeneration

    // Clear stale data when switching users
    if (categoriesUserId.value !== userId) {
      categories.value       = []
      categoriesLoaded.value = false
      categoriesUserId.value = null
    }
    categoriesLoading.value = true
    categoriesError.value   = null

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, type, is_builtin')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('is_builtin', { ascending: false })
        .order('name', { ascending: true })

      // Discard if a newer request has already started
      if (generation !== _categoriesGeneration) return

      if (error) { categoriesError.value = error.message; return }
      categories.value       = (data ?? []) as Category[]
      categoriesLoaded.value = true
      categoriesUserId.value = userId
    } catch (e) {
      if (generation !== _categoriesGeneration) return
      categoriesError.value = e instanceof Error ? e.message : 'Failed to load categories.'
    } finally {
      // Only the owner of the latest generation clears the loading flag
      if (generation === _categoriesGeneration) {
        categoriesLoading.value = false
      }
    }
  }

  async function addCategory(
    name: string,
    type: 'income' | 'expense',
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const trimmed = name.trim()
    if (!trimmed) return { success: false, error: 'Name cannot be empty.' }
    const duplicate = categories.value.some(
      c => c.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (duplicate) return { success: false, error: 'A category with that name already exists.' }

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({ user_id: userId, name: trimmed, type, is_builtin: false })
        .select('id, name, type, is_builtin')
        .single()

      if (error) return { success: false, error: error.message }
      categories.value.push(data as Category)
      return { success: true }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to add category.' }
    }
  }

  async function renameCategory(
    id: string,
    newName: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const trimmed = newName.trim()
    if (!trimmed) return { success: false, error: 'Name cannot be empty.' }

    const target = categories.value.find(c => c.id === id)
    if (!target) return { success: false, error: 'Category not found.' }
    if (target.is_builtin) return { success: false, error: 'Built-in categories cannot be renamed.' }

    const duplicate = categories.value.some(
      c => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (duplicate) return { success: false, error: 'A category with that name already exists.' }

    try {
      const { data, error } = await supabase
        .from('categories')
        .update({ name: trimmed })
        .eq('id', id)
        .eq('user_id', userId)
        .select('id')

      if (error) return { success: false, error: error.message }
      if (!data || data.length === 0) return { success: false, error: 'Category not found in database.' }
      target.name = trimmed
      return { success: true }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to rename category.' }
    }
  }

  async function removeCategory(
    id: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const target = categories.value.find(c => c.id === id)
    if (!target) return { success: false, error: 'Category not found.' }
    if (target.is_builtin) return { success: false, error: 'Built-in categories cannot be deleted.' }

    try {
      const { data, error } = await supabase
        .from('categories')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .select('id')

      if (error) return { success: false, error: error.message }
      if (!data || data.length === 0) return { success: false, error: 'Category not found in database.' }
      categories.value = categories.value.filter(c => c.id !== id)
      return { success: true }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to delete category.' }
    }
  }

  const expenseCategories = computed(() =>
    categories.value.filter(c => c.type === 'expense'),
  )

  const builtInCategories = computed(() =>
    categories.value.filter(c => c.is_builtin),
  )

  return {
    settings, categories, settingsLoading, settingsLoaded,
    settingsUserId, settingsLoadingUserId, settingsError,
    categoriesLoading, categoriesLoaded, categoriesError, categoriesUserId,
    expenseCategories, builtInCategories,
    loadSettings, saveSettings, resetSettings,
    loadCategories, addCategory, renameCategory, removeCategory,
  }
})

// ---------------------------------------------------------------------------
// Budget store
// ---------------------------------------------------------------------------
export const useBudgetStore = defineStore('budgets', () => {
  interface BudgetPlan {
    id: string
    category_id: string
    category: string
    planned: number
    cutoff: Cutoff
    month: number
    year: number
  }

  const plans = ref<BudgetPlan[]>([])
  const budgetsLoading = ref(false)
  const budgetsLoaded = ref(false)
  const budgetsError = ref<string | null>(null)
  const budgetsRequestedUserId = ref<string | null>(null)
  const budgetsUserId = ref<string | null>(null)
  const transactionStore = useTransactionStore()
  let _budgetGeneration = 0
  let _budgetLoadTimer: ReturnType<typeof setTimeout> | null = null
  let _budgetLoadPromise: Promise<void> | null = null
  let _budgetLoadPromiseUserId: string | null = null
  let _budgetMutationsInFlight = 0
  let _budgetMutationWaiters: Array<() => void> = []

  const items = computed<BudgetItem[]>(() => {
    const expenseTotals = new Map<string, number>()
    const transactions = transactionStore.transactionsUserId === budgetsUserId.value
      ? transactionStore.items
      : []

    for (const transaction of transactions) {
      if (transaction.type !== 'expense') continue
      const key = `${transaction.category_id}:${transaction.year}:${transaction.month}:${transaction.cutoff}`
      expenseTotals.set(key, (expenseTotals.get(key) ?? 0) + transaction.amount)
    }

    return plans.value.map(plan => ({
      ...plan,
      actual: expenseTotals.get(
        `${plan.category_id}:${plan.year}:${plan.month}:${plan.cutoff}`,
      ) ?? 0,
    }))
  })

  type DbRow = {
    id: string
    user_id: string
    category_id: string
    amount: number
    month: number
    year: number
    cutoff_period: CutoffPeriod
    categories: { name: string } | null
  }

  function rowToBudget(row: DbRow): BudgetPlan {
    return {
      id: row.id,
      category_id: row.category_id,
      category: row.categories?.name ?? '',
      planned: row.amount,
      cutoff: row.cutoff_period,
      month: row.month,
      year: row.year,
    }
  }

  function isCurrentBudgetOwner(userId: string, generation: number): boolean {
    return !budgetsLoading.value &&
      generation === _budgetGeneration &&
      budgetsRequestedUserId.value === userId &&
      budgetsUserId.value === userId &&
      budgetsLoaded.value
  }

  async function verifyBudgetOwner(
    userId: string,
    generation: number,
  ): Promise<{ current: boolean; error?: string }> {
    if (!isCurrentBudgetOwner(userId, generation)) {
      return { current: false, error: 'Budgets are no longer loaded for this user.' }
    }

    const { data, error } = await supabase.auth.getSession()
    if (error) return { current: false, error: error.message }

    if (data.session?.user.id !== userId || !isCurrentBudgetOwner(userId, generation)) {
      return { current: false, error: 'The authenticated user changed; the budget response was discarded.' }
    }
    return { current: true }
  }

  function clearBudgets(): void {
    _budgetGeneration++
    plans.value = []
    budgetsLoading.value = false
    budgetsLoaded.value = false
    budgetsError.value = null
    budgetsRequestedUserId.value = null
    budgetsUserId.value = null
    _budgetLoadPromise = null
    _budgetLoadPromiseUserId = null
  }

  function waitForBudgetMutations(): Promise<void> {
    if (_budgetMutationsInFlight === 0) return Promise.resolve()
    return new Promise(resolve => _budgetMutationWaiters.push(resolve))
  }

  function beginBudgetMutation(): () => void {
    _budgetMutationsInFlight++
    let finished = false
    return () => {
      if (finished) return
      finished = true
      _budgetMutationsInFlight--
      if (_budgetMutationsInFlight === 0) {
        const waiters = _budgetMutationWaiters
        _budgetMutationWaiters = []
        waiters.forEach(resolve => resolve())
      }
    }
  }

  function loadBudgets(userId: string): Promise<void> {
    if (_budgetLoadPromise && _budgetLoadPromiseUserId === userId) {
      return _budgetLoadPromise
    }

    const requestGeneration = _budgetGeneration
    const promise = loadBudgetsAfterMutations(userId, requestGeneration)
    _budgetLoadPromise = promise
    _budgetLoadPromiseUserId = userId
    void promise.then(() => {
      if (_budgetLoadPromise === promise) {
        _budgetLoadPromise = null
        _budgetLoadPromiseUserId = null
      }
    }, () => {
      if (_budgetLoadPromise === promise) {
        _budgetLoadPromise = null
        _budgetLoadPromiseUserId = null
      }
    })
    return promise
  }

  async function loadBudgetsAfterMutations(
    userId: string,
    requestGeneration: number,
  ): Promise<void> {
    try {
      while (true) {
        await waitForBudgetMutations()
        if (requestGeneration !== _budgetGeneration) return

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (requestGeneration !== _budgetGeneration) return
        if (sessionError) {
          budgetsError.value = sessionError.message
          return
        }
        if (sessionData.session?.user.id !== userId) {
          if (budgetsRequestedUserId.value === userId || budgetsUserId.value === userId) {
            clearBudgets()
          }
          return
        }
        if (_budgetMutationsInFlight > 0) continue

        await performBudgetLoad(userId)
        return
      }
    } catch (e) {
      if (requestGeneration === _budgetGeneration) {
        budgetsError.value = e instanceof Error ? e.message : 'Failed to load budgets.'
      }
    }
  }

  async function performBudgetLoad(userId: string): Promise<void> {
    const generation = ++_budgetGeneration
    if (budgetsUserId.value !== userId) {
      plans.value = []
      budgetsLoaded.value = false
      budgetsUserId.value = null
    }
    budgetsRequestedUserId.value = userId
    budgetsLoading.value = true
    budgetsError.value = null

    try {
      const { data, error } = await supabase
        .from('budget_items')
        .select('id, user_id, category_id, amount, month, year, cutoff_period, categories(name)')
        .eq('user_id', userId)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .order('cutoff_period', { ascending: true })
        .overrideTypes<DbRow[]>()

      if (generation !== _budgetGeneration) return
      if (error) { budgetsError.value = error.message; return }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (generation !== _budgetGeneration) return
      if (sessionError) { budgetsError.value = sessionError.message; return }
      if (sessionData.session?.user.id !== userId) {
        clearBudgets()
        return
      }

      plans.value = (data ?? []).map(rowToBudget)
      budgetsLoaded.value = true
      budgetsUserId.value = userId
    } catch (e) {
      if (generation !== _budgetGeneration) return
      budgetsError.value = e instanceof Error ? e.message : 'Failed to load budgets.'
    } finally {
      if (generation === _budgetGeneration) {
        budgetsLoading.value = false
      }
    }
  }

  const { data: { subscription: budgetAuthSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    const activeUserId = session?.user.id ?? null
    const trackedUserId = budgetsRequestedUserId.value ?? budgetsUserId.value

    if (!activeUserId) {
      if (_budgetLoadTimer) clearTimeout(_budgetLoadTimer)
      _budgetLoadTimer = null
      if (trackedUserId || plans.value.length > 0) clearBudgets()
      return
    }
    if (
      trackedUserId === activeUserId &&
      (budgetsLoading.value || budgetsLoaded.value)
    ) return

    if (_budgetLoadTimer) clearTimeout(_budgetLoadTimer)
    clearBudgets()
    _budgetLoadTimer = setTimeout(() => {
      _budgetLoadTimer = null
      void loadBudgets(activeUserId)
      if (
        transactionStore.transactionsUserId !== activeUserId ||
        !transactionStore.transactionsLoaded
      ) {
        if (
          !transactionStore.transactionsLoading ||
          transactionStore.transactionsRequestedUserId !== activeUserId
        ) {
          void transactionStore.loadTransactions(activeUserId)
        }
      }
    }, 0)
  })
  onScopeDispose(() => {
    if (_budgetLoadTimer) clearTimeout(_budgetLoadTimer)
    _budgetGeneration++
    budgetAuthSubscription.unsubscribe()
  })

  async function resolveCategoryId(
    item: Omit<BudgetItem, 'id'>,
    userId: string,
  ): Promise<string> {
    if (item.category_id) {
      const { data, error } = await supabase
        .from('categories')
        .select('id')
        .eq('id', item.category_id)
        .eq('user_id', userId)
        .eq('type', 'expense')
        .maybeSingle()
        .overrideTypes<{ id: string }>()

      if (error) throw new Error(`Unable to validate the selected expense category: ${error.message}`)
      if (!data) {
        throw new Error('The selected category is invalid or is not an expense category owned by the current user.')
      }
      return data.id
    }

    const settingsStore = useSettingsStore()
    if (settingsStore.categoriesUserId === userId && settingsStore.categoriesLoaded) {
      const category = settingsStore.categories.find(
        candidate => candidate.name === item.category && candidate.type === 'expense',
      )
      if (category) return category.id
    }

    const { data, error } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .eq('name', item.category)
      .eq('type', 'expense')
      .is('deleted_at', null)
      .maybeSingle()
      .overrideTypes<{ id: string }>()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('The selected expense category was not found.')
    return data.id
  }

  async function getBudgetMutationOwner(userId?: string): Promise<{ userId: string; generation: number }> {
    const generation = _budgetGeneration
    const { data, error } = await supabase.auth.getSession()
    if (error) throw new Error(error.message)

    const activeUserId = data.session?.user.id
    const resolvedUserId = userId ?? activeUserId
    if (!resolvedUserId || resolvedUserId !== activeUserId) {
      throw new Error('The authenticated user changed; the budget operation was cancelled.')
    }
    if (!isCurrentBudgetOwner(resolvedUserId, generation)) {
      throw new Error('Budgets are not loaded for the current user.')
    }
    return { userId: resolvedUserId, generation }
  }

  function forPeriod(year: number, month: number, cutoff: Cutoff) {
    return items.value.filter(b => b.year === year && b.month === month && b.cutoff === cutoff)
  }

  async function add(
    item: Omit<BudgetItem, 'id'>,
    userId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const generation = _budgetGeneration
    const finishMutation = beginBudgetMutation()
    try {
      const owner = await getBudgetMutationOwner(userId)
      const categoryId = await resolveCategoryId(item, owner.userId)
      const currentOwner = await verifyBudgetOwner(owner.userId, owner.generation)
      if (!currentOwner.current) throw new Error(currentOwner.error)

      const { data, error } = await supabase
        .from('budget_items')
        .insert({
          user_id: owner.userId,
          category_id: categoryId,
          amount: item.planned,
          month: item.month,
          year: item.year,
          cutoff_period: item.cutoff,
        })
        .select('id, user_id, category_id, amount, month, year, cutoff_period, categories(name)')
        .single()
        .overrideTypes<DbRow>()

      const verifiedOwner = await verifyBudgetOwner(owner.userId, owner.generation)
      if (!verifiedOwner.current) throw new Error(verifiedOwner.error)
      if (error) {
        const message = error.code === '23505'
          ? 'A budget plan already exists for this category and period. Edit the existing plan instead.'
          : error.message
        if (generation === _budgetGeneration) budgetsError.value = message
        return { success: false, error: message }
      }
      plans.value.push(rowToBudget(data))
      budgetsError.value = null
      return { success: true }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to add budget item.'
      if (generation === _budgetGeneration) budgetsError.value = message
      return { success: false, error: message }
    } finally {
      finishMutation()
    }
  }

  async function update(
    id: string,
    item: Omit<BudgetItem, 'id'>,
    userId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const generation = _budgetGeneration
    const finishMutation = beginBudgetMutation()
    try {
      const owner = await getBudgetMutationOwner(userId)
      const existing = plans.value.find(budget => budget.id === id)
      if (!existing) throw new Error('Budget item not found.')
      const categoryInput = item.category_id
        ? item
        : { ...item, category_id: existing.category === item.category ? existing.category_id : undefined }
      const categoryId = await resolveCategoryId(categoryInput, owner.userId)
      const currentOwner = await verifyBudgetOwner(owner.userId, owner.generation)
      if (!currentOwner.current) throw new Error(currentOwner.error)

      const { data, error } = await supabase
        .from('budget_items')
        .update({
          category_id: categoryId,
          amount: item.planned,
          month: item.month,
          year: item.year,
          cutoff_period: item.cutoff,
        })
        .eq('id', id)
        .eq('user_id', owner.userId)
        .select('id, user_id, category_id, amount, month, year, cutoff_period, categories(name)')
        .overrideTypes<DbRow[]>()

      const verifiedOwner = await verifyBudgetOwner(owner.userId, owner.generation)
      if (!verifiedOwner.current) throw new Error(verifiedOwner.error)
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) throw new Error('Budget item not found in the database.')

      const idx = plans.value.findIndex(budget => budget.id === id)
      if (idx !== -1) plans.value[idx] = rowToBudget(data[0]!)
      budgetsError.value = null
      return { success: true }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update budget item.'
      if (generation === _budgetGeneration) budgetsError.value = message
      return { success: false, error: message }
    } finally {
      finishMutation()
    }
  }

  async function remove(
    id: string,
    userId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const generation = _budgetGeneration
    const finishMutation = beginBudgetMutation()
    try {
      const owner = await getBudgetMutationOwner(userId)
      const { data, error } = await supabase
        .from('budget_items')
        .delete()
        .eq('id', id)
        .eq('user_id', owner.userId)
        .select('id')

      const verifiedOwner = await verifyBudgetOwner(owner.userId, owner.generation)
      if (!verifiedOwner.current) throw new Error(verifiedOwner.error)
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) throw new Error('Budget item not found in the database.')

      plans.value = plans.value.filter(budget => budget.id !== id)
      budgetsError.value = null
      return { success: true }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete budget item.'
      if (generation === _budgetGeneration) budgetsError.value = message
      return { success: false, error: message }
    } finally {
      finishMutation()
    }
  }

  return {
    items,
    budgetsLoading, budgetsLoaded, budgetsError,
    budgetsRequestedUserId, budgetsUserId,
    loadBudgets, clearBudgets, forPeriod, add, update, remove,
  }
})

// ---------------------------------------------------------------------------
// Shared currency formatter — reads from settings store at call time
// ---------------------------------------------------------------------------
export function formatCurrency(value: number, currency = 'PHP'): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(value)
}
