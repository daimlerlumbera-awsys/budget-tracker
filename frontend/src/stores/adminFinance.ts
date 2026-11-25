import { onScopeDispose, ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { cutoffPeriodForDate, type Transaction } from '@/stores/counter'

export interface AdminUser {
  id: string
  email: string
  created_at: string
}

type DbRow = {
  id: string
  date: string
  description: string
  notes: string | null
  type: 'income' | 'expense'
  amount: number
  cutoff_period: string
  category_id: string
  categories: { name: string } | null
}

function rowToTransaction(row: DbRow): Transaction {
  const period = cutoffPeriodForDate(row.date, row.type)
  return {
    id:            row.id,
    date:          row.date,
    description:   row.description,
    notes:         row.notes ?? undefined,
    type:          row.type,
    amount:        Number(row.amount),
    cutoff_period: period.cutoff,
    cutoff:        period.cutoff,
    month:         period.month,
    year:          period.year,
    category_id:   row.category_id,
    category:      row.categories?.name ?? '',
  }
}

/** Lightweight row used for the admin dashboard's cross-user totals. */
export interface AdminTransactionSummaryRow {
  user_id: string
  date: string
  type: 'income' | 'expense'
  amount: number
}

function errorMessage(value: unknown): string {
  if (value && typeof value === 'object' && 'message' in value) {
    return String((value as { message: unknown }).message)
  }
  return 'An unexpected error occurred.'
}

/** Read-only access for admins to any user's incomes and expenses. */
export const useAdminFinanceStore = defineStore('adminFinance', () => {
  const isAdmin       = ref<boolean | null>(null)
  const adminUserId   = ref<string | null>(null)
  const users         = ref<AdminUser[]>([])
  const usersLoading  = ref(false)
  const usersError    = ref<string | null>(null)
  const selectedUserId = ref<string | null>(null)
  const transactions  = ref<Transaction[]>([])
  const txLoading     = ref(false)
  const txError       = ref<string | null>(null)
  const allTransactions = ref<AdminTransactionSummaryRow[]>([])
  const allLoading    = ref(false)
  const allError      = ref<string | null>(null)
  let _usersGeneration = 0
  let _txGeneration    = 0
  let _allGeneration   = 0

  function clearState(): void {
    _usersGeneration++
    _txGeneration++
    _allGeneration++
    allTransactions.value = []
    allLoading.value = false
    allError.value = null
    isAdmin.value = null
    adminUserId.value = null
    users.value = []
    usersLoading.value = false
    usersError.value = null
    selectedUserId.value = null
    transactions.value = []
    txLoading.value = false
    txError.value = null
  }

  async function checkAdmin(userId: string): Promise<boolean> {
    if (adminUserId.value !== userId) clearState()
    if (isAdmin.value !== null) return isAdmin.value
    try {
      const { data, error } = await supabase.rpc('is_bdo_life_admin')
      if (error || typeof data !== 'boolean') return false
      adminUserId.value = userId
      isAdmin.value = data
      return data
    } catch {
      return false
    }
  }

  async function loadUsers(): Promise<void> {
    const generation = ++_usersGeneration
    usersLoading.value = true
    usersError.value = null
    try {
      // admin_list_users returns a set of rows; without generated DB types
      // supabase-js can't infer that, so the result is cast here.
      const { data, error } = await supabase.rpc('admin_list_users')
      if (generation !== _usersGeneration) return
      if (error) { usersError.value = error.message; return }
      const rows = (Array.isArray(data) ? data : []) as AdminUser[]
      // The signed-in admin doesn't need to review their own finances
      users.value = rows.filter(u => u.id !== adminUserId.value)
    } catch (e) {
      if (generation === _usersGeneration) usersError.value = errorMessage(e)
    } finally {
      if (generation === _usersGeneration) usersLoading.value = false
    }
  }

  async function loadUserTransactions(userId: string): Promise<void> {
    const generation = ++_txGeneration
    selectedUserId.value = userId
    transactions.value = []
    txLoading.value = true
    txError.value = null
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, date, description, notes, type, amount, cutoff_period, category_id, categories(name)')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .overrideTypes<DbRow[]>()
      if (generation !== _txGeneration) return
      if (error) { txError.value = error.message; return }
      transactions.value = (data ?? []).map(rowToTransaction)
    } catch (e) {
      if (generation === _txGeneration) txError.value = errorMessage(e)
    } finally {
      if (generation === _txGeneration) txLoading.value = false
    }
  }

  /** Loads every user's transactions (amounts only) for dashboard totals. */
  async function loadAllTransactions(): Promise<void> {
    const generation = ++_allGeneration
    allLoading.value = true
    allError.value = null
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('user_id, date, type, amount')
        .order('date', { ascending: false })
        .overrideTypes<AdminTransactionSummaryRow[]>()
      if (generation !== _allGeneration) return
      if (error) { allError.value = error.message; return }
      allTransactions.value = (data ?? [])
        .filter(row => row.user_id !== adminUserId.value)
        .map(row => ({ ...row, amount: Number(row.amount) }))
    } catch (e) {
      if (generation === _allGeneration) allError.value = errorMessage(e)
    } finally {
      if (generation === _allGeneration) allLoading.value = false
    }
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    const activeUserId = session?.user.id ?? null
    if (adminUserId.value && adminUserId.value !== activeUserId) clearState()
  })
  onScopeDispose(() => subscription.unsubscribe())

  return {
    isAdmin, users, usersLoading, usersError,
    selectedUserId, transactions, txLoading, txError,
    allTransactions, allLoading, allError,
    checkAdmin, loadUsers, loadUserTransactions, loadAllTransactions, clearState,
  }
})
