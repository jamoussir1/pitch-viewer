import { describe, expect, it } from 'vitest'

import type { Frame } from '@/types/tracking'
import { interpolateFrame, lerp } from '@/utils/interpolate'

function frame(x: number, ballX: number | null): Frame {
  return {
    frame: 0,
    period: 1,
    match_clock: [0, 0],
    ball: { x: ballX, y: ballX === null ? null : 34, z: 0 },
    data: { '1': [{ id: 7, vis: true, x, y: 10 }] },
  }
}

describe('lerp', () => {
  it('blends two numbers', () => {
    expect(lerp(0, 10, 0)).toBe(0)
    expect(lerp(0, 10, 0.25)).toBe(2.5)
    expect(lerp(0, 10, 1)).toBe(10)
  })
})

describe('interpolateFrame', () => {
  it('moves players part of the way to the next frame', () => {
    const result = interpolateFrame(frame(10, 50), frame(20, 60), 0.4)
    expect(result.data['1']?.[0]?.x).toBeCloseTo(14)
    expect(result.data['1']?.[0]?.y).toBe(10)
    expect(result.ball.x).toBeCloseTo(54)
  })

  it('returns the first frame when t = 0 or there is no next frame', () => {
    const a = frame(10, 50)
    expect(interpolateFrame(a, frame(20, 60), 0)).toBe(a)
    expect(interpolateFrame(a, undefined, 0.5)).toBe(a)
  })

  it('does not invent a ball position when one frame has no ball', () => {
    const result = interpolateFrame(frame(10, 50), frame(20, null), 0.5)
    expect(result.ball.x).toBe(50)
  })
})
