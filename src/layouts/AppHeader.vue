<script setup lang="ts">
import { Menu } from 'lucide-vue-next'

defineProps<{ title: string }>()
const emit = defineEmits<{ openSidebar: [] }>()
</script>

<template>
  <header class="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-4 lg:px-6">
    <!-- Mobile menu toggle -->
    <button
      class="lg:hidden rounded-md p-1.5 text-text-muted hover:bg-surface-alt hover:text-text transition-colors"
      aria-label="Open navigation"
      @click="emit('openSidebar')"
    >
      <Menu :size="20" aria-hidden="true" />
    </button>

    <!-- Page title -->
    <h1 class="flex-1 text-lg font-semibold text-text truncate">{{ title }}</h1>

    <!-- Action slot — right side -->
    <div class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
