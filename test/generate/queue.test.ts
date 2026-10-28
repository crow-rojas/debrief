import { beforeEach, describe, expect, it } from "vitest"
import { openDb } from "../../src/db.ts"
import { newCardsToday, nextTurn } from "../../src/generate/queue.ts"
import { insertTurn, tempHome } from "../helpers.ts"

const NOW = new Date(2026, 9, 28, 15, 0, 0)
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()

function addCards(db: ReturnType<typeof openDb>, turnId: number, n: number, at: Date) {
  for (let i = 0; i < n; i++) {
    db.prepare(
      "INSERT INTO cards (turn_id, kind, payload_json, created_at, state, due) VALUES (?, 'text', '{}', ?, 'active', ?)",
    ).run(turnId, at.toISOString(), at.toISOString())
  }
}

describe("queue", () => {
  beforeEach(() => {
    tempHome()
  })

  it("nextTurn returns the newest queued turn first", () => {
    const db = openDb()
    insertTurn(db, hoursAgo(5))
    const newest = insertTurn(db, hoursAgo(1))
    insertTurn(db, hoursAgo(3))
    expect(nextTurn(db, NOW, 10)?.id).toBe(newest)
  })

  it("turns older than 7 days expire", () => {
    const db = openDb()
    const old = insertTurn(db, hoursAgo(24 * 7 + 1))
    expect(nextTurn(db, NOW, 10)).toBeNull()
    expect(db.prepare("SELECT state FROM turns WHERE id = ?").get(old)).toEqual({
      state: "expired",
    })
  })

  it("stops when 10 cards were created today and resumes after local midnight", () => {
    const db = openDb()
    const t = insertTurn(db, hoursAgo(1))
    addCards(db, t, 10, new Date(2026, 9, 28, 9, 0, 0))
    addCards(db, t, 5, new Date(2026, 9, 27, 23, 0, 0))
    expect(newCardsToday(db, NOW)).toBe(10)
    expect(nextTurn(db, NOW, 10)).toBeNull()
    expect(nextTurn(db, new Date(2026, 9, 29, 0, 5, 0), 10)?.id).toBe(t)
  })

  it("reviews are not counted against the cap", () => {
    const db = openDb()
    const t = insertTurn(db, hoursAgo(1))
    addCards(db, t, 2, new Date(2026, 9, 20, 9, 0, 0))
    db.prepare(
      "INSERT INTO reviews (review_id, card_id, rating, answered_at) VALUES ('r1', 1, 'good', ?)",
    ).run(NOW.toISOString())
    db.prepare(
      "INSERT INTO reviews (review_id, card_id, rating, answered_at) VALUES ('r2', 2, 'again', ?)",
    ).run(NOW.toISOString())
    expect(newCardsToday(db, NOW)).toBe(0)
  })
})
