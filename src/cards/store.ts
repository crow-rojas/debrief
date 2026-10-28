import type { DatabaseSync } from "node:sqlite"
import type { FilteredTurn } from "../generate/filter.ts"
import { checkCard } from "./evidence.ts"
import type { CardDraft } from "./types.ts"

// Stores the cards whose evidence holds as new, due now; returns how many were kept.
export function storeCards(
  db: DatabaseSync,
  turnRowId: number,
  cards: CardDraft[],
  turn: FilteredTurn,
  now: Date,
): number {
  const insert = db.prepare(
    "INSERT INTO cards (turn_id, kind, payload_json, created_at, state, fsrs_json, due) VALUES (?, ?, ?, ?, 'active', NULL, ?)",
  )
  let kept = 0
  for (const card of cards) {
    if (!checkCard(card, turn).ok) continue
    insert.run(turnRowId, card.kind, JSON.stringify(card), now.toISOString(), now.toISOString())
    kept++
  }
  return kept
}
