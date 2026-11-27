<script setup lang="ts">
import { computed, ref } from 'vue'

export interface BarSeries {
  name: string
  color: string
  values: number[]
}

const props = defineProps<{
  labels: string[]
  series: BarSeries[]
  format: (value: number) => string
  axisFormat?: (value: number) => string
}>()

const W = 640
const H = 260
const PAD = { top: 12, right: 8, bottom: 28, left: 60 }
const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom
const BAR_GAP = 2

const hovered = ref<number | null>(null)

/** Rounds the axis max up to a 1/2/2.5/5 × 10^n step so ticks are readable. */
const ticks = computed(() => {
  const max = Math.max(0, ...props.series.flatMap(s => s.values))
  if (max <= 0) return [0, 1, 2, 3, 4]
  const rough = max / 4
  const mag = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= rough) ?? rough
  return [0, 1, 2, 3, 4].map(i => i * step)
})
const yMax = computed(() => ticks.value[ticks.value.length - 1] ?? 1)

function y(value: number) {
  return PAD.top + plotH - (value / yMax.value) * plotH
}

const groupW = computed(() => plotW / Math.max(1, props.labels.length))
const barW = computed(() => {
  const n = Math.max(1, props.series.length)
  return Math.max(3, Math.min(22, (groupW.value * 0.7 - BAR_GAP * (n - 1)) / n))
})

function barPath(x: number, top: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h)
  const b = top + h
  return `M${x},${b} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${b} Z`
}

const bars = computed(() =>
  props.labels.map((_, gi) => {
    const n = props.series.length
    const clusterW = n * barW.value + (n - 1) * BAR_GAP
    const x0 = PAD.left + gi * groupW.value + (groupW.value - clusterW) / 2
    return props.series.map((s, si) => {
      const v = s.values[gi] ?? 0
      const top = y(v)
      const h = PAD.top + plotH - top
      return { key: `${gi}-${si}`, color: s.color, d: h > 0 ? barPath(x0 + si * (barW.value + BAR_GAP), top, barW.value, h) : '' }
    })
  }),
)

const fmtAxis = computed(() => props.axisFormat ?? props.format)

const tooltipStyle = computed(() => {
  if (hovered.value === null) return {}
  const centerX = PAD.left + (hovered.value + 0.5) * groupW.value
  const pct = (centerX / W) * 100
  return pct > 60
    ? { right: `${100 - pct + 2}%`, top: '0' }
    : { left: `${pct + 2}%`, top: '0' }
})
</script>

<template>
  <div>
    <!-- Legend -->
    <div v-if="series.length > 1" class="mb-3 flex flex-wrap items-center gap-4 text-xs text-text-muted">
      <span v-for="s in series" :key="s.name" class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-sm" :style="{ background: s.color }" aria-hidden="true" />
        {{ s.name }}
      </span>
    </div>

    <div class="relative">
      <svg :viewBox="`0 0 ${W} ${H}`" class="w-full" role="img" aria-label="Bar chart">
        <!-- Grid + y axis -->
        <g v-for="t in ticks" :key="t">
          <line
            :x1="PAD.left" :x2="W - PAD.right" :y1="y(t)" :y2="y(t)"
            stroke="var(--color-border)" :stroke-dasharray="t === 0 ? undefined : '3 3'"
          />
          <text :x="PAD.left - 8" :y="y(t)" text-anchor="end" dominant-baseline="middle"
                class="fill-text-subtle text-[11px] tabular-nums">{{ fmtAxis(t) }}</text>
        </g>

        <!-- Hover band -->
        <rect
          v-if="hovered !== null"
          :x="PAD.left + hovered * groupW" :y="PAD.top" :width="groupW" :height="plotH"
          fill="var(--color-surface-alt)"
        />

        <!-- Bars -->
        <g v-for="(group, gi) in bars" :key="gi">
          <template v-for="b in group" :key="b.key">
            <path v-if="b.d" :d="b.d" :fill="b.color" />
          </template>
        </g>

        <!-- X labels -->
        <text
          v-for="(label, gi) in labels" :key="label"
          :x="PAD.left + (gi + 0.5) * groupW" :y="H - 8" text-anchor="middle"
          :class="['text-[11px]', hovered === gi ? 'fill-text' : 'fill-text-muted']"
        >{{ label }}</text>

        <!-- Hit targets (full column height) -->
        <rect
          v-for="(label, gi) in labels" :key="`hit-${label}`"
          :x="PAD.left + gi * groupW" :y="PAD.top" :width="groupW" :height="plotH + PAD.bottom"
          fill="transparent" class="cursor-pointer"
          @mouseenter="hovered = gi" @mouseleave="hovered = null"
        />
      </svg>

      <!-- Tooltip -->
      <div
        v-if="hovered !== null"
        class="pointer-events-none absolute z-10 min-w-40 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-md"
        :style="tooltipStyle"
      >
        <p class="mb-1 font-semibold text-text">{{ labels[hovered] }}</p>
        <p v-for="s in series" :key="s.name" class="flex items-center justify-between gap-4">
          <span class="flex items-center gap-1.5 text-text-muted">
            <span class="h-2 w-2 rounded-sm" :style="{ background: s.color }" aria-hidden="true" />
            {{ s.name }}
          </span>
          <span class="font-medium text-text tabular-nums">{{ format(s.values[hovered] ?? 0) }}</span>
        </p>
      </div>
    </div>
  </div>
</template>
