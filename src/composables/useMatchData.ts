// Loads one tracking sample over HTTP and exposes it as reactive state.
import { computed, ref, shallowRef } from 'vue'

import type { MatchData, Player } from '@/types/tracking'
import { parseTrackingJsonl } from '@/utils/parseTracking'

export function useMatchData(url: string) {
  // shallowRef: Vue only tracks when `data.value` is replaced, not every nested
  // object. 2,400 frames x 22 players would mean ~50,000 reactive proxies otherwise,
  // and we never mutate the frames anyway.
  const data = shallowRef<MatchData | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status} while loading ${url}`)
      data.value = parseTrackingJsonl(await response.text())
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  // Derived values: recalculated only when `data` changes.
  const frameCount = computed(() => data.value?.frames.length ?? 0)
  const durationSeconds = computed(() => (data.value ? frameCount.value / data.value.info.fps : 0))
  const playersById = computed(() => {
    const map = new Map<number, Player>()
    for (const player of data.value?.players ?? []) map.set(player.id, player)
    return map
  })

  // Start loading as soon as a component calls the composable.
  load()

  return { data, loading, error, frameCount, durationSeconds, playersById, reload: load }
}
