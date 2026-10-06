<script setup lang="ts">
// Milestone 1: load the sample and show what we got (a "data check" screen).
// In milestone 2 the card below is replaced by the pitch.
import { computed } from 'vue'

import { useMatchData } from '@/composables/useMatchData'

// BASE_URL is "/" in dev and "/pitch-viewer/" on GitHub Pages (milestone 5).
const SAMPLE_URL = `${import.meta.env.BASE_URL}data/683253_sample.jsonl`

const { data, loading, error, frameCount, durationSeconds, reload } = useMatchData(SAMPLE_URL)

const firstFrame = computed(() => data.value?.frames[0])
const lastFrame = computed(() => data.value?.frames.at(-1))

const formatClock = (clock?: [number, number]) =>
  clock ? `${clock[0]}:${String(clock[1]).padStart(2, '0')}` : '-'
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable">
      <v-app-bar-title>
        <v-icon icon="mdi-soccer-field" class="mr-2" />
        Pitch Viewer
      </v-app-bar-title>
      <template v-if="data" #append>
        <span class="text-subtitle-1 mr-4">
          {{ data.info.home.name }} {{ data.info.home.score }} - {{ data.info.away.score }}
          {{ data.info.away.name }}
        </span>
      </template>
    </v-app-bar>

    <v-main>
      <v-container class="py-8" max-width="720">
        <div v-if="loading" class="text-center py-16">
          <v-progress-circular indeterminate color="primary" size="48" />
          <p class="mt-4">Loading tracking data…</p>
        </div>

        <v-alert v-else-if="error" type="error" title="Could not load the data">
          {{ error }}
          <template #append>
            <v-btn variant="outlined" @click="reload">Retry</v-btn>
          </template>
        </v-alert>

        <v-card
          v-else-if="data"
          title="Data check"
          subtitle="Milestone 1"
          prepend-icon="mdi-database-check"
        >
          <v-list density="compact">
            <v-list-item
              prepend-icon="mdi-trophy"
              :title="data.info.competition"
              :subtitle="data.info.date"
            />
            <v-list-item
              prepend-icon="mdi-filmstrip"
              :title="`${frameCount} frames (${(durationSeconds / 60).toFixed(1)} min at ${data.info.fps} FPS)`"
              :subtitle="`Clock ${formatClock(firstFrame?.match_clock)} -> ${formatClock(lastFrame?.match_clock)}`"
            />
            <v-list-item
              prepend-icon="mdi-account-group"
              :title="`${data.players.length} players on the pitch`"
            />
          </v-list>

          <v-table density="compact" height="360" fixed-header>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Pos</th>
                <th>Team</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="player in data.players" :key="player.id">
                <td>{{ player.number }}</td>
                <td>{{ player.name }}</td>
                <td>{{ player.position }}</td>
                <td>{{ player.side === 'home' ? data.info.home.name : data.info.away.name }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-container>
    </v-main>

    <v-footer app class="text-caption justify-center">
      Data: &nbsp;
      <a href="https://github.com/driblab/open-data" target="_blank" rel="noopener">
        Driblab open-data
      </a>
    </v-footer>
  </v-app>
</template>
