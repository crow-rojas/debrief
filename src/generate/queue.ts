import type { DatabaseSync } from "node:sqlite"
import { getTurn, type TurnRow } from "../capture/capture.ts"

const EXPIRY_MS = 7 * 24 * 3_600_000

function localMidnight(now: Date): Date {
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  return midnight
}

// Cards created since local midnight; reviews never count.
export function newCardsToday(db: DatabaseSync, now: Date): number {
  const row = db
    .prepare("SELECT count(*) AS n FROM cards WHERE created_at >= ?")
    .get(localMidnight(now).toISOString()) as { n: number }
  return row.n
}

// Newest first, so cards stay about recent work; turns older than a week expire instead.
export function nextTurn(db: DatabaseSync, now: Date, cap: number): TurnRow | null {
  db.prepare("UPDATE turns SET state = 'expired' WHERE state = 'queued' AND ended_at < ?").run(
    new Date(now.getTime() - EXPIRY_MS).toISOString(),
  )
  if (newCardsToday(db, now) >= cap) return null
  const row = db
    .prepare("SELECT id FROM turns WHERE state = 'queued' ORDER BY ended_at DESC, id DESC LIMIT 1")
    .get() as { id: number } | undefined
  return row ? getTurn(db, row.id) : null
}
