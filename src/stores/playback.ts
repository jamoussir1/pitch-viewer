// Pinia store: the single source of truth for playback.
// Any component can read or change it (controls, pitch, later the player panel).
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export const SPEEDS = [1, 2, 4] as const

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export const usePlaybackStore = defineStore('playback', () => {
  // ---------- state ----------
  // `position` is a FRACTIONAL frame index, e.g. 123.4 = 40% of the way from frame 123 to 124.
  // The fraction lets us interpolate between frames for smooth movement.
  const position = ref(0)
  const playing = ref(false)
  const speed = ref<number>(1)
  const frameCount = ref(0)
  const fps = ref(10)

  // ---------- getters (computed) ----------
  const frameIndex = computed(() => Math.floor(position.value))
  const lastIndex = computed(() => Math.max(frameCount.value - 1, 0))
  const isAtEnd = computed(() => position.value >= lastIndex.value)
  const elapsedSeconds = computed(() => position.value / fps.value)
  const durationSeconds = computed(() => lastIndex.value / fps.value)

  // ---------- actions ----------
  /** Called once when a match is loaded. */
  function reset(count: number, framesPerSecond: number) {
    frameCount.value = count
    fps.value = framesPerSecond
    position.value = 0
    playing.value = false
  }

  function seek(index: number) {
    position.value = clamp(index, 0, lastIndex.value)
  }

  function advance(frames: number) {
    seek(position.value + frames)
  }

  function play() {
    if (isAtEnd.value) position.value = 0 // pressing play at the end restarts
    playing.value = true
  }

  function pause() {
    playing.value = false
  }

  function togglePlay() {
    if (playing.value) pause()
    else play()
  }

  function setSpeed(value: number) {
    speed.value = value
  }

  return {
    position,
    playing,
    speed,
    frameCount,
    fps,
    frameIndex,
    lastIndex,
    isAtEnd,
    elapsedSeconds,
    durationSeconds,
    reset,
    seek,
    advance,
    play,
    pause,
    togglePlay,
    setSpeed,
  }
})
