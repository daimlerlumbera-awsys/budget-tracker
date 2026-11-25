import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: { key: string; value: string }[] = [
  { key: 'app_name',    value: 'Budget Tracker' },
  { key: 'currency',    value: 'PHP'            },
  { key: 'date_format', value: 'MM/DD/YYYY'     },
  { key: 'theme',       value: 'system'         },
]

const DEFAULT_CATEGORIES: { name: string; type: 'income' | 'expense' }[] = [
  { name: 'Salary',        type: 'income'  },
  { name: 'Freelance',     type: 'income'  },
  { name: 'Bonus',         type: 'income'  },
  { name: 'Housing',       type: 'expense' },
  { name: 'Food',          type: 'expense' },
  { name: 'Transport',     type: 'expense' },
  { name: 'Utilities',     type: 'expense' },
  { name: 'Health',        type: 'expense' },
  { name: 'Entertainment', type: 'expense' },
  { name: 'Savings',       type: 'expense' },
  { name: 'Others',        type: 'expense' },
]

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Seeds default settings and categories for a newly authenticated user.
 * Idempotent: existing records are never overwritten or duplicated.
 * Must be called with an active Supabase session.
 */
export async function seedUser(userId: string): Promise<void> {
  await Promise.all([
    seedSettings(userId),
    seedCategories(userId),
  ])
}

async function seedSettings(userId: string): Promise<void> {
  const rows = DEFAULT_SETTINGS.map(({ key, value }) => ({
    user_id: userId,
    key,
    value,
  }))

  const { error } = await supabase
    .from('settings')
    .upsert(rows, { onConflict: 'user_id,key', ignoreDuplicates: true })

  if (error) throw new Error(`seedSettings: ${error.message}`)
}

async function seedCategories(userId: string): Promise<void> {
  // Fetch existing active category names for this user
  const { data: existing, error: fetchError } = await supabase
    .from('categories')
    .select('name')
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (fetchError) throw new Error(`seedCategories fetch: ${fetchError.message}`)

  const existingNames = new Set(
    (existing ?? []).map((r: { name: string }) => r.name.toLowerCase()),
  )

  const missing = DEFAULT_CATEGORIES.filter(
    ({ name }) => !existingNames.has(name.toLowerCase()),
  )

  if (missing.length === 0) return

  const rows = missing.map(({ name, type }) => ({
    user_id:    userId,
    name,
    type,
    is_builtin: true,
  }))

  const { error } = await supabase.from('categories').insert(rows)

  if (error) {
    if (error.code !== '23505') {
      throw new Error(`seedCategories insert: ${error.message}`)
    }

    // 23505 = unique_violation from a concurrent init — verify all defaults now exist
    const { data: recheck, error: recheckError } = await supabase
      .from('categories')
      .select('name')
      .eq('user_id', userId)
      .is('deleted_at', null)

    if (recheckError) throw new Error(`seedCategories recheck: ${recheckError.message}`)

    const recheckNames = new Set(
      (recheck ?? []).map((r: { name: string }) => r.name.toLowerCase()),
    )

    const stillMissing = DEFAULT_CATEGORIES.filter(
      ({ name }) => !recheckNames.has(name.toLowerCase()),
    )

    if (stillMissing.length > 0) {
      throw new Error(
        `seedCategories: unique violation but categories still missing after recheck: ${stillMissing.map(c => c.name).join(', ')}`,
      )
    }
  }
}
