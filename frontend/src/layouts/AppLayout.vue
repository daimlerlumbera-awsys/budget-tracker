<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRoute, RouterView } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppHeader from '@/layouts/AppHeader.vue'

const route = useRoute()
const sidebarOpen = ref(false)

watch(() => route.path, () => { sidebarOpen.value = false })

const pageTitle = computed(() => (route.meta.title as string | undefined) ?? 'Budget Tracker')
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-bg">
    <AppSidebar :open="sidebarOpen" @close="sidebarOpen = false" />

    <div class="flex flex-1 flex-col overflow-hidden">
      <AppHeader :title="pageTitle" @open-sidebar="sidebarOpen = true">
        <template #actions>
          <slot name="header-actions" />
        </template>
      </AppHeader>

      <main class="flex-1 overflow-y-auto p-4 lg:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
