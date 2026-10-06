// Drives the playback store with requestAnimationFrame while `playing` is true.
import { onUnmounted, watch } from 'vue'

import { usePlaybackStore } from '@/stores/playback'

// If the tab was in the background, rAF pauses; don't jump minutes ahead on return.
const MAX_STEP_SECONDS = 0.25

export function usePlayback() {
  const playback = usePlaybackStore()

  let rafId: number | null = null
  let lastTime: number | null = null

  function tick(now: number) {
    if (lastTime !== null) {
      // Time-based, not "one frame per tick": works the same on 60 Hz and 144 Hz screens.
      const elapsed = Math.min((now - lastTime) / 1000, MAX_STEP_SECONDS)
      playback.advance(elapsed * playback.fps * playback.speed)
      if (playback.isAtEnd) playback.pause()
    }
    lastTime = now
    if (playback.playing) rafId = requestAnimationFrame(tick)
  }

  function start() {
    if (rafId !== null) return
    lastTime = null
    rafId = requestAnimationFrame(tick)
  }

  function stop() {
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
  }

  // React to the store: start the loop on play, stop it on pause.
  watch(
    () => playback.playing,
    (isPlaying) => (isPlaying ? start() : stop()),
    { immediate: true },
  )

  // Clean up if the component that called us is removed.
  onUnmounted(stop)
}
