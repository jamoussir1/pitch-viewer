// Player stats computed from x/y positions. Pure functions, no Vue: easy to unit test.
//
// Rules:
//   - A "step" is the move between two consecutive frames (0.1 s at 10 FPS).
//   - A step only counts if the player is ON CAMERA (vis = true) in BOTH frames.
//     Off-camera positions are estimates, so they must not inflate the stats.
//   - Steps faster than MAX_PLAUSIBLE_SPEED_KMH are tracking glitches
//     (e.g. a goalkeeper "jumping" 1 m per frame when he is re-detected).
import type { Frame, PlayerSample } from '@/types/tracking'

export const MAX_PLAUSIBLE_SPEED_KMH = 36 // about the fastest sprints recorded in LaLiga
export const SMOOTHING_FRAMES = 5 // 0.5 s moving average for the speed curve

/** One entry per frame: the player's sample, or null if he is not in that frame. */
export type Track = (PlayerSample | null)[]

export function getPlayerTrack(frames: Frame[], playerId: number): Track {
  return frames.map(
    (frame) =>
      Object.values(frame.data)
        .flat()
        .find((sample) => sample.id === playerId) ?? null,
  )
}

/**
 * Speed in km/h for each step (index i = move from frame i-1 to frame i).
 * null = we can't trust it (first frame, player missing, off camera, or a glitch).
 */
export function stepSpeeds(track: Track, fps: number): (number | null)[] {
  return track.map((current, i) => {
    const previous = i > 0 ? track[i - 1] : null
    if (!previous || !current || !previous.vis || !current.vis) return null
    const metres = Math.hypot(current.x - previous.x, current.y - previous.y)
    const kmh = metres * fps * 3.6 // metres per frame -> m/s -> km/h
    return kmh <= MAX_PLAUSIBLE_SPEED_KMH ? kmh : null
  })
}

/** Total distance in metres, counting only trusted steps. */
export function totalDistance(speeds: (number | null)[], fps: number): number {
  let metres = 0
  for (const kmh of speeds) {
    if (kmh !== null) metres += kmh / 3.6 / fps // km/h -> m/s -> metres in one frame
  }
  return metres
}

/**
 * Centred moving average. Removes frame-to-frame jitter so the top speed is a
 * real sprint, not one noisy frame. Needs at least 3 trusted values in the window.
 */
export function smoothSpeeds(speeds: (number | null)[], windowSize = SMOOTHING_FRAMES) {
  const half = Math.floor(windowSize / 2)
  return speeds.map((_, i) => {
    const window = speeds.slice(Math.max(0, i - half), i + half + 1)
    const valid = window.filter((value): value is number => value !== null)
    if (valid.length < 3) return null
    return valid.reduce((sum, value) => sum + value, 0) / valid.length
  })
}

/** Highest value, or null if there is none. */
export function topSpeed(speeds: (number | null)[]): number | null {
  const valid = speeds.filter((value): value is number => value !== null)
  return valid.length ? Math.max(...valid) : null
}

export interface PlayerStats {
  distanceMetres: number
  topSpeedKmh: number | null
  onCameraShare: number // 0..1, share of frames where vis = true
  speedSeries: (number | null)[] // smoothed km/h per frame, for the chart
}

export function computePlayerStats(frames: Frame[], playerId: number, fps: number): PlayerStats {
  const track = getPlayerTrack(frames, playerId)
  const raw = stepSpeeds(track, fps)
  const smoothed = smoothSpeeds(raw)
  const onCamera = track.filter((sample) => sample?.vis).length

  return {
    distanceMetres: totalDistance(raw, fps),
    topSpeedKmh: topSpeed(smoothed),
    onCameraShare: track.length ? onCamera / track.length : 0,
    speedSeries: smoothed,
  }
}
