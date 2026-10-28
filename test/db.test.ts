import { beforeEach, describe, expect, it } from "vitest"
import { openDb } from "../src/db.ts"
import { tempHome } from "./helpers.ts"

const insertTurn = `INSERT INTO turns (agent, session_id, turn_id, worktree, common_dir, slug, ended_at, status, state, attempts, event_json)
  VALUES ('codex', 's1', 't1', '/w', '/w/.git', 'w-12345678', '2026-10-28T00:00:00Z', 'completed', 'queued', 0, '{}')`

describe("database", () => {
  beforeEach(() => {
    tempHome()
  })

  it("openDb is idempotent", () => {
    const first = openDb()
    const version = first.prepare("PRAGMA user_version").get()
    first.close()
    const second = openDb()
    expect(second.prepare("PRAGMA user_version").get()).toEqual(version)
    const tables = second
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row.name)
    expect(tables).toEqual(["cards", "flags", "reader_offsets", "reviews", "snapshots", "turns"])
  })

  it("turns are unique per agent, session and turn", () => {
    const db = openDb()
    db.exec(insertTurn)
    expect(() => db.exec(insertTurn)).toThrow()
  })
})
