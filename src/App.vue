<script setup lang="ts">
// App = the "container": it owns the data and talks to the store.
// Child components get props and send events back up.
import { computed, watch } from 'vue'

import PitchView from '@/components/PitchView.vue'
import PlaybackControls from '@/components/PlaybackControls.vue'
import PlayerPanel from '@/components/PlayerPanel.vue'
import { useMatchData } from '@/composables/useMatchData'
import { usePlayback } from '@/composables/usePlayback'
import { usePlaybackStore } from '@/stores/playback'
import { interpolateFrame } from '@/utils/interpolate'
import { TEAM_COLORS } from '@/utils/pitch'

// BASE_URL is "/" in dev and "/pitch-viewer/" on GitHub Pages (milestone 5).
const SAMPLE_URL = `${import.meta.env.BASE_URL}data/683253_sample.jsonl`

const { data, loading, error, playersById, reload } = useMatchData(SAMPLE_URL)
const playback = usePlaybackStore()
usePlayback() // starts/stops the requestAnimationFrame loop when playback.playing changes

// When the data arrives, tell the store how many frames there are.
watch(
  data,
  (match) => {
    if (match) playback.reset(match.frames.length, match.info.fps)
  },
  { immediate: true },
)

// The real frame at the current index (used for the clock).
const currentFrame = computed(() => data.value?.frames[playback.frameIndex])

// What we draw: blended between this frame and the next for smooth movement.
const displayFrame = computed(() => {
  const frames = data.value?.frames
  const current = currentFrame.value
  if (!frames || !current) return undefined
  const t = playback.position - playback.frameIndex // 0..1
  return interpolateFrame(current, frames[playback.frameIndex + 1], t)
})
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

    <!-- Right-hand side panel: player list, stats, speed chart -->
    <v-navigation-drawer v-if="data" location="end" permanent :width="380">
      <PlayerPanel
        :players="data.players"
        :frames="data.frames"
        :fps="data.info.fps"
        :home="data.info.home"
        :away="data.info.away"
        :selected-id="playback.selectedPlayerId"
        :position="playback.position"
        @select="playback.selectPlayer"
        @seek="playback.seek"
      />
    </v-navigation-drawer>

    <v-main>
      <v-container class="py-4" max-width="1200">
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

        <v-card v-else-if="data && currentFrame && displayFrame">
          <PitchView
            :frame="displayFrame"
            :players-by-id="playersById"
            :selected-id="playback.selectedPlayerId"
            @select="playback.selectPlayer"
          />
          <PlaybackControls :current-frame="currentFrame" />
          <v-divider />
          <v-card-text class="d-flex flex-wrap ga-4 py-2 text-caption text-medium-emphasis">
            <span>Frame {{ currentFrame.frame }}</span>
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
      &nbsp;(4-minute sample) &nbsp;·&nbsp;
      <a href="https://github.com/jamoussir1/pitch-viewer" target="_blank" rel="noopener">
        Source code
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
  width: 10px;
  height: 10px;
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
