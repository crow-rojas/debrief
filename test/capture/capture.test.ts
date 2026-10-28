import { appendFileSync, mkdtempSync, statSync, writeFileSync } from "node:fs"
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
    append(file, turn(repo, "new", 10))
    await catchUp(db, [reader], NOW)
    expect(count(db)).toBe(1)
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
