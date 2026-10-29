import { appendFileSync, chmodSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { catchUp, getTurn, processFile, watch } from "../../src/capture/capture.ts"
import type { RawTurn } from "../../src/capture/event.ts"
import { readLines, type Reader } from "../../src/capture/readers/types.ts"
import { saveConfig, loadConfig } from "../../src/config.ts"
import { openDb } from "../../src/db.ts"
import { makeRepo, tempHome, writeFiles } from "../helpers.ts"

const NOW = new Date("2026-10-28T12:00:00.000Z")
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString()

// A reader over files holding one RawTurn JSON per line.
function fakeReader(root = "/nowhere"): Reader {
  return {
    id: "codex",
    version: 1,
    root: () => root,
    files: async () => [],
    read: async (file, offset) => {
      const lines = await readLines(file, offset)
      return {
        turns: lines.map((l) => JSON.parse(l.text) as RawTurn),
        offset: lines.at(-1)?.end ?? offset,
        skipped: [],
      }
    },
  }
}

function turn(
  cwd: string,
  turnId: string,
  endedSecondsAgo: number,
  extra: Partial<RawTurn> = {},
): RawTurn {
  return {
    agent: { name: "codex", version: "0.156.1" },
    reader: { id: "codex", version: 1, source: "x", offset: 0 },
    sessionId: "s1",
    turnId,
    origin: "interactive",
    cwd,
    ts: { start: ago(endedSecondsAgo + 5), end: ago(endedSecondsAgo) },
    status: "completed",
    prompt: `prompt ${turnId}`,
    messages: [`message ${turnId}`],
    ...extra,
  }
}

const logFile = () => join(mkdtempSync(join(tmpdir(), "log-")), "session.jsonl")
const append = (file: string, t: RawTurn) => appendFileSync(file, `${JSON.stringify(t)}\n`)
const count = (db: ReturnType<typeof openDb>) =>
  (db.prepare("SELECT count(*) AS n FROM turns WHERE state = 'queued'").get() as { n: number }).n

describe("capture", () => {
  beforeEach(() => {
    tempHome()
  })

  it("a live turn gets its own diff", async () => {
    const db = openDb()
    const repo = makeRepo({ "a.py": "1\n", "b.py": "1\n" })
    const file = logFile()
    const reader = fakeReader()
    writeFiles(repo, { "a.py": "2\n" })
    append(file, turn(repo, "t1", 10))
    expect(await processFile(db, reader, file, NOW)).toBe(1)
    writeFiles(repo, { "b.py": "2\n" })
    append(file, turn(repo, "t2", 5))
    expect(await processFile(db, reader, file, NOW)).toBe(1)
    const [first, second] = [getTurn(db, 1), getTurn(db, 2)]
    expect(first?.event.changes.map((c) => c.path)).toEqual(["a.py"])
    expect(second?.event.changes.map((c) => c.path)).toEqual(["b.py"])
    expect(second?.event.schema).toBe("ownship.turn/1")
    expect(second?.slug).toMatch(/-[0-9a-f]{8}$/)
  })

  it("concurrent reads of one worktree never count the same change twice", async () => {
    const db = openDb()
    const repo = makeRepo({ "a.py": "1\n" })
    writeFiles(repo, { "a.py": "2\n" })
    const [one, two] = [logFile(), logFile()]
    append(one, turn(repo, "s1-t1", 5, { sessionId: "s1" }))
    append(two, turn(repo, "s2-t1", 4, { sessionId: "s2" }))
    await Promise.all([
      processFile(db, fakeReader(), one, NOW),
      processFile(db, fakeReader(), two, NOW),
      processFile(db, fakeReader(), one, NOW),
    ])
    const rows = db.prepare("SELECT event_json FROM turns WHERE state = 'queued'").all() as {
      event_json: string
    }[]
    expect(rows).toHaveLength(2)
    const changed = rows.flatMap(
      (r) => (JSON.parse(r.event_json) as { changes: unknown[] }).changes,
    )
    expect(changed).toHaveLength(1)
  })

  it("a turn whose snapshot fails is stored as failed and capture goes on", async () => {
    const db = openDb()
    const repo = makeRepo({ "a.py": "1\n" })
    writeFiles(repo, { "secret.pem": "x\n" })
    chmodSync(join(repo, "secret.pem"), 0o000)
    const file = logFile()
    append(file, turn(repo, "t1", 10))
    try {
      expect(await processFile(db, fakeReader(), file, NOW)).toBe(0)
    } finally {
      chmodSync(join(repo, "secret.pem"), 0o644)
    }
    expect(
      db
        .prepare("SELECT state, last_error IS NOT NULL AS err FROM turns WHERE turn_id = 't1'")
        .get(),
    ).toEqual({
      state: "failed",
      err: 1,
    })
    append(file, turn(repo, "t2", 5))
    expect(await processFile(db, fakeReader(), file, NOW)).toBe(1)
  })

  it("missed turns of one worktree merge into one event", async () => {
    const db = openDb()
    const repo = makeRepo({ "a.py": "1\n" })
    const file = logFile()
    writeFiles(repo, { "a.py": "2\n" })
    append(file, turn(repo, "t1", 3600))
    append(file, turn(repo, "t2", 3500))
    expect(await processFile(db, fakeReader(), file, NOW)).toBe(1)
    const stored = getTurn(db, 2) ?? getTurn(db, 1)
    const queued = db.prepare("SELECT id FROM turns WHERE state = 'queued'").all() as {
      id: number
    }[]
    const merged = getTurn(db, queued[0]!.id)
    expect(merged?.event.merged).toBe(true)
    expect(merged?.turnId).toBe("t2")
    expect(merged?.event.prompt).toContain("prompt t1")
    expect(merged?.event.prompt).toContain("prompt t2")
    expect(merged?.event.changes.map((c) => c.path)).toEqual(["a.py"])
    expect(stored).toBeTruthy()
  })

  it("the same turn reported twice is stored once", async () => {
    const db = openDb()
    const repo = makeRepo({ "a.py": "1\n" })
    const file = logFile()
    append(file, turn(repo, "t1", 3600))
    append(file, turn(repo, "t2", 3500))
    await processFile(db, fakeReader(), file, NOW)
    await processFile(db, fakeReader(), file, NOW)
    db.prepare("UPDATE reader_offsets SET offset = 0").run()
    expect(await processFile(db, fakeReader(), file, NOW)).toBe(0)
    expect(count(db)).toBe(1)
  })

  it("a file shorter than its saved offset is reread from the start", async () => {
    const db = openDb()
    const repo = makeRepo({ "a.py": "1\n" })
    const file = logFile()
    append(file, turn(repo, "t1", 10))
    await processFile(db, fakeReader(), file, NOW)
    writeFileSync(file, `${JSON.stringify(turn(repo, "t9", 5))}\n`)
    db.prepare("UPDATE reader_offsets SET offset = ?").run(statSync(file).size + 100)
    expect(await processFile(db, fakeReader(), file, NOW)).toBe(1)
  })

  it("headless, interrupted, excluded and non-git turns are not stored", async () => {
    const db = openDb()
    const repo = makeRepo({ "a.py": "1\n" })
    const excluded = makeRepo({ "a.py": "1\n" })
    saveConfig({ ...loadConfig(), exclude: [excluded] })
    const file = logFile()
    append(file, turn(repo, "h", 10, { origin: "headless" }))
    append(file, turn(repo, "i", 10, { status: "interrupted" }))
    append(file, turn(excluded, "x", 10))
    append(file, turn(mkdtempSync(join(tmpdir(), "plain-")), "n", 10))
    expect(await processFile(db, fakeReader(), file, NOW)).toBe(0)
  })

  it("on the first run, catchUp starts from the end of existing logs", async () => {
    const db = openDb()
    const repo = makeRepo({ "a.py": "1\n" })
    const file = logFile()
    append(file, turn(repo, "old", 3600))
    const reader = { ...fakeReader(), files: async () => [file] }
    await catchUp(db, [reader], NOW)
    expect(count(db)).toBe(0)
    const later = new Date(NOW.getTime() + 60_000)
    append(file, turn(repo, "new", -30))
    await catchUp(db, [reader], later)
    expect(count(db)).toBe(1)
  })

  it("turns that ended before install are never captured, even from a file first seen later", async () => {
    const db = openDb()
    const repo = makeRepo({ "a.py": "1\n" })
    const file = logFile()
    const reader = { ...fakeReader(), files: async () => [] as string[] }
    await catchUp(db, [reader], NOW)
    append(file, turn(repo, "compressed-history", 3600))
    append(
      file,
      turn(repo, "after-install", 0, {
        ts: { start: NOW.toISOString(), end: new Date(NOW.getTime() + 1000).toISOString() },
      }),
    )
    expect(await processFile(db, reader, file, new Date(NOW.getTime() + 2000))).toBe(1)
    expect(db.prepare("SELECT turn_id FROM turns").all()).toEqual([{ turn_id: "after-install" }])
  })

  it("watch ignores files the reader does not own", async () => {
    const db = openDb()
    const repo = makeRepo({ "a.py": "1\n" })
    const root = mkdtempSync(join(tmpdir(), "root-"))
    const reader = { ...fakeReader(root), owns: (file: string) => !file.includes("/subagents/") }
    const stop = watch(db, [reader], { debounceMs: 50 })
    try {
      const now = new Date().toISOString()
      mkdirSync(join(root, "s", "subagents"), { recursive: true })
      append(
        join(root, "s", "subagents", "a.jsonl"),
        turn(repo, "sub", 0, { ts: { start: now, end: now } }),
      )
      await new Promise((r) => setTimeout(r, 400))
      expect(count(db)).toBe(0)
    } finally {
      stop()
    }
  })

  it("watch stores a turn written to a log under the reader's root", async () => {
    const db = openDb()
    const repo = makeRepo({ "a.py": "1\n" })
    const root = mkdtempSync(join(tmpdir(), "root-"))
    const stop = watch(db, [fakeReader(root)], { debounceMs: 50 })
    try {
      append(
        join(root, "s.jsonl"),
        turn(repo, "w1", 0, {
          ts: { start: new Date().toISOString(), end: new Date().toISOString() },
        }),
      )
      await expect.poll(() => count(db), { timeout: 5000 }).toBe(1)
    } finally {
      stop()
    }
  })
})
