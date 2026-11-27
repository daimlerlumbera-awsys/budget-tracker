<script setup lang="ts">
import { computed, ref } from 'vue'

export interface DonutSlice {
  label: string
  value: number
  color: string
}

const props = defineProps<{
  slices: DonutSlice[]
  format: (value: number) => string
  totalLabel?: string
}>()

const SIZE = 200
const C = SIZE / 2
const R = 78
const THICKNESS = 26
// ~2px gap between slices at this radius
const GAP = 2 / R

const hovered = ref<number | null>(null)

const total = computed(() => props.slices.reduce((s, x) => s + x.value, 0))

function point(angle: number) {
  return [C + R * Math.sin(angle), C - R * Math.cos(angle)]
}

const arcs = computed(() => {
  const list: { d: string; full: boolean; slice: DonutSlice; pct: number }[] = []
  if (total.value <= 0) return list
  let start = 0
  for (const slice of props.slices) {
    if (slice.value <= 0) continue
    const sweep = (slice.value / total.value) * Math.PI * 2
    const pct = slice.value / total.value
    if (sweep >= Math.PI * 2 - 1e-6) {
      list.push({ d: '', full: true, slice, pct })
    } else {
      const a0 = start + GAP / 2
      const a1 = Math.max(a0 + 0.001, start + sweep - GAP / 2)
      const [x0, y0] = point(a0)
      const [x1, y1] = point(a1)
      const large = a1 - a0 > Math.PI ? 1 : 0
      list.push({ d: `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1}`, full: false, slice, pct })
    }
    start += sweep
  }
  return list
})

const center = computed(() => {
  const arc = hovered.value !== null ? arcs.value[hovered.value] : undefined
  if (arc) {
    return { title: arc.slice.label, value: props.format(arc.slice.value), sub: `${(arc.pct * 100).toFixed(1)}%` }
  }
  return { title: props.totalLabel ?? 'Total', value: props.format(total.value), sub: '' }
})

function pctOf(value: number) {
  return total.value > 0 ? `${((value / total.value) * 100).toFixed(1)}%` : '0%'
}
</script>

<template>
  <div class="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
    <div class="relative w-48 shrink-0">
      <svg :viewBox="`0 0 ${SIZE} ${SIZE}`" class="w-full" role="img" :aria-label="`${totalLabel ?? 'Total'} ${format(total)}`">
        <circle :cx="C" :cy="C" :r="R" fill="none" stroke="var(--color-surface-alt)" :stroke-width="THICKNESS" />
        <template v-for="(arc, i) in arcs" :key="arc.slice.label">
          <circle
            v-if="arc.full"
            :cx="C" :cy="C" :r="R" fill="none"
            :stroke="arc.slice.color"
            :stroke-width="hovered === i ? THICKNESS + 6 : THICKNESS"
            class="cursor-pointer transition-[stroke-width] duration-150"
            @mouseenter="hovered = i" @mouseleave="hovered = null"
          />
          <path
            v-else
            :d="arc.d" fill="none"
            :stroke="arc.slice.color"
            :stroke-width="hovered === i ? THICKNESS + 6 : THICKNESS"
            :opacity="hovered === null || hovered === i ? 1 : 0.45"
            class="cursor-pointer transition-[stroke-width,opacity] duration-150"
            @mouseenter="hovered = i" @mouseleave="hovered = null"
          />
        </template>
      </svg>
      <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        <span class="text-xs text-text-muted truncate max-w-full">{{ center.title }}</span>
        <span class="text-lg font-bold text-text tabular-nums">{{ center.value }}</span>
        <span v-if="center.sub" class="text-xs text-text-muted tabular-nums">{{ center.sub }}</span>
      </div>
    </div>

    <!-- Legend doubles as the data table -->
    <ul class="w-full min-w-0 flex-1 space-y-1" role="list">
      <li
        v-for="(arc, i) in arcs"
        :key="arc.slice.label"
        :class="[
          'flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors',
          hovered === i ? 'bg-surface-alt' : '',
        ]"
        @mouseenter="hovered = i" @mouseleave="hovered = null"
      >
        <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ background: arc.slice.color }" aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate text-text">{{ arc.slice.label }}</span>
        <span class="font-medium text-text tabular-nums">{{ format(arc.slice.value) }}</span>
        <span class="w-14 text-right text-xs text-text-muted tabular-nums">{{ pctOf(arc.slice.value) }}</span>
      </li>
    </ul>
  </div>
</template>
