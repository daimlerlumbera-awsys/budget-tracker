<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import {
  Save, RotateCcw, Plus, Pencil, Trash2, X, Check,
  AlertTriangle, CheckCircle, ChevronDown,
} from 'lucide-vue-next'
import { useSettingsStore, useTransactionStore, type AppSettings } from '@/stores/counter'

const settingsStore = useSettingsStore()
const txStore       = useTransactionStore()

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
const themes       = [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] as const

function saveGeneral() {
  settingsStore.saveSettings({ ...generalForm })
  showToast('General preferences saved.')
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
})

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

function saveCutoff() {
  if (!validateCutoff()) return
  settingsStore.saveSettings({ cutoff1: Number(cutoffForm.cutoff1), cutoff2: Number(cutoffForm.cutoff2) })
  showToast('Cutoff settings saved.')
}

// ---------------------------------------------------------------------------
// Section 3 — Budget Categories
// ---------------------------------------------------------------------------
const newCategoryName = ref('')
const newCategoryError = ref('')

const editingCategory = ref<string | null>(null)
const editCategoryName = ref('')
const editCategoryError = ref('')

const deleteCategoryTarget = ref<string | null>(null)

function categoryInUse(name: string): boolean {
  return txStore.items.some(t => t.category === name)
}

function startEdit(name: string) {
  editingCategory.value = name
  editCategoryName.value = name
  editCategoryError.value = ''
}

function cancelEdit() {
  editingCategory.value = null
  editCategoryName.value = ''
  editCategoryError.value = ''
}

function saveEdit() {
  const old = editingCategory.value
  if (!old) return
  const result = settingsStore.renameCategory(old, editCategoryName.value)
  if (!result) {
    editCategoryError.value = 'Name is empty or already exists.'
    return
  }
  // Update transactions that used the old name
  for (const tx of txStore.items) {
    if (tx.category === old) tx.category = editCategoryName.value.trim()
  }
  cancelEdit()
  showToast(`Renamed to "${editCategoryName.value.trim()}".`)
}

function addCategory() {
  newCategoryError.value = ''
  const result = settingsStore.addCategory(newCategoryName.value)
  if (!result) {
    newCategoryError.value = 'Name is empty or already exists.'
    return
  }
  showToast(`"${newCategoryName.value.trim()}" added.`)
  newCategoryName.value = ''
}

function requestDelete(name: string) {
  deleteCategoryTarget.value = name
}

function confirmCategoryDelete() {
  const name = deleteCategoryTarget.value
  if (!name) return
  // Reassign transactions to 'Others'
  for (const tx of txStore.items) {
    if (tx.category === name) tx.category = 'Others'
  }
  settingsStore.removeCategory(name)
  deleteCategoryTarget.value = null
  showToast(`"${name}" deleted. Transactions moved to Others.`)
}

// ---------------------------------------------------------------------------
// Section 4 — Data Management
// ---------------------------------------------------------------------------
const showResetConfirm = ref(false)

function resetData() {
  // Reset transactions to initial state by clearing and reinitialising
  // In production this would call an API endpoint; here we reload from defaults
  localStorage.removeItem('bt_settings')
  localStorage.removeItem('bt_categories')
  settingsStore.resetSettings()
  settingsStore.resetCategories()
  showResetConfirm.value = false
  showToast('Settings and categories reset to defaults.')
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

        <!-- App name -->
        <div class="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:items-center">
          <label class="text-sm font-medium text-text-muted" for="g-appname">Application Name</label>
          <input
            id="g-appname"
            v-model="generalForm.appName"
            type="text"
            class="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>

        <!-- Currency -->
        <div class="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:items-center">
          <label class="text-sm font-medium text-text-muted" for="g-currency">Currency</label>
          <div class="sm:col-span-2 relative">
            <select
              id="g-currency"
              v-model="generalForm.currency"
              class="w-full appearance-none rounded-lg border border-border bg-bg px-3 py-2 pr-8 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
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
              class="w-full appearance-none rounded-lg border border-border bg-bg px-3 py-2 pr-8 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400"
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
              :class="[
                'px-4 py-2 font-medium transition-colors',
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
            class="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-alt transition-colors"
            @click="cancelGeneral"
          >Cancel</button>
          <button
            type="button"
            class="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
            @click="saveGeneral"
          >
            <Save :size="14" aria-hidden="true" /> Save
          </button>
        </div>
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
              :class="[
                'w-full rounded-lg border px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400',
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
              :class="[
                'w-full rounded-lg border px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-400',
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
            class="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
            @click="saveCutoff"
          >
            <Save :size="14" aria-hidden="true" /> Save
          </button>
        </div>
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
        <ul class="divide-y divide-border rounded-lg border border-border overflow-hidden" role="list">
          <li
            v-for="cat in settingsStore.categories"
            :key="cat"
            class="flex items-center justify-between px-4 py-2.5 bg-surface hover:bg-surface-alt transition-colors text-sm"
          >
            <!-- Edit inline -->
            <template v-if="editingCategory === cat">
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
                <span class="font-medium text-text">{{ cat }}</span>
                <span
                  v-if="settingsStore.builtInCategories.includes(cat)"
                  class="rounded-full bg-surface-alt border border-border px-1.5 py-0.5 text-xs text-text-muted"
                >built-in</span>
                <span
                  v-if="categoryInUse(cat)"
                  class="rounded-full bg-primary-50 border border-primary-200 px-1.5 py-0.5 text-xs text-primary-700"
                >in use</span>
              </div>
              <div class="flex items-center gap-1">
                <button
                  class="rounded-md p-1.5 text-text-subtle hover:bg-primary-50 hover:text-primary-600 transition-colors"
                  aria-label="Rename category"
                  @click="startEdit(cat)"
                >
                  <Pencil :size="13" aria-hidden="true" />
                </button>
                <button
                  :disabled="settingsStore.builtInCategories.includes(cat)"
                  :class="[
                    'rounded-md p-1.5 transition-colors',
                    settingsStore.builtInCategories.includes(cat)
                      ? 'text-text-subtle opacity-30 cursor-not-allowed'
                      : 'text-text-subtle hover:bg-danger-50 hover:text-danger-600',
                  ]"
                  aria-label="Delete category"
                  @click="!settingsStore.builtInCategories.includes(cat) && requestDelete(cat)"
                >
                  <Trash2 :size="13" aria-hidden="true" />
                </button>
              </div>
            </template>
          </li>
        </ul>

        <!-- Add category -->
        <div class="flex gap-2">
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
            <p v-if="newCategoryError" class="mt-1 text-xs text-danger-600">{{ newCategoryError }}</p>
          </div>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors shrink-0"
            @click="addCategory"
          >
            <Plus :size="14" aria-hidden="true" /> Add
          </button>
        </div>
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
          <strong>{{ deleteCategoryTarget }}</strong> will be removed.
          <template v-if="categoryInUse(deleteCategoryTarget!)">
            <span class="text-warning-700 font-medium"> Transactions using this category will be moved to <strong>Others</strong>.</span>
          </template>
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
