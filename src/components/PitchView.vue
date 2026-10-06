<script setup lang="ts">
// Draws the pitch, the 22 players and the ball for ONE frame, and highlights the selected player.
// Pattern: "D3 computes, Vue renders".
//   - D3 gives us scales (metres -> pixels) and path strings (the arcs).
//   - Vue's template renders the <svg> elements and keeps them in sync with the props.
import { computed } from 'vue'
import { path as d3Path, scaleLinear } from 'd3'

import type { Frame, Player, TeamSide } from '@/types/tracking'
import { PITCH, TEAM_COLORS, isBallOnPitch } from '@/utils/pitch'

const props = defineProps<{
  frame: Frame
  playersById: Map<number, Player>
  selectedId: number | null
}>()

// The component never changes the store itself: it tells the parent what was clicked.
const emit = defineEmits<{
  select: [playerId: number | null]
}>()

// ---------- scales: metres -> pixels ----------

const PX_PER_METRE = 10 // same factor on both axes, so circles stay round
const MARGIN = 4 // metres of grass around the pitch (players and goals go slightly outside)

const width = (PITCH.length + 2 * MARGIN) * PX_PER_METRE // 1130 px
const height = (PITCH.width + 2 * MARGIN) * PX_PER_METRE // 760 px

// Positions: x(0) = left goal line, x(105) = right goal line.
const x = scaleLinear()
  .domain([0, PITCH.length])
  .range([MARGIN * PX_PER_METRE, (PITCH.length + MARGIN) * PX_PER_METRE])
// y(0) = top touchline. The data's y already grows downwards, like SVG, so no flip.
const y = scaleLinear()
  .domain([0, PITCH.width])
  .range([MARGIN * PX_PER_METRE, (PITCH.width + MARGIN) * PX_PER_METRE])
// Lengths (widths, radii) only need the factor, not the offset.
const len = (metres: number) => metres * PX_PER_METRE

// ---------- static pitch markings (computed once) ----------

const midY = PITCH.width / 2

/** A rectangle that touches a goal line: `fromLeft` decides which end of the pitch. */
function boxAtGoal(depth: number, boxWidth: number, fromLeft: boolean) {
  return {
    x: x(fromLeft ? 0 : PITCH.length - depth),
    y: y(midY - boxWidth / 2),
    width: len(depth),
    height: len(boxWidth),
  }
}

const boxes = [
  boxAtGoal(PITCH.penaltyAreaDepth, PITCH.penaltyAreaWidth, true),
  boxAtGoal(PITCH.penaltyAreaDepth, PITCH.penaltyAreaWidth, false),
  boxAtGoal(PITCH.goalAreaDepth, PITCH.goalAreaWidth, true),
  boxAtGoal(PITCH.goalAreaDepth, PITCH.goalAreaWidth, false),
]

const goals = [
  { x: x(-PITCH.goalDepth), y: y(midY - PITCH.goalWidth / 2) },
  { x: x(PITCH.length), y: y(midY - PITCH.goalWidth / 2) },
]

const penaltySpots = [
  { cx: x(PITCH.penaltySpotDistance), cy: y(midY) },
  { cx: x(PITCH.length - PITCH.penaltySpotDistance), cy: y(midY) },
]

/** SVG path string for a circular arc, built with d3.path (angles in radians, 0 = pointing right). */
function arc(cxMetres: number, cyMetres: number, radiusMetres: number, start: number, end: number) {
  const p = d3Path()
  p.arc(x(cxMetres), y(cyMetres), len(radiusMetres), start, end)
  return p.toString()
}

// The "D" outside each penalty area: only the part of the 9.15 m circle around the
// penalty spot that lies outside the box. cos(angle) = (16.5 - 11) / 9.15
const dAngle = Math.acos(
  (PITCH.penaltyAreaDepth - PITCH.penaltySpotDistance) / PITCH.centreCircleRadius,
)
const r = PITCH.centreCircleRadius
const arcs = [
  arc(PITCH.penaltySpotDistance, midY, r, -dAngle, dAngle),
  arc(PITCH.length - PITCH.penaltySpotDistance, midY, r, Math.PI - dAngle, Math.PI + dAngle),
  // corner arcs (quarter circles, clockwise from top-left)
  arc(0, 0, PITCH.cornerArcRadius, 0, Math.PI / 2),
  arc(PITCH.length, 0, PITCH.cornerArcRadius, Math.PI / 2, Math.PI),
  arc(PITCH.length, PITCH.width, PITCH.cornerArcRadius, Math.PI, 1.5 * Math.PI),
  arc(0, PITCH.width, PITCH.cornerArcRadius, 1.5 * Math.PI, 2 * Math.PI),
]

// Mowing stripes: 10 vertical bands of 10.5 m, every other one lighter.
const stripes = Array.from({ length: 10 }, (_, i) => ({
  x: x(i * 10.5),
  width: len(10.5),
  light: i % 2 === 0,
}))

// ---------- dynamic: players and ball for the current frame ----------

const playerMarks = computed(() =>
  Object.values(props.frame.data)
    .flat()
    .map((sample) => {
      const player = props.playersById.get(sample.id)
      const side: TeamSide = player?.side ?? 'home'
      return {
        id: sample.id,
        cx: x(sample.x),
        cy: y(sample.y),
        number: player?.number ?? '?',
        label: player ? `${player.name} (#${player.number})` : `Player ${sample.id}`,
        shortName: player?.name.split(' ').at(-1) ?? '',
        color: TEAM_COLORS[side],
        visible: sample.vis, // false = off camera, position estimated
        selected: sample.id === props.selectedId,
      }
    })
    // SVG has no z-index: later elements are drawn on top, so put the selected player last.
    .sort((a, b) => Number(a.selected) - Number(b.selected)),
)

const hasSelection = computed(() => props.selectedId !== null)

const ballMark = computed(() => {
  const ball = props.frame.ball
  if (!isBallOnPitch(ball)) return null
  return { cx: x(ball.x as number), cy: y(ball.y as number) }
})
</script>

<template>
  <!-- viewBox = drawing coordinates; CSS width 100% makes it scale to any screen -->
  <svg
    :viewBox="`0 0 ${width} ${height}`"
    class="pitch"
    role="img"
    aria-label="Football pitch"
    @click="emit('select', null)"
  >
    <!-- grass -->
    <rect :width="width" :height="height" fill="#2e7d32" />
    <rect
      v-for="(stripe, i) in stripes"
      :key="`stripe-${i}`"
      :x="stripe.x"
      :y="y(0)"
      :width="stripe.width"
      :height="len(PITCH.width)"
      :fill="stripe.light ? '#388e3c' : '#2e7d32'"
    />

    <!-- lines -->
    <g class="lines">
      <rect :x="x(0)" :y="y(0)" :width="len(PITCH.length)" :height="len(PITCH.width)" />
      <line :x1="x(PITCH.length / 2)" :y1="y(0)" :x2="x(PITCH.length / 2)" :y2="y(PITCH.width)" />
      <circle :cx="x(PITCH.length / 2)" :cy="y(midY)" :r="len(PITCH.centreCircleRadius)" />
      <rect v-for="(box, i) in boxes" :key="`box-${i}`" v-bind="box" />
      <rect
        v-for="(goal, i) in goals"
        :key="`goal-${i}`"
        :x="goal.x"
        :y="goal.y"
        :width="len(PITCH.goalDepth)"
        :height="len(PITCH.goalWidth)"
      />
      <path v-for="(d, i) in arcs" :key="`arc-${i}`" :d="d" />
    </g>
    <circle :cx="x(PITCH.length / 2)" :cy="y(midY)" r="3" fill="white" />
    <circle v-for="(spot, i) in penaltySpots" :key="`spot-${i}`" v-bind="spot" r="3" fill="white" />

    <!-- players: on camera = filled disc, off camera = hollow dashed ring in team colour -->
    <g
      v-for="mark in playerMarks"
      :key="mark.id"
      :transform="`translate(${mark.cx}, ${mark.cy})`"
      :opacity="hasSelection && !mark.selected ? 0.7 : 1"
      class="player"
      @click.stop="emit('select', mark.id)"
    >
      <title>{{ mark.label }}</title>
      <!-- highlight ring for the selected player -->
      <circle v-if="mark.selected" r="18" class="highlight" />
      <circle v-if="mark.visible" r="12" :fill="mark.color" stroke="white" stroke-width="2" />
      <circle
        v-else
        r="12"
        fill="rgba(0, 0, 0, 0.35)"
        :stroke="mark.color"
        stroke-width="3"
        stroke-dasharray="4 3"
      />
      <text class="number" :opacity="mark.visible ? 1 : 0.8">{{ mark.number }}</text>
      <text v-if="mark.selected" y="32" class="name">{{ mark.shortName }}</text>
    </g>

    <!-- ball (drawn last so it is on top) -->
    <circle
      v-if="ballMark"
      :cx="ballMark.cx"
      :cy="ballMark.cy"
      r="6"
      fill="white"
      stroke="#212121"
      stroke-width="2"
    />
  </svg>
</template>

<style scoped>
.pitch {
  display: block;
  width: 100%;
  height: auto;
  /* keep the playback controls visible below the pitch on laptop screens */
  max-height: calc(100vh - 250px);
}

.lines {
  fill: none;
  stroke: rgba(255, 255, 255, 0.85);
  stroke-width: 2;
}

.player {
  cursor: pointer;
}

.highlight {
  fill: rgba(255, 214, 0, 0.25);
  stroke: #ffd600;
  stroke-width: 3;
}

.name {
  fill: white;
  font-size: 13px;
  font-weight: 700;
  text-anchor: middle;
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.7);
  stroke-width: 3px;
  pointer-events: none;
}

.number {
  fill: white;
  font-size: 12px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
}
</style>
