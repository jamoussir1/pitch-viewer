// Types for the Driblab tracking data.
// "Raw" types mirror the JSON exactly; the others are the cleaner shapes the app uses.

export type TeamSide = 'home' | 'away'

// ---------- raw file format ----------

/** Line 1 of the file. */
export interface RawMetadata {
  match_data: {
    season_data: { name: string; id: number } // e.g. "ESP I 2025"
    date: string // "2025-11-29"
    match_id: number
    result: { home: number; away: number }
  }
  teams_data: Record<TeamSide, { name: string; id: number }>
  // teamId -> playerId -> player info (ids are strings because they are JSON keys)
  players_data: Record<string, Record<string, { number: number; name: string; position: string }>>
  FPS: number
  // Added by scripts/make-sample.mjs
  sample?: { source: string; startFrame: number; endFrame: number }
}

/** One player in one frame (after make-sample.mjs trimmed it). */
export interface PlayerSample {
  id: number
  vis: boolean // false = off camera, position is estimated
  x: number // metres, 0..105, left -> right
  y: number // metres, 0..68, top -> bottom
}

export interface Ball {
  x: number | null
  y: number | null
  z: number | null
}

/** Every line after the first. */
export interface Frame {
  frame: number // 10 per second
  period: number // 1 or 2
  match_clock: [number, number] // [minutes, seconds]
  ball: Ball
  data: Record<string, PlayerSample[]> // teamId -> players
}

// ---------- shapes the app uses ----------

export interface Team {
  id: number
  name: string
  side: TeamSide
  score: number
}

export interface Player {
  id: number
  name: string
  number: number
  position: string
  teamId: number
  side: TeamSide
}

export interface MatchInfo {
  id: number
  competition: string // "LaLiga 2025/26"
  date: string // "29 Nov 2025"
  fps: number
  home: Team
  away: Team
}

export interface MatchData {
  info: MatchInfo
  players: Player[] // only the players who appear in the frames
  frames: Frame[]
}
