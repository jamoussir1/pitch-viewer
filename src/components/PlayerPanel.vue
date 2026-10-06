<script setup lang="ts">
// Side panel: player list + stats and speed chart for the selected player.
// "Presentational" component: everything comes in as props, user actions go out as events.
import { computed } from 'vue'

import SpeedChart from '@/components/SpeedChart.vue'
import type { Frame, Player, Team } from '@/types/tracking'
import { TEAM_COLORS } from '@/utils/pitch'
import { computePlayerStats } from '@/utils/stats'

const props = defineProps<{
  players: Player[]
  frames: Frame[]
  fps: number
  home: Team
  away: Team
  selectedId: number | null
  position: number // playback position, only passed through to the chart marker
}>()

const emit = defineEmits<{
  select: [playerId: number | null]
  seek: [frameIndex: number]
}>()

const selected = computed(() => props.players.find((p) => p.id === props.selectedId) ?? null)

// Depends on the selected player and the frames only, NOT on `position`:
// it is computed once per selection, not 60 times a second while playing.
const stats = computed(() =>
  selected.value ? computePlayerStats(props.frames, selected.value.id, props.fps) : null,
)

const teamsWithPlayers = computed(() =>
  [props.home, props.away].map((team) => ({
    ...team,
    players: props.players.filter((player) => player.side === team.side),
  })),
)

const selectedTeamName = computed(() =>
  selected.value?.side === 'home' ? props.home.name : props.away.name,
)
</script>

<template>
  <div class="panel">
    <!-- Selected player: stats + chart -->
    <v-card v-if="selected && stats" variant="tonal" class="ma-3">
      <v-card-item>
        <template #prepend>
          <v-avatar :color="TEAM_COLORS[selected.side]" class="font-weight-bold">
            {{ selected.number }}
          </v-avatar>
        </template>
        <v-card-title>{{ selected.name }}</v-card-title>
        <v-card-subtitle>{{ selected.position }} · {{ selectedTeamName }}</v-card-subtitle>
        <template #append>
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            title="Clear selection"
            @click="emit('select', null)"
          />
        </template>
      </v-card-item>

      <v-card-text>
        <div class="stats">
          <div>
            <div class="stat-value">{{ Math.round(stats.distanceMetres) }} m</div>
            <div class="stat-label">Distance</div>
          </div>
          <div>
            <div class="stat-value">{{ stats.topSpeedKmh?.toFixed(1) ?? '–' }} km/h</div>
            <div class="stat-label">Top speed</div>
          </div>
          <div>
            <div class="stat-value">{{ Math.round(stats.onCameraShare * 100) }}%</div>
            <div class="stat-label">On camera</div>
          </div>
        </div>

        <div class="text-caption text-medium-emphasis mt-2 text-center">
          Counted only while on camera · top speed = 0.5 s average
        </div>

        <div class="text-overline mt-3">Speed over time</div>
        <SpeedChart
          :speeds="stats.speedSeries"
          :fps="fps"
          :position="position"
          :color="TEAM_COLORS[selected.side]"
          @seek="emit('seek', $event)"
        />
      </v-card-text>
    </v-card>

    <div v-else class="pa-4 text-body-2 text-medium-emphasis">
      <v-icon icon="mdi-gesture-tap" class="mr-1" />
      Pick a player from the list, or click one on the pitch.
    </div>

    <!-- Player list, grouped by team -->
    <v-list density="compact" nav>
      <template v-for="team in teamsWithPlayers" :key="team.id">
        <v-list-subheader>
          <span class="team-dot" :style="{ background: TEAM_COLORS[team.side] }" />
          {{ team.name }}
        </v-list-subheader>
        <v-list-item
          v-for="player in team.players"
          :key="player.id"
          :active="player.id === selectedId"
          :title="player.name"
          :subtitle="player.position"
          @click="emit('select', player.id)"
        >
          <template #prepend>
            <v-avatar size="28" :color="TEAM_COLORS[player.side]" class="mr-3 text-caption">
              {{ player.number }}
            </v-avatar>
          </template>
        </v-list-item>
      </template>
    </v-list>
  </div>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  text-align: center;
}

.stat-value {
  font-size: 1.15rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 0.72rem;
  opacity: 0.7;
}

.team-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 6px;
}
</style>
