<script setup lang="ts">
// Play/pause, step, time slider, speed and the match clock.
// Reads and writes the Pinia store directly, so it needs almost no props.
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import type { Frame } from '@/types/tracking'
import { SPEEDS, usePlaybackStore } from '@/stores/playback'
import { formatClock, formatSeconds, periodLabel } from '@/utils/format'

defineProps<{
  currentFrame: Frame // the real (not interpolated) frame, for the clock
}>()

const playback = usePlaybackStore()
// storeToRefs keeps reactivity when destructuring (plain destructuring would lose it).
const { playing, lastIndex, elapsedSeconds, durationSeconds, fps } = storeToRefs(playback)

// Writable computed: the slider reads the frame index and writes through the store action.
const sliderValue = computed({
  get: () => playback.frameIndex,
  set: (index: number) => playback.seek(index),
})

const speedModel = computed({
  get: () => playback.speed,
  set: (value: number) => playback.setSpeed(value),
})

function stepSeconds(seconds: number) {
  playback.seek(playback.frameIndex + seconds * fps.value)
}
</script>

<template>
  <div class="controls">
    <div class="d-flex align-center ga-1">
      <v-btn icon="mdi-step-backward" variant="text" title="Back 1 s" @click="stepSeconds(-1)" />
      <v-btn
        :icon="playing ? 'mdi-pause' : 'mdi-play'"
        color="primary"
        variant="flat"
        :title="playing ? 'Pause' : 'Play'"
        @click="playback.togglePlay()"
      />
      <v-btn icon="mdi-step-forward" variant="text" title="Forward 1 s" @click="stepSeconds(1)" />
    </div>

    <div class="clock">
      <div class="text-h6">{{ formatClock(currentFrame.match_clock) }}</div>
      <div class="text-caption text-medium-emphasis">{{ periodLabel(currentFrame.period) }}</div>
    </div>

    <v-slider
      v-model="sliderValue"
      class="slider"
      :min="0"
      :max="lastIndex"
      :step="1"
      color="primary"
      hide-details
    />

    <span class="text-body-2 text-medium-emphasis time">
      {{ formatSeconds(elapsedSeconds) }} / {{ formatSeconds(durationSeconds) }}
    </span>

    <v-btn-toggle v-model="speedModel" mandatory divided density="compact" variant="outlined">
      <v-btn v-for="speed in SPEEDS" :key="speed" :value="speed">{{ speed }}×</v-btn>
    </v-btn-toggle>
  </div>
</template>

<style scoped>
.controls {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  flex-wrap: wrap;
}

.clock {
  min-width: 72px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.slider {
  flex: 1 1 240px;
}

.time {
  font-variant-numeric: tabular-nums;
  min-width: 84px;
}
</style>
