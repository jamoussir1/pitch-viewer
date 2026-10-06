import { describe, expect, it } from 'vitest'

import { competitionLabel, parseTrackingJsonl } from '@/utils/parseTracking'
import { isBallOnPitch } from '@/utils/pitch'

const metadata = {
  match_data: {
    season_data: { name: 'ESP I 2025', id: 1 },
    date: '2025-11-29',
    match_id: 683253,
    result: { home: 2, away: 0 },
  },
  teams_data: { home: { name: 'Home FC', id: 1 }, away: { name: 'Away FC', id: 2 } },
  players_data: {
    '1': { '10': { number: 9, name: 'Striker ', position: 'FW' } },
    '2': { '20': { number: 1, name: 'Keeper', position: 'GK' } },
    // a substitute who never appears in the frames
    '3': { '30': { number: 12, name: 'Sub', position: 'MC' } },
  },
  FPS: 10,
}

const frameLine = JSON.stringify({
  frame: 0,
  period: 1,
  match_clock: [0, 1],
  ball: { x: 50, y: 30, z: 0 },
  data: {
    '1': [{ id: 10, vis: true, x: 60, y: 30 }],
    '2': [{ id: 20, vis: false, x: 2, y: 34 }],
  },
})

describe('parseTrackingJsonl', () => {
  const text = `${JSON.stringify(metadata)}\n${frameLine}\n${frameLine}\n`

  it('reads metadata and frames', () => {
    const match = parseTrackingJsonl(text)
    expect(match.frames).toHaveLength(2)
    expect(match.info.home).toMatchObject({ name: 'Home FC', score: 2, side: 'home' })
    expect(match.info.competition).toBe('LaLiga 2025/26')
  })

  it('lists only players who appear in the frames, home first, with trimmed names', () => {
    const { players } = parseTrackingJsonl(text)
    expect(players.map((p) => p.name)).toEqual(['Striker', 'Keeper'])
    expect(players[0]?.side).toBe('home')
  })

  it('throws a clear error for an empty file', () => {
    expect(() => parseTrackingJsonl('')).toThrow(/metadata line/)
  })
})

describe('competitionLabel', () => {
  it('maps Driblab codes to readable names', () => {
    expect(competitionLabel('UCL 2025')).toBe('Champions League 2025/26')
    expect(competitionLabel('XYZ 2025')).toBe('XYZ 2025/26')
  })
})

describe('isBallOnPitch', () => {
  it('hides missing or far-away balls', () => {
    expect(isBallOnPitch({ x: 50, y: 30, z: 0 })).toBe(true)
    expect(isBallOnPitch({ x: null, y: null, z: null })).toBe(false)
    expect(isBallOnPitch({ x: 76, y: 207, z: 0 })).toBe(false) // junk value seen in the data
  })
})
