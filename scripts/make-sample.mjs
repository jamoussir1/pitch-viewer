// scripts/make-sample.mjs
//
// Streams one full Driblab tracking file and writes a small sample for the app:
//   - line 1: the original metadata, plus a `sample` object saying where it came from
//   - then:   only the frames inside the chosen time window
//
// To keep the file small we keep only the fields the app uses:
//   frame, period, match_clock, ball {x, y, z}, data {teamId: [{id, vis, x, y}]}
// and drop cam, Videotimestamp, velocities and accelerations.
//
// Usage:
//   node scripts/make-sample.mjs <input.jsonl> [--start-min 42] [--minutes 4]
//
// --start-min counts from the first frame (frame / 10 / 60), not from match_clock.

import { createReadStream, createWriteStream, mkdirSync, statSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { basename } from 'node:path'
import { parseArgs } from 'node:util'

const FPS = 10

// ---------- read command-line arguments ----------

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'start-min': { type: 'string', default: '42' },
    minutes: { type: 'string', default: '4' },
  },
})

const inputPath = positionals[0]
if (!inputPath) {
  console.error('Usage: node scripts/make-sample.mjs <input.jsonl> [--start-min 42] [--minutes 4]')
  process.exit(1)
}

const startFrame = Math.round(Number(values['start-min']) * 60 * FPS)
const endFrame = startFrame + Math.round(Number(values.minutes) * 60 * FPS) // exclusive

// ---------- helpers ----------

/** Keep only what the app needs from one frame. */
function trimFrame(frame) {
  const data = {}
  for (const [teamId, players] of Object.entries(frame.data ?? {})) {
    data[teamId] = players.map((p) => ({ id: p.id, vis: p.vis, x: p.x, y: p.y }))
  }
  return {
    frame: frame.frame,
    period: frame.period,
    match_clock: frame.match_clock,
    ball: { x: frame.ball?.x ?? null, y: frame.ball?.y ?? null, z: frame.ball?.z ?? null },
    data,
  }
}

// ---------- stream input -> output ----------

mkdirSync('public/data', { recursive: true })
const matchId = basename(inputPath).split('_')[0]
const outputPath = `public/data/${matchId}_sample.jsonl`
const output = createWriteStream(outputPath)

const lines = createInterface({ input: createReadStream(inputPath), crlfDelay: Infinity })

let metadataWritten = false
let written = 0
let visibleSamples = 0
let totalSamples = 0
let framesWithBall = 0

for await (const line of lines) {
  if (!line.trim()) continue

  if (!metadataWritten) {
    const metadata = JSON.parse(line)
    metadata.sample = { source: basename(inputPath), startFrame, endFrame }
    output.write(JSON.stringify(metadata) + '\n')
    metadataWritten = true
    continue
  }

  const frame = JSON.parse(line)
  if (frame.frame < startFrame) continue
  if (frame.frame >= endFrame) break // frames are in order, so we can stop early

  const trimmed = trimFrame(frame)
  output.write(JSON.stringify(trimmed) + '\n')
  written++

  // Stats so we can judge whether this window is a good one.
  const players = Object.values(trimmed.data).flat()
  totalSamples += players.length
  visibleSamples += players.filter((p) => p.vis).length
  if (trimmed.ball.x !== null) framesWithBall++
}

// Wait until everything is flushed to disk before reading the size.
await new Promise((resolve) => output.end(resolve))

const sizeMb = statSync(outputPath).size / 1024 / 1024
console.log(`Wrote ${outputPath}`)
console.log(
  `Frames ${startFrame}..${endFrame - 1}: ${written} frames (${(written / FPS / 60).toFixed(1)} min)`,
)
console.log(`Players visible: ${((100 * visibleSamples) / totalSamples).toFixed(0)}%`)
console.log(`Frames with ball: ${((100 * framesWithBall) / written).toFixed(0)}%`)
console.log(`File size: ${sizeMb.toFixed(2)} MB`)
