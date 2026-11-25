<script setup lang="ts">
  import { watch } from 'vue'
  import { RouterView } from 'vue-router'
  import { useTheme } from '@/composables/useTheme'
  import { useAuthStore } from '@/stores/auth'
  import { useSettingsStore } from '@/stores/counter'

  useTheme()

  // Load the signed-in user's settings (including theme) on every page,
  // not only when the Settings page is opened.
  const authStore = useAuthStore()
  const settingsStore = useSettingsStore()
  watch(() => authStore.user?.id, (id) => {
    if (!id) return
    const loadedForUser = settingsStore.settingsLoaded && settingsStore.settingsUserId === id
    if (!loadedForUser && settingsStore.settingsLoadingUserId !== id) {
      void settingsStore.loadSettings(id)
    }
  }, { immediate: true })
</script>

<template>
  <RouterView />
</template>

<style scoped></style>
