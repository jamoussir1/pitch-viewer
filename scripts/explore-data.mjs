// scripts/explore-data.mjs
//
// Reads one Driblab tracking file (JSON Lines) line by line and prints:
//   1. the match metadata (first line)
//   2. one example frame where players and ball are present
//   3. summary stats: frame counts, periods, timing, visibility, and the
//      min/max of x and y, so we can work out the pitch coordinate system.
//
// Usage:
//   node scripts/explore-data.mjs data-raw/683253_tracking_data.jsonl

import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: node scripts/explore-data.mjs <path-to-tracking_data.jsonl>')
  process.exit(1)
}

// ---------- small helpers ----------

/** A {min, max} pair that we widen as we see new values. */
function newRange() {
  return { min: Infinity, max: -Infinity }
}

function updateRange(range, value) {
  if (value === null || value === undefined) return
  if (value < range.min) range.min = value
  if (value > range.max) range.max = value
}

function formatRange(range) {
  return `${range.min.toFixed(2)} .. ${range.max.toFixed(2)}`
}

/** Count how many times each value appears, e.g. players-per-frame. */
function increment(counter, key) {
  counter.set(key, (counter.get(key) ?? 0) + 1)
}

// ---------- state we fill while streaming ----------

let metadata = null
let exampleFrame = null

let frameCount = 0
let framesWithoutPlayers = 0
let frameIndexGaps = 0 // times frame[n+1] !== frame[n] + 1
let irregularTimestampSteps = 0 // times Videotimestamp step is not ~0.1 s
let previousFrame = null

const periods = new Map() // period -> { frames, firstClock, lastClock }
const playersPerFrame = new Map()

const playerX = newRange()
const playerY = newRange()
const visiblePlayerX = newRange()
const visiblePlayerY = newRange()
let samplesOutsidePitch = 0 // outside 0..105 x 0..68
let visibleSamples = 0
let hiddenSamples = 0

const ballX = newRange()
const ballY = newRange()
const ballZ = newRange()
let framesWithBall = 0

// Compare the speed we compute from positions with the provider's vx/vy (km/h).
const speedRatios = []

// ---------- stream the file ----------

const lines = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity })

for await (const line of lines) {
  if (!line.trim()) continue

  // Line 1 is metadata, everything after is a frame.
  if (metadata === null) {
    metadata = JSON.parse(line)
    continue
  }

  const frame = JSON.parse(line)
  frameCount++

  // Periods and match clock
  if (!periods.has(frame.period)) {
    periods.set(frame.period, { frames: 0, firstClock: frame.match_clock, lastClock: null })
  }
  const period = periods.get(frame.period)
  period.frames++
  period.lastClock = frame.match_clock

  // Timing between consecutive frames
  if (previousFrame) {
    if (frame.frame !== previousFrame.frame + 1) frameIndexGaps++
    const step = frame.Videotimestamp - previousFrame.Videotimestamp
    if (Math.abs(step - 0.1) > 0.005) irregularTimestampSteps++
  }

  // Players: `data` is { teamId: [ {id, vis, x, y, vx, vy, ax, ay}, ... ] }
  const teams = Object.values(frame.data ?? {})
  const players = teams.flat()
  increment(playersPerFrame, players.length)
  if (players.length === 0) framesWithoutPlayers++

  for (const p of players) {
    updateRange(playerX, p.x)
    updateRange(playerY, p.y)
    if (p.x < 0 || p.x > 105 || p.y < 0 || p.y > 68) samplesOutsidePitch++

    if (p.vis) {
      visibleSamples++
      updateRange(visiblePlayerX, p.x)
      updateRange(visiblePlayerY, p.y)
    } else {
      hiddenSamples++
    }
  }

  // Speed check: same player visible in two consecutive frames.
  if (previousFrame && frame.frame === previousFrame.frame + 1) {
    const before = new Map(
      Object.values(previousFrame.data ?? {})
        .flat()
        .map((p) => [p.id, p]),
    )
    for (const p of players) {
      const q = before.get(p.id)
      if (!p.vis || !q?.vis || p.vx === null || p.vy === null) continue
      const metres = Math.hypot(p.x - q.x, p.y - q.y)
      const computedKmh = (metres / 0.1) * 3.6 // m per 0.1 s -> km/h
      const providerKmh = Math.hypot(p.vx, p.vy)
      if (providerKmh > 10) speedRatios.push(computedKmh / providerKmh)
    }
  }

  // Ball
  if (frame.ball && frame.ball.x !== null) {
    framesWithBall++
    updateRange(ballX, frame.ball.x)
    updateRange(ballY, frame.ball.y)
    updateRange(ballZ, frame.ball.z)
  }

  // Keep the first "complete" frame as an example to print later.
  if (
    !exampleFrame &&
    players.length === 22 &&
    players.some((p) => p.vis) &&
    frame.ball?.x !== null
  ) {
    exampleFrame = frame
  }

  previousFrame = frame
}

// ---------- print the report ----------

const { match_data: match, teams_data: teams, players_data: playersData } = metadata

console.log('\n=== METADATA ===')
console.log('Top-level keys:', Object.keys(metadata).join(', '))
console.log(`Competition: ${match.season_data.name}`)
console.log(`Date:        ${match.date}`)
console.log(`Match id:    ${match.match_id}`)
console.log(
  `Result:      ${teams.home.name} ${match.result.home} - ${match.result.away} ${teams.away.name}`,
)
console.log(`FPS:         ${metadata.FPS}`)

for (const side of ['home', 'away']) {
  const team = teams[side]
  const squad = Object.entries(playersData[team.id] ?? {}).map(([id, p]) => ({
    id: Number(id),
    number: p.number,
    name: p.name,
    position: p.position,
  }))
  console.log(
    `\n${side.toUpperCase()}: ${team.name} (team id ${team.id}), ${squad.length} players in squad list`,
  )
  console.table(squad.sort((a, b) => a.number - b.number))
}

console.log('\n=== EXAMPLE FRAME (first frame with 22 players + ball) ===')
if (exampleFrame) {
  // Show only 2 players per team so the output stays readable.
  const shortData = Object.fromEntries(
    Object.entries(exampleFrame.data).map(([teamId, list]) => [
      teamId,
      [...list.slice(0, 2), `... ${list.length - 2} more`],
    ]),
  )
  console.log(JSON.stringify({ ...exampleFrame, data: shortData }, null, 2))
} else {
  console.log('No complete frame found.')
}

console.log('\n=== FRAMES & TIMING ===')
console.log(
  `Frames:                     ${frameCount} (~${(frameCount / 10 / 60).toFixed(1)} min at 10 FPS)`,
)
console.log(`Frames without players:     ${framesWithoutPlayers}`)
console.log(`Frame index gaps:           ${frameIndexGaps}`)
console.log(`Irregular timestamp steps:  ${irregularTimestampSteps} (step not ~0.1 s)`)
for (const [p, info] of periods) {
  console.log(
    `Period ${p}: ${info.frames} frames, clock ${info.firstClock.join(':')} -> ${info.lastClock.join(':')}`,
  )
}
const topCounts = [...playersPerFrame.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
console.log(
  'Players per frame (count: frames):',
  topCounts.map(([n, f]) => `${n}: ${f}`).join(', '),
)

console.log('\n=== PLAYER POSITIONS (metres) ===')
console.log(`x all samples:      ${formatRange(playerX)}`)
console.log(`y all samples:      ${formatRange(playerY)}`)
console.log(`x visible only:     ${formatRange(visiblePlayerX)}`)
console.log(`y visible only:     ${formatRange(visiblePlayerY)}`)
const totalSamples = visibleSamples + hiddenSamples
console.log(
  `Outside 0..105 x 0..68: ${samplesOutsidePitch} of ${totalSamples} samples (${((100 * samplesOutsidePitch) / totalSamples).toFixed(2)}%)`,
)
console.log(
  `vis = true:  ${visibleSamples} (${((100 * visibleSamples) / totalSamples).toFixed(1)}%)`,
)
console.log(`vis = false: ${hiddenSamples} (${((100 * hiddenSamples) / totalSamples).toFixed(1)}%)`)

console.log('\n=== BALL ===')
console.log(`Frames with ball position: ${framesWithBall} of ${frameCount}`)
console.log(`x: ${formatRange(ballX)}   y: ${formatRange(ballY)}   z: ${formatRange(ballZ)}`)

console.log('\n=== SPEED CHECK (computed from x/y vs provider vx/vy) ===')
speedRatios.sort((a, b) => a - b)
const median = speedRatios[Math.floor(speedRatios.length / 2)]
console.log(
  `Pairs compared: ${speedRatios.length}, median ratio computed/provider: ${median?.toFixed(2)}`,
)
console.log('(~1.0 means vx/vy really are km/h and frames really are 0.1 s apart)\n')
