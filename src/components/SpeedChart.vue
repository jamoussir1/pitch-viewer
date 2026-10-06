<script setup lang="ts">
// Speed-over-time line chart for one player.
// It uses BOTH D3 patterns on purpose:
//   1. "Vue renders, D3 computes": the line path, marker and hover line are in the template;
//      D3 only gives us scales and the path string (d3.line).
//   2. "D3 owns an element via a template ref": the two axes. D3's axis helpers create
//      the tick lines and labels themselves inside <g ref="..."> elements.
import { computed, onMounted, ref, watch } from 'vue'
import { axisBottom, axisLeft, line, max, scaleLinear, select } from 'd3'

import { formatSeconds } from '@/utils/format'

const props = defineProps<{
  speeds: (number | null)[] // km/h per frame, null = gap
  fps: number
  position: number // current playback position (fractional frame index)
  color: string
}>()

const emit = defineEmits<{
  seek: [frameIndex: number]
}>()

// ---------- layout ----------
const width = 340
const height = 170
const margin = { top: 12, right: 12, bottom: 26, left: 36 }

// ---------- scales ----------
const x = computed(() =>
  scaleLinear()
    .domain([0, Math.max(props.speeds.length - 1, 1) / props.fps]) // seconds
    .range([margin.left, width - margin.right]),
)
const y = computed(() =>
  scaleLinear()
    .domain([0, Math.max(30, max(props.speeds, (v) => v ?? 0) ?? 0)]) // at least 0-30 km/h
    .nice()
    .range([height - margin.bottom, margin.top]),
)

// ---------- pattern 1: D3 computes the path, Vue renders it ----------
const linePath = computed(() => {
  const generator = line<number | null>()
    .defined((v) => v !== null) // null -> gap in the line (player off camera)
    .x((_, i) => x.value(i / props.fps))
    .y((v) => y.value(v ?? 0))
  return generator(props.speeds) ?? ''
})

const marker = computed(() => {
  const index = Math.round(props.position)
  const speed = props.speeds[index] ?? null
  return {
    x: x.value(props.position / props.fps),
    y: speed === null ? null : y.value(speed),
  }
})

// ---------- pattern 2: D3 owns the axis <g> elements ----------
const xAxisEl = ref<SVGGElement | null>(null)
const yAxisEl = ref<SVGGElement | null>(null)

function drawAxes() {
  if (!xAxisEl.value || !yAxisEl.value) return
  select(xAxisEl.value).call(
    axisBottom(x.value)
      .ticks(5)
      .tickFormat((seconds) => formatSeconds(Number(seconds))),
  )
  select(yAxisEl.value).call(axisLeft(y.value).ticks(4))
}

onMounted(drawAxes) // the <g> elements exist only after mounting
watch([x, y], drawAxes) // new player -> new scales -> redraw axes

// ---------- hover + click to seek (scale.invert: pixels -> data) ----------
const svgEl = ref<SVGSVGElement | null>(null)
const hoverIndex = ref<number | null>(null)

function indexFromMouse(event: MouseEvent): number {
  const box = svgEl.value!.getBoundingClientRect()
  const svgX = ((event.clientX - box.left) / box.width) * width // screen px -> viewBox px
  const seconds = x.value.invert(svgX)
  return Math.min(Math.max(Math.round(seconds * props.fps), 0), props.speeds.length - 1)
}

const hover = computed(() => {
  if (hoverIndex.value === null) return null
  const speed = props.speeds[hoverIndex.value] ?? null
  return {
    x: x.value(hoverIndex.value / props.fps),
    label: `${formatSeconds(hoverIndex.value / props.fps)} · ${
      speed === null ? 'off camera' : `${speed.toFixed(1)} km/h`
    }`,
  }
})
</script>

<template>
  <div class="chart">
    <svg
      ref="svgEl"
      :viewBox="`0 0 ${width} ${height}`"
      role="img"
      aria-label="Player speed over time"
      @mousemove="hoverIndex = indexFromMouse($event)"
      @mouseleave="hoverIndex = null"
      @click="emit('seek', indexFromMouse($event))"
    >
      <!-- axes: filled in by D3 -->
      <g ref="xAxisEl" class="axis" :transform="`translate(0, ${height - margin.bottom})`" />
      <g ref="yAxisEl" class="axis" :transform="`translate(${margin.left}, 0)`" />

      <!-- data line: rendered by Vue -->
      <path :d="linePath" fill="none" :stroke="color" stroke-width="2" stroke-linejoin="round" />

      <!-- hover crosshair -->
      <line
        v-if="hover"
        :x1="hover.x"
        :x2="hover.x"
        :y1="margin.top"
        :y2="height - margin.bottom"
        class="hover-line"
      />

      <!-- playback marker -->
      <line
        :x1="marker.x"
        :x2="marker.x"
        :y1="margin.top"
        :y2="height - margin.bottom"
        class="marker-line"
      />
      <circle
        v-if="marker.y !== null"
        :cx="marker.x"
        :cy="marker.y"
        r="4"
        :fill="color"
        class="marker-dot"
      />
    </svg>
    <div class="caption text-caption text-medium-emphasis">
      {{ hover ? hover.label : 'km/h · hover to inspect, click to jump' }}
    </div>
  </div>
</template>

<style scoped>
.chart svg {
  display: block;
  width: 100%;
  height: auto;
  cursor: crosshair;
  color: rgba(255, 255, 255, 0.6); /* D3 axes use currentColor for ticks and labels */
}

.hover-line {
  stroke: rgba(255, 255, 255, 0.35);
  stroke-dasharray: 3 3;
}

.marker-line {
  stroke: white;
  stroke-width: 1.5;
}

.marker-dot {
  stroke: white;
  stroke-width: 2;
}

.caption {
  text-align: center;
  min-height: 20px;
  font-variant-numeric: tabular-nums;
}
</style>
