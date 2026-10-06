// Linear interpolation between two tracking frames.
// The data is 10 FPS but screens draw ~60 FPS; blending neighbouring frames makes
// movement smooth instead of jumping every 100 ms.
import type { Ball, Frame, PlayerSample } from '@/types/tracking'

/** lerp(0, 10, 0.25) = 2.5 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function interpolateBall(a: Ball, b: Ball, t: number): Ball {
  if (a.x === null || a.y === null || b.x === null || b.y === null) return a
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: a.z !== null && b.z !== null ? lerp(a.z, b.z, t) : a.z,
  }
}

/**
 * Frame "between" a and b. t = 0 -> a, t = 1 -> b.
 * Players missing from b keep their position from a.
 */
export function interpolateFrame(a: Frame, b: Frame | undefined, t: number): Frame {
  if (!b || t <= 0) return a

  const next = new Map<number, PlayerSample>()
  for (const sample of Object.values(b.data).flat()) next.set(sample.id, sample)

  const data: Frame['data'] = {}
  for (const [teamId, samples] of Object.entries(a.data)) {
    data[teamId] = samples.map((sample) => {
      const target = next.get(sample.id)
      if (!target) return sample
      return { ...sample, x: lerp(sample.x, target.x, t), y: lerp(sample.y, target.y, t) }
    })
  }

  return { ...a, data, ball: interpolateBall(a.ball, b.ball, t) }
}
