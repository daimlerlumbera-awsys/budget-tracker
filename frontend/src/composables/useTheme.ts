import { computed, ref, watch } from 'vue'
import { useSettingsStore, type AppSettings } from '@/stores/counter'
import { useAuthStore } from '@/stores/auth'

type ThemeChoice = AppSettings['theme']

/** Last applied choice; index.html reads it before the app loads to avoid a flash. */
export const THEME_STORAGE_KEY = 'bt_theme'

function readCachedTheme(): ThemeChoice {
  const value = localStorage.getItem(THEME_STORAGE_KEY)
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

// Shared across every useTheme() caller
const cachedTheme = ref<ThemeChoice>(readCachedTheme())
const media = window.matchMedia('(prefers-color-scheme: dark)')
const systemDark = ref(media.matches)
media.addEventListener('change', (e) => { systemDark.value = e.matches })
let initialized = false

/**
 * Reads and toggles the theme. The first call (App.vue) also starts applying
 * the user's setting (light / dark / system) to <html>.
 */
export function useTheme() {
  const settingsStore = useSettingsStore()
  const authStore = useAuthStore()

  // Until the signed-in user's settings arrive, keep using the last applied choice
  const choice = computed<ThemeChoice>(() =>
    settingsStore.settingsLoaded ? settingsStore.settings.theme : cachedTheme.value,
  )
  const isDark = computed(() =>
    choice.value === 'dark' || (choice.value === 'system' && systemDark.value),
  )

  if (!initialized) {
    initialized = true
    watch(isDark, (dark) => {
      document.documentElement.classList.toggle('dark', dark)
    }, { immediate: true })
    watch(choice, (value) => {
      cachedTheme.value = value
      localStorage.setItem(THEME_STORAGE_KEY, value)
    })
  }

  /** Flips between light and dark; saved to the user's settings when signed in. */
  async function toggleTheme(): Promise<void> {
    const next: ThemeChoice = isDark.value ? 'light' : 'dark'
    const userId = authStore.user?.id
    if (userId && settingsStore.settingsLoaded) {
      await settingsStore.saveSettings({ theme: next }, userId)
    } else {
      cachedTheme.value = next
      localStorage.setItem(THEME_STORAGE_KEY, next)
    }
  }

  return { choice, isDark, toggleTheme }
}
