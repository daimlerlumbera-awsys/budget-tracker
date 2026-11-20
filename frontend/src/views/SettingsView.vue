<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue'
import {
  Save, RotateCcw, Plus, Pencil, Trash2, X, Check,
  AlertTriangle, CheckCircle, ChevronDown,
} from 'lucide-vue-next'
import { useSettingsStore, useTransactionStore, type AppSettings, type Category } from '@/stores/counter'
import { useAuthStore } from '@/stores/auth'

const settingsStore = useSettingsStore()
const txStore       = useTransactionStore()
const authStore     = useAuthStore()

// Load settings and categories from Supabase once per mount; allow retry on failure
let _loadAttempted = false
onMounted(() => triggerLoadSettings())

async function triggerLoadSettings() {
  if (!authStore.user?.id) return
  if (!settingsStore.settingsLoaded && !settingsStore.settingsLoading) {
    _loadAttempted = true
    await settingsStore.loadSettings(authStore.user.id)
  }
  if (!settingsStore.categoriesLoaded && !settingsStore.categoriesLoading) {
    await settingsStore.loadCategories(authStore.user.id)
  }
}

const settingsLoadFailed = computed(
  () => _loadAttempted && !settingsStore.settingsLoaded && !!settingsStore.settingsError,
)

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
const toast = ref<{ message: string; type: 'success' | 'error' } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(message: string, type: 'success' | 'error' = 'success') {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = { message, type }
  toastTimer = setTimeout(() => { toast.value = null }, 3000)
}

// ---------------------------------------------------------------------------
// Section 1 — General Preferences
// ---------------------------------------------------------------------------
const generalForm = reactive<AppSettings>({ ...settingsStore.settings })

// Keep form in sync if settings change externally
watch(() => settingsStore.settings, (s) => Object.assign(generalForm, s), { deep: true })

const currencies   = ['PHP', 'USD', 'EUR', 'SGD', 'JPY', 'GBP']
const dateFormats  = ['MMM D, YYYY', 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']
const themes       = [
  { value: 'light',  label: 'Light'  },
  { value: 'dark',   label: 'Dark'   },
  { value: 'system', label: 'System' },
] as const

async function saveGeneral() {
  if (settingsLoadFailed.value) return
  await settingsStore.saveSettings({ ...generalForm }, authStore.user?.id)
  if (settingsStore.settingsError) {
    showToast(settingsStore.settingsError, 'error')
  } else {
    showToast('General preferences saved.')
  }
}

function cancelGeneral() {
  Object.assign(generalForm, settingsStore.settings)
  showToast('Changes discarded.', 'error')
}

// ---------------------------------------------------------------------------
// Section 2 — Salary Cutoff Settings
// ---------------------------------------------------------------------------
const cutoffForm = reactive({ cutoff1: settingsStore.settings.cutoff1, cutoff2: settingsStore.settings.cutoff2 })
const cutoffErrors = reactive({ cutoff1: '', cutoff2: '' })

watch(() => settingsStore.settings, (s) => {
  cutoffForm.cutoff1 = s.cutoff1
  cutoffForm.cutoff2 = s.cutoff2
}, { deep: true })

function validateCutoff(): boolean {
  cutoffErrors.cutoff1 = ''
  cutoffErrors.cutoff2 = ''
  let ok = true
  const c1 = Number(cutoffForm.cutoff1)
  const c2 = Number(cutoffForm.cutoff2)
  if (!Number.isInteger(c1) || c1 < 1 || c1 > 28) {
    cutoffErrors.cutoff1 = 'Must be 1–28.'; ok = false
  }
  if (!Number.isInteger(c2) || c2 < 1 || c2 > 31) {
    cutoffErrors.cutoff2 = 'Must be 1–31.'; ok = false
  }
  if (ok && c1 >= c2) {
    cutoffErrors.cutoff2 = 'Second cutoff must be after the first.'; ok = false
  }
  return ok
}

const cutoffPreview = computed(() => {
  const c1 = Number(cutoffForm.cutoff1)
  const c2 = Number(cutoffForm.cutoff2)
  if (!c1 || !c2 || c1 >= c2) return []
  return [
    { label: 'Period A', range: `1st – ${c1}th` },
    { label: 'Period B', range: `${c1 + 1}st – ${c2}th` },
  ]
})

async function saveCutoff() {
  if (settingsLoadFailed.value) return
  if (!validateCutoff()) return
  await settingsStore.saveSettings(
    { cutoff1: Number(cutoffForm.cutoff1), cutoff2: Number(cutoffForm.cutoff2) },
    authStore.user?.id,
  )
  if (settingsStore.settingsError) {
    showToast(settingsStore.settingsError, 'error')
  } else {
    showToast('Cutoff settings saved.')
  }
}

// ---------------------------------------------------------------------------
// Section 3 — Budget Categories
// ---------------------------------------------------------------------------
const newCategoryName  = ref('')
const newCategoryType  = ref<'income' | 'expense'>('expense')
const newCategoryError = ref('')

const editingCategory   = ref<string | null>(null)   // category id
const editCategoryName  = ref('')
const editCategoryError = ref('')

const deleteCategoryTarget = ref<Category | null>(null)

function categoryInUse(name: string): boolean {
  return txStore.items.some(t => t.category === name)
}

function startEdit(cat: Category) {
  editingCategory.value  = cat.id
  editCategoryName.value = cat.name
  editCategoryError.value = ''
}

function cancelEdit() {
  editingCategory.value  = null
  editCategoryName.value = ''
  editCategoryError.value = ''
}

async function saveEdit() {
  const id = editingCategory.value
  if (!id || !authStore.user?.id) return
  const result = await settingsStore.renameCategory(id, editCategoryName.value, authStore.user.id)
  if (!result.success) {
    editCategoryError.value = result.error ?? 'Failed to rename category.'
    return
  }
  cancelEdit()
  showToast(`Renamed to "${editCategoryName.value.trim()}".`)
}

async function addCategory() {
  newCategoryError.value = ''
  if (!authStore.user?.id) return
  const result = await settingsStore.addCategory(newCategoryName.value, newCategoryType.value, authStore.user.id)
  if (!result.success) {
    newCategoryError.value = result.error ?? 'Failed to add category.'
    return
  }
  showToast(`"${newCategoryName.value.trim()}" added.`)
  newCategoryName.value = ''
}

function requestDelete(cat: Category) {
  deleteCategoryTarget.value = cat
}

async function confirmCategoryDelete() {
  const cat = deleteCategoryTarget.value
  if (!cat || !authStore.user?.id) return
  const result = await settingsStore.removeCategory(cat.id, authStore.user.id)
  deleteCategoryTarget.value = null
  if (!result.success) {
    showToast(result.error ?? 'Failed to delete category.', 'error')
    return
  }
  showToast(`"${cat.name}" deleted.`)
}

// ---------------------------------------------------------------------------
// Section 4 — Data Management
// ---------------------------------------------------------------------------
const showResetConfirm = ref(false)

function resetData() {
  localStorage.removeItem('bt_settings')
  settingsStore.resetSettings()
  showResetConfirm.value = false
  showToast('Settings reset to defaults.')
}
</script>

<template>
  <div class="space-y-6 max-w-2xl">

    <!-- Toast -->
    <Transition name="fade">
      <div
        v-if="toast"
        :class="[
          'fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg border',
          toast.type === 'success'
            ? 'bg-secondary-50 border-secondary-200 text-secondary-700'
            : 'bg-danger-50 border-danger-200 text-danger-700',
        ]"
      >
        <CheckCircle v-if="toast.type === 'success'" :size="15" aria-hidden="true" />
        <AlertTriangle v-else :size="15" aria-hidden="true" />
        {{ toast.message }}
      </div>
    </Transition>

    <!-- ------------------------------------------------------------------ -->
    <!-- Section 1: General Preferences                                      -->
    <!-- ------------------------------------------------------------------ -->
    <section class="rounded-xl bg-surface border border-border shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-border bg-surface-alt">
        <h2 class="text-sm font-semibold text-text">General Preferences</h2>
        <p class="text-xs text-text-muted mt-0.5">Customize how the app looks and behaves.</p>
      </div>
      <div class="px-6 py-5 space-y-4">

        <!-- Load failure banner -->
        <div
          v-if="settingsLoadFailed"
          class="rounded-lg border border-warning-200 bg-warning-50 p-4 flex items-start gap-3"
        >
          <AlertTriangle :size="16" class="shrink-0 text-warning-600 mt-0.5" aria-hidden="true" />
          <div class="flex-1 text-sm">
            <p class="font-medium text-warning-800">Settings could not be loaded</p>
            <p class="text-warning-700 mt-0.5">{{ settingsStore.settingsError }}</p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-warning-800 border border-warning-300 hover:bg-warning-100 transition-colors disabled:opacity-50"
            :disabled="settingsStore.settingsLoading"
            @click="triggerLoadSettings"
          >
            {{ settingsStore.settingsLoading ? 'Retrying…' : 'Retry' }}
          </button>
        </div>

        <!-- Loading skeleton -->
        <div v-if="settingsStore.settingsLoading && !settingsStore.settingsLoaded" class="space-y-3 py-1" aria-busy="true" aria-label="Loading settings">
          <div v-for="n in 4" :key="n" class="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:items-center">
            <div class="h-4 w-28 rounded bg-neutral-200 animate-pulse" />
            <div class="sm:col-span-2 h-9 rounded-lg bg-neutral-200 animate-pulse" />
          </div>
          <div class="flex justify-end gap-3 pt-2 border-t border-border">
            <div class="h-9 w-20 rounded-lg bg-neutral-200 animate-pulse" />
            <div class="h-9 w-16 rounded-lg bg-neutral-200 animate-pulse" />
          </div>
        </div>

        <!-- Form — shown once loaded -->
        <template v-else-if="settingsStore.settingsLoaded">

          <!-- App name -->
          <div class="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:items-center">
            <label class="text-sm font-medium text-text-muted" for="g-appname">Application Name</label>
            <input
              id="g-appname"
              v-model="generalForm.appName"
              type="text"
              :disabled="settingsLoadFailed"
              class="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <!-- Currency -->
          <div class="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:items-center">
            <label class="text-sm font-medium text-text-muted" for="g-currency">Currency</label>
            <div class="sm:col-span-2 relative">
              <select
                id="g-currency"
                v-model="generalForm.currency"
                :disabled="settingsLoadFailed"
                class="w-full appearance-none rounded-lg border border-border bg-bg px-3 py-2 pr-8 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
              </select>
              <ChevronDown :size="13" class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
            </div>
          </div>

          <!-- Date format -->
          <div class="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:items-center">
            <label class="text-sm font-medium text-text-muted" for="g-datefmt">Date Format</label>
            <div class="sm:col-span-2 relative">
              <select
                id="g-datefmt"
                v-model="generalForm.dateFormat"
                :disabled="settingsLoadFailed"
                class="w-full appearance-none rounded-lg border border-border bg-bg px-3 py-2 pr-8 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option v-for="f in dateFormats" :key="f" :value="f">{{ f }}</option>
              </select>
              <ChevronDown :size="13" class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
            </div>
          </div>

          <!-- Theme -->
          <div class="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:items-center">
            <label class="text-sm font-medium text-text-muted">Theme</label>
            <div class="sm:col-span-2 flex rounded-lg border border-border overflow-hidden text-sm w-fit">
              <button
                v-for="t in themes"
                :key="t.value"
                type="button"
                :disabled="settingsLoadFailed"
                :class="[
                  'px-4 py-2 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                  generalForm.theme === t.value ? 'bg-primary-600 text-white' : 'text-text-muted hover:bg-surface-alt',
                ]"
                @click="generalForm.theme = t.value"
              >{{ t.label }}</button>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              type="button"
              class="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-alt transition-colors disabled:opacity-50"
              :disabled="settingsStore.settingsLoading || settingsLoadFailed"
              @click="cancelGeneral"
            >Cancel</button>
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="settingsStore.settingsLoading || settingsLoadFailed"
              @click="saveGeneral"
            >
              <Save :size="14" aria-hidden="true" /> {{ settingsStore.settingsLoading ? 'Saving…' : 'Save' }}
            </button>
          </div>

        </template>
      </div>
    </section>

    <!-- ------------------------------------------------------------------ -->
    <!-- Section 2: Salary Cutoff Settings                                   -->
    <!-- ------------------------------------------------------------------ -->
    <section class="rounded-xl bg-surface border border-border shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-border bg-surface-alt">
        <h2 class="text-sm font-semibold text-text">Salary Cutoff Settings</h2>
        <p class="text-xs text-text-muted mt-0.5">Define your two monthly payroll cutoff days.</p>
      </div>
      <div class="px-6 py-5 space-y-4">

        <!-- Loading skeleton -->
        <div v-if="settingsStore.settingsLoading && !settingsStore.settingsLoaded" class="space-y-3 py-1" aria-busy="true" aria-label="Loading settings">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <div class="h-3 w-24 rounded bg-neutral-200 animate-pulse" />
              <div class="h-9 rounded-lg bg-neutral-200 animate-pulse" />
            </div>
            <div class="space-y-1">
              <div class="h-3 w-24 rounded bg-neutral-200 animate-pulse" />
              <div class="h-9 rounded-lg bg-neutral-200 animate-pulse" />
            </div>
          </div>
          <div class="flex justify-end pt-2 border-t border-border">
            <div class="h-9 w-16 rounded-lg bg-neutral-200 animate-pulse" />
          </div>
        </div>

        <!-- Form — shown once loaded -->
        <template v-else-if="settingsStore.settingsLoaded">

          <div class="grid grid-cols-2 gap-4">
            <!-- Cutoff 1 -->
            <div>
              <label class="mb-1 block text-xs font-medium text-text-muted" for="c-cut1">First Cutoff Day</label>
              <input
                id="c-cut1"
                v-model.number="cutoffForm.cutoff1"
                type="number"
                min="1"
                max="28"
                :disabled="settingsLoadFailed"
                :class="[
                  'w-full rounded-lg border px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50 disabled:cursor-not-allowed',
                  cutoffErrors.cutoff1 ? 'border-danger-400 bg-danger-50' : 'border-border bg-bg',
                ]"
              />
              <p v-if="cutoffErrors.cutoff1" class="mt-1 text-xs text-danger-600">{{ cutoffErrors.cutoff1 }}</p>
            </div>
            <!-- Cutoff 2 -->
            <div>
              <label class="mb-1 block text-xs font-medium text-text-muted" for="c-cut2">Second Cutoff Day</label>
              <input
                id="c-cut2"
                v-model.number="cutoffForm.cutoff2"
                type="number"
                min="1"
                max="31"
                :disabled="settingsLoadFailed"
                :class="[
                  'w-full rounded-lg border px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50 disabled:cursor-not-allowed',
                  cutoffErrors.cutoff2 ? 'border-danger-400 bg-danger-50' : 'border-border bg-bg',
                ]"
              />
              <p v-if="cutoffErrors.cutoff2" class="mt-1 text-xs text-danger-600">{{ cutoffErrors.cutoff2 }}</p>
            </div>
          </div>

          <!-- Preview -->
          <div v-if="cutoffPreview.length" class="rounded-lg bg-surface-alt border border-border p-3 space-y-1">
            <p class="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Period Preview</p>
            <div v-for="p in cutoffPreview" :key="p.label" class="flex items-center justify-between text-sm">
              <span class="text-text-muted">{{ p.label }}</span>
              <span class="font-medium text-text">{{ p.range }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end pt-2 border-t border-border">
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="settingsStore.settingsLoading || settingsLoadFailed"
              @click="saveCutoff"
            >
              <Save :size="14" aria-hidden="true" /> {{ settingsStore.settingsLoading ? 'Saving…' : 'Save' }}
            </button>
          </div>

        </template>
      </div>
    </section>

    <!-- ------------------------------------------------------------------ -->
    <!-- Section 3: Budget Categories                                        -->
    <!-- ------------------------------------------------------------------ -->
    <section class="rounded-xl bg-surface border border-border shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-border bg-surface-alt">
        <h2 class="text-sm font-semibold text-text">Budget Categories</h2>
        <p class="text-xs text-text-muted mt-0.5">Manage expense categories. Built-in categories cannot be deleted.</p>
      </div>
      <div class="px-6 py-5 space-y-4">

        <!-- Category list -->
        <!-- Loading skeleton -->
        <div v-if="settingsStore.categoriesLoading && !settingsStore.categoriesLoaded" class="space-y-2 py-1" aria-busy="true" aria-label="Loading categories">
          <div v-for="n in 5" :key="n" class="h-9 rounded-lg bg-neutral-200 animate-pulse" />
        </div>

        <!-- Error -->
        <div v-else-if="settingsStore.categoriesError" class="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm">
          <AlertTriangle :size="15" class="shrink-0 text-danger-600 mt-0.5" aria-hidden="true" />
          <span class="text-danger-700">{{ settingsStore.categoriesError }}</span>
        </div>

        <template v-else>
          <ul class="divide-y divide-border rounded-lg border border-border overflow-hidden" role="list">
            <li
              v-for="cat in settingsStore.categories"
              :key="cat.id"
              class="flex items-center justify-between px-4 py-2.5 bg-surface hover:bg-surface-alt transition-colors text-sm"
            >
              <!-- Edit inline -->
              <template v-if="editingCategory === cat.id">
                <div class="flex-1 mr-3">
                  <input
                    v-model="editCategoryName"
                    type="text"
                    class="w-full rounded-md border border-border bg-bg px-2 py-1 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
                    @keyup.enter="saveEdit"
                    @keyup.escape="cancelEdit"
                  />
                  <p v-if="editCategoryError" class="mt-0.5 text-xs text-danger-600">{{ editCategoryError }}</p>
                </div>
                <div class="flex items-center gap-1">
                  <button class="rounded-md p-1.5 text-secondary-600 hover:bg-secondary-50 transition-colors" aria-label="Confirm rename" @click="saveEdit">
                    <Check :size="13" aria-hidden="true" />
                  </button>
                  <button class="rounded-md p-1.5 text-text-subtle hover:bg-surface-alt transition-colors" aria-label="Cancel" @click="cancelEdit">
                    <X :size="13" aria-hidden="true" />
                  </button>
                </div>
              </template>

              <!-- Normal row -->
              <template v-else>
                <div class="flex items-center gap-2">
                  <span class="font-medium text-text">{{ cat.name }}</span>
                  <span class="rounded-full px-1.5 py-0.5 text-xs border"
                    :class="cat.type === 'income'
                      ? 'bg-success-50 border-success-200 text-success-700'
                      : 'bg-surface-alt border-border text-text-muted'"
                  >{{ cat.type }}</span>
                  <span
                    v-if="cat.is_builtin"
                    class="rounded-full bg-surface-alt border border-border px-1.5 py-0.5 text-xs text-text-muted"
                  >built-in</span>
                  <span
                    v-if="categoryInUse(cat.name)"
                    class="rounded-full bg-primary-50 border border-primary-200 px-1.5 py-0.5 text-xs text-primary-700"
                  >in use</span>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    :disabled="cat.is_builtin"
                    :class="[
                      'rounded-md p-1.5 transition-colors',
                      cat.is_builtin
                        ? 'text-text-subtle opacity-30 cursor-not-allowed'
                        : 'text-text-subtle hover:bg-primary-50 hover:text-primary-600',
                    ]"
                    aria-label="Rename category"
                    @click="!cat.is_builtin && startEdit(cat)"
                  >
                    <Pencil :size="13" aria-hidden="true" />
                  </button>
                  <button
                    :disabled="cat.is_builtin"
                    :class="[
                      'rounded-md p-1.5 transition-colors',
                      cat.is_builtin
                        ? 'text-text-subtle opacity-30 cursor-not-allowed'
                        : 'text-text-subtle hover:bg-danger-50 hover:text-danger-600',
                    ]"
                    aria-label="Delete category"
                    @click="!cat.is_builtin && requestDelete(cat)"
                  >
                    <Trash2 :size="13" aria-hidden="true" />
                  </button>
                </div>
              </template>
            </li>
          </ul>

          <!-- Add category -->
          <div class="flex gap-2">
            <div class="flex-1 flex gap-2">
              <div class="relative">
                <select
                  v-model="newCategoryType"
                  class="h-full rounded-lg border border-border bg-bg px-2 py-2 pr-6 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400 appearance-none"
                  aria-label="Category type"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
                <ChevronDown :size="12" class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
              </div>
              <div class="flex-1">
                <input
                  v-model="newCategoryName"
                  type="text"
                  placeholder="New category name…"
                  :class="[
                    'w-full rounded-lg border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary-400',
                    newCategoryError ? 'border-danger-400 bg-danger-50' : 'border-border bg-bg',
                  ]"
                  @keyup.enter="addCategory"
                />
              </div>
            </div>
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors shrink-0"
              @click="addCategory"
            >
              <Plus :size="14" aria-hidden="true" /> Add
            </button>
          </div>
          <p v-if="newCategoryError" class="text-xs text-danger-600">{{ newCategoryError }}</p>
        </template>
      </div>
    </section>

    <!-- ------------------------------------------------------------------ -->
    <!-- Section 4: Data Management                                          -->
    <!-- ------------------------------------------------------------------ -->
    <section class="rounded-xl bg-surface border border-border shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-border bg-surface-alt">
        <h2 class="text-sm font-semibold text-text">Data Management</h2>
        <p class="text-xs text-text-muted mt-0.5">Reset preferences and categories to their defaults.</p>
      </div>
      <div class="px-6 py-5 space-y-3">

        <div class="rounded-lg border border-warning-200 bg-warning-50 p-4 flex gap-3">
          <AlertTriangle :size="16" class="shrink-0 text-warning-600 mt-0.5" aria-hidden="true" />
          <div class="text-sm">
            <p class="font-medium text-warning-800">Reset Settings</p>
            <p class="text-warning-700 mt-0.5">
              Resets all preferences and categories to defaults. Transaction data is <strong>not</strong> affected.
              Currently tracking <strong>{{ txStore.items.length }}</strong> transaction{{ txStore.items.length !== 1 ? 's' : '' }}.
            </p>
          </div>
        </div>

        <div class="flex justify-end">
          <button
            type="button"
            class="flex items-center gap-2 rounded-lg border border-danger-300 bg-danger-50 px-4 py-2 text-sm font-medium text-danger-700 hover:bg-danger-100 transition-colors"
            @click="showResetConfirm = true"
          >
            <RotateCcw :size="14" aria-hidden="true" /> Reset to Defaults
          </button>
        </div>
      </div>
    </section>

  </div>

  <!-- ------------------------------------------------------------------ -->
  <!-- Delete category confirmation                                        -->
  <!-- ------------------------------------------------------------------ -->
  <Transition name="fade">
    <div
      v-if="deleteCategoryTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4"
      @click.self="deleteCategoryTarget = null"
    >
      <div class="w-full max-w-sm rounded-2xl bg-surface shadow-xl border border-border p-6">
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-danger-50">
          <Trash2 :size="20" class="text-danger-600" aria-hidden="true" />
        </div>
        <h2 class="text-base font-semibold text-text">Delete Category?</h2>
        <p class="mt-1 text-sm text-text-muted">
          <strong>{{ deleteCategoryTarget?.name }}</strong> will be soft-deleted and hidden from new transactions.
          Existing transactions referencing this category are preserved.
        </p>
        <div class="mt-5 flex justify-end gap-3">
          <button class="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-alt transition-colors"
            @click="deleteCategoryTarget = null">Cancel</button>
          <button class="rounded-lg bg-danger-600 px-4 py-2 text-sm font-medium text-white hover:bg-danger-700 transition-colors"
            @click="confirmCategoryDelete">Delete</button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- ------------------------------------------------------------------ -->
  <!-- Reset data confirmation                                             -->
  <!-- ------------------------------------------------------------------ -->
  <Transition name="fade">
    <div
      v-if="showResetConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4"
      @click.self="showResetConfirm = false"
    >
      <div class="w-full max-w-sm rounded-2xl bg-surface shadow-xl border border-border p-6">
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-warning-50">
          <AlertTriangle :size="20" class="text-warning-600" aria-hidden="true" />
        </div>
        <h2 class="text-base font-semibold text-text">Reset Settings?</h2>
        <p class="mt-1 text-sm text-text-muted">
          All preferences and categories will return to defaults. Your <strong>{{ txStore.items.length }} transaction{{ txStore.items.length !== 1 ? 's' : '' }}</strong> will not be affected.
        </p>
        <div class="mt-5 flex justify-end gap-3">
          <button class="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-alt transition-colors"
            @click="showResetConfirm = false">Cancel</button>
          <button class="rounded-lg bg-warning-600 px-4 py-2 text-sm font-medium text-white hover:bg-warning-700 transition-colors"
            @click="resetData">Reset</button>
        </div>
      </div>
    </div>
  </Transition>

</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }
</style>
