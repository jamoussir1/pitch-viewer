import { describe, expect, it } from 'vitest'

import type { Frame, PlayerSample } from '@/types/tracking'
import {
  MAX_PLAUSIBLE_SPEED_KMH,
  computePlayerStats,
  getPlayerTrack,
  smoothSpeeds,
  stepSpeeds,
  topSpeed,
  totalDistance,
  type Track,
} from '@/utils/stats'

const FPS = 10

/** Small helper: a visible (or hidden) sample at x, y. */
function at(x: number, y = 0, vis = true): PlayerSample {
  return { id: 7, vis, x, y }
}

/** Build frames for one player from a list of samples (null = not in that frame). */
function framesFor(samples: (PlayerSample | null)[]): Frame[] {
  return samples.map((sample, i) => ({
    frame: i,
    period: 1,
    match_clock: [0, 0],
    ball: { x: null, y: null, z: null },
    data: { '1': sample ? [sample] : [] },
  }))
}

describe('getPlayerTrack', () => {
  it('returns one entry per frame, null when the player is missing', () => {
    const track = getPlayerTrack(framesFor([at(0), null, at(2)]), 7)
    expect(track).toHaveLength(3)
    expect(track[1]).toBeNull()
    expect(track[2]?.x).toBe(2)
  })
})

describe('stepSpeeds', () => {
  it('converts metres per frame to km/h', () => {
    // 0.5 m in 0.1 s = 5 m/s = 18 km/h
    const speeds = stepSpeeds([at(0), at(0.5)], FPS)
    expect(speeds[0]).toBeNull() // no previous frame
    expect(speeds[1]).toBeCloseTo(18)
  })

  it('uses both x and y (Pythagoras)', () => {
    // 3-4-5 triangle scaled down: 0.3 m and 0.4 m -> 0.5 m -> 18 km/h
    const speeds = stepSpeeds([at(0, 0), at(0.3, 0.4)], FPS)
    expect(speeds[1]).toBeCloseTo(18)
  })

  it('ignores steps where the player is off camera in either frame', () => {
    const track: Track = [at(0), at(0.5, 0, false), at(1), at(1.5)]
    const speeds = stepSpeeds(track, FPS)
    expect(speeds[1]).toBeNull() // visible -> hidden
    expect(speeds[2]).toBeNull() // hidden -> visible
    expect(speeds[3]).toBeCloseTo(18) // visible -> visible
  })

  it('ignores steps where the player is missing', () => {
    expect(stepSpeeds([at(0), null, at(1)], FPS)).toEqual([null, null, null])
  })

  it('ignores impossible speeds (tracking glitches)', () => {
    const tooFastMetres = ((MAX_PLAUSIBLE_SPEED_KMH + 5) / 3.6) * 0.1
    expect(stepSpeeds([at(0), at(tooFastMetres)], FPS)[1]).toBeNull()
  })
})

describe('totalDistance', () => {
  it('adds up the trusted steps only', () => {
    // 3 visible steps of 0.5 m, then the player goes off camera for 2 steps
    const track: Track = [at(0), at(0.5), at(1), at(1.5), at(2, 0, false), at(2.5, 0, false)]
    const distance = totalDistance(stepSpeeds(track, FPS), FPS)
    expect(distance).toBeCloseTo(1.5)
  })

  it('is 0 for a player who never appears on camera', () => {
    const track: Track = [at(0, 0, false), at(5, 0, false)]
    expect(totalDistance(stepSpeeds(track, FPS), FPS)).toBe(0)
  })
})

describe('smoothSpeeds and topSpeed', () => {
  it('averages over a 5-frame window', () => {
    const smoothed = smoothSpeeds([10, 10, 30, 10, 10])
    expect(smoothed[2]).toBeCloseTo(14) // (10+10+30+10+10) / 5
  })

  it('returns null when the window has fewer than 3 trusted values', () => {
    const smoothed = smoothSpeeds([null, null, 20, null, null])
    expect(smoothed[2]).toBeNull()
  })

  it('a single noisy frame does not become the top speed', () => {
    const raw = [10, 10, 10, 35, 10, 10, 10]
    expect(topSpeed(raw)).toBe(35)
    expect(topSpeed(smoothSpeeds(raw))).toBeLessThan(20)
  })

  it('topSpeed is null when there is no data', () => {
    expect(topSpeed([null, null])).toBeNull()
  })
})

describe('computePlayerStats', () => {
  it('combines distance, top speed and on-camera share', () => {
    // 10 frames, constant 18 km/h (0.5 m per frame), last 2 frames off camera
    const samples = Array.from({ length: 10 }, (_, i) => at(i * 0.5, 0, i < 8))
    const stats = computePlayerStats(framesFor(samples), 7, FPS)

    expect(stats.distanceMetres).toBeCloseTo(3.5) // 7 visible steps x 0.5 m
    expect(stats.topSpeedKmh).toBeCloseTo(18)
    expect(stats.onCameraShare).toBeCloseTo(0.8)
    expect(stats.speedSeries).toHaveLength(10)
  })
})
