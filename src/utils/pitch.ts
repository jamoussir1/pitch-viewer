// Pitch geometry and colours. Pure data + functions, no Vue.
// All distances in metres (FIFA standard pitch, 105 x 68).
import type { Ball, TeamSide } from '@/types/tracking'

export const PITCH = {
  length: 105, // x: 0 (left goal line) -> 105 (right goal line)
  width: 68, // y: 0 (top touchline) -> 68 (bottom touchline)
  centreCircleRadius: 9.15,
  penaltyAreaDepth: 16.5,
  penaltyAreaWidth: 40.32,
  goalAreaDepth: 5.5,
  goalAreaWidth: 18.32,
  penaltySpotDistance: 11,
  goalWidth: 7.32,
  goalDepth: 2, // drawn behind the goal line
  cornerArcRadius: 1,
} as const

export const TEAM_COLORS: Record<TeamSide, string> = {
  home: '#d32f2f', // red
  away: '#1e88e5', // blue
}

/** The ball is often missing or has junk values (we saw y = 207 in milestone 0). */
export function isBallOnPitch(ball: Ball, toleranceMetres = 5): boolean {
  if (ball.x === null || ball.y === null) return false
  return (
    ball.x >= -toleranceMetres &&
    ball.x <= PITCH.length + toleranceMetres &&
    ball.y >= -toleranceMetres &&
    ball.y <= PITCH.width + toleranceMetres
  )
}
