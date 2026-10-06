// Small display helpers shared by several components.

/** [41, 5] -> "41:05" */
export function formatClock(clock?: [number, number]): string {
  if (!clock) return '-'
  return `${clock[0]}:${String(clock[1]).padStart(2, '0')}`
}

/** 1 -> "1st half", 2 -> "2nd half" */
export function periodLabel(period?: number): string {
  if (period === 1) return '1st half'
  if (period === 2) return '2nd half'
  return period ? `Period ${period}` : '-'
}
