<script setup lang="ts">
// Milestone 2: header with match info + the pitch showing the FIRST frame of the sample.
// In milestone 3, `currentFrame` will follow the playback instead of always being frame 0.
import { computed } from 'vue'

import PitchView from '@/components/PitchView.vue'
import { useMatchData } from '@/composables/useMatchData'
import { formatClock, periodLabel } from '@/utils/format'
import { TEAM_COLORS } from '@/utils/pitch'

// BASE_URL is "/" in dev and "/pitch-viewer/" on GitHub Pages (milestone 5).
const SAMPLE_URL = `${import.meta.env.BASE_URL}data/683253_sample.jsonl`

const { data, loading, error, playersById, reload } = useMatchData(SAMPLE_URL)

const currentFrame = computed(() => data.value?.frames[0])
</script>

<template>
  <v-app>
    <v-app-bar color="surface" density="comfortable" border="b">
      <v-app-bar-title class="flex-0-0">
        <v-icon icon="mdi-soccer-field" class="mr-2" />
        Pitch Viewer
      </v-app-bar-title>

      <!-- Header: teams, score, competition, date -->
      <template v-if="data">
        <v-spacer />
        <div class="scoreline">
          <span class="team-dot" :style="{ background: TEAM_COLORS.home }" />
          <span>{{ data.info.home.name }}</span>
          <strong class="score">{{ data.info.home.score }} - {{ data.info.away.score }}</strong>
          <span>{{ data.info.away.name }}</span>
          <span class="team-dot" :style="{ background: TEAM_COLORS.away }" />
        </div>
        <v-spacer />
        <v-chip class="mr-4" prepend-icon="mdi-trophy-outline" variant="tonal">
          {{ data.info.competition }} · {{ data.info.date }}
        </v-chip>
      </template>
    </v-app-bar>

    <v-main>
      <v-container class="py-6" max-width="1200">
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

        <v-card v-else-if="data && currentFrame">
          <PitchView :frame="currentFrame" :players-by-id="playersById" />
          <v-card-text class="d-flex flex-wrap ga-4 align-center text-medium-emphasis">
            <span>
              <v-icon icon="mdi-clock-outline" size="small" />
              {{ formatClock(currentFrame.match_clock) }} · {{ periodLabel(currentFrame.period) }} ·
              frame {{ currentFrame.frame }}
            </span>
            <v-spacer />
            <span><span class="legend" /> on camera</span>
            <span><span class="legend faded" /> off camera (estimated position)</span>
          </v-card-text>
        </v-card>
      </v-container>
    </v-main>

    <v-footer app class="text-caption justify-center">
      Tracking data: &nbsp;
      <a href="https://github.com/driblab/open-data" target="_blank" rel="noopener">
        Driblab open-data
      </a>
    </v-footer>
  </v-app>
</template>

<style scoped>
.scoreline {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.05rem;
}

.score {
  font-size: 1.3rem;
  padding: 0 6px;
}

.team-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}

.legend {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
  background: #9e9e9e;
  vertical-align: middle;
}

.legend.faded {
  background: rgba(0, 0, 0, 0.35);
  border: 2px dashed #9e9e9e;
}
</style>
