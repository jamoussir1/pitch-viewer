// Pure functions: text in -> typed data out. No Vue, no fetch, so they are easy to test.
import type { Frame, MatchData, MatchInfo, Player, RawMetadata, TeamSide } from '@/types/tracking'

const COMPETITIONS: Record<string, string> = {
  'ENG I': 'Premier League',
  'ESP I': 'LaLiga',
  'ITA I': 'Serie A',
  'GER I': 'Bundesliga',
  'FRA I': 'Ligue 1',
  UCL: 'Champions League',
}

/** "ESP I 2025" -> "LaLiga 2025/26" */
export function competitionLabel(seasonName: string): string {
  const parts = seasonName.trim().split(' ')
  const year = Number(parts.pop())
  const code = parts.join(' ')
  const name = COMPETITIONS[code] ?? code
  return Number.isFinite(year) ? `${name} ${year}/${String(year + 1).slice(-2)}` : seasonName
}

/** "2025-11-29" -> "29 Nov 2025" */
export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function toMatchInfo(meta: RawMetadata): MatchInfo {
  const { match_data: match, teams_data: teams } = meta
  return {
    id: match.match_id,
    competition: competitionLabel(match.season_data.name),
    date: formatDate(match.date),
    fps: meta.FPS,
    home: { id: teams.home.id, name: teams.home.name, side: 'home', score: match.result.home },
    away: { id: teams.away.id, name: teams.away.name, side: 'away', score: match.result.away },
  }
}

/** Players who appear in at least one frame, sorted home first, then by shirt number. */
function toPlayers(meta: RawMetadata, frames: Frame[], info: MatchInfo): Player[] {
  const sideByTeamId: Record<string, TeamSide> = {
    [info.home.id]: 'home',
    [info.away.id]: 'away',
  }

  // teamId:playerId pairs seen in the frames (a Set removes duplicates)
  const seen = new Set<string>()
  for (const frame of frames) {
    for (const [teamId, samples] of Object.entries(frame.data)) {
      for (const sample of samples) seen.add(`${teamId}:${sample.id}`)
    }
  }

  const players: Player[] = []
  for (const key of seen) {
    const [teamId = '', playerId = ''] = key.split(':')
    const side = sideByTeamId[teamId]
    if (!side) continue
    const details = meta.players_data[teamId]?.[playerId]
    players.push({
      id: Number(playerId),
      name: details?.name.trim() ?? `Player ${playerId}`,
      number: details?.number ?? 0,
      position: details?.position ?? '?',
      teamId: Number(teamId),
      side,
    })
  }

  return players.sort((a, b) =>
    a.side === b.side ? a.number - b.number : a.side === 'home' ? -1 : 1,
  )
}

/** Parse a whole JSON Lines file: first line metadata, every other line a frame. */
export function parseTrackingJsonl(text: string): MatchData {
  const lines = text.split('\n').filter((line) => line.trim() !== '')
  const [firstLine, ...frameLines] = lines
  if (!firstLine || frameLines.length === 0) {
    throw new Error('Tracking file needs a metadata line and at least one frame')
  }

  const meta = JSON.parse(firstLine) as RawMetadata
  const frames = frameLines.map((line) => JSON.parse(line) as Frame)
  const info = toMatchInfo(meta)
  const players = toPlayers(meta, frames, info)

  return { info, players, frames }
}
