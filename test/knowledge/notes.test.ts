import { readFileSync, readdirSync, utimesSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import type { CardDraft } from "../../src/cards/types.ts"
import { loadConfig } from "../../src/config.ts"
import { openDb } from "../../src/db.ts"
import { runPipelineOnce } from "../../src/generate/pipeline.ts"
import {
  flagCard,
  flaggedShare,
  listNotes,
  readNotes,
  writeNote,
} from "../../src/knowledge/notes.ts"
import { homePath } from "../../src/paths.ts"
import { insertTurn, makeRepo, tempHome } from "../helpers.ts"

const NOW = new Date(2026, 9, 28, 15, 0, 0)
const card: CardDraft = {
  kind: "text",
  question: "Which method validates the RUT?",
  explanation: "clean()",
  evidence: [{ source: "message", quote: "inside one transaction", path: null, line: null }],
  accepted: ["clean"],
}

let seeded = 0
function seed(db: ReturnType<typeof openDb>, worktree = "/w") {
  const turnId = insertTurn(
    db,
    new Date(NOW.getTime() - 60_000).toISOString(),
    worktree,
    `seed-${++seeded}`,
  )
  db.prepare("UPDATE turns SET state = 'generated' WHERE id = ?").run(turnId)
  const result = db
    .prepare(
      "INSERT INTO cards (turn_id, kind, payload_json, created_at, state, due) VALUES (?, 'text', ?, ?, 'active', ?)",
    )
    .run(turnId, JSON.stringify(card), NOW.toISOString(), NOW.toISOString())
  return { turnId, cardId: Number(result.lastInsertRowid) }
}

describe("knowledge notes", () => {
  beforeEach(() => {
    tempHome()
  })

  it("a flag with a note writes a markdown file that readNotes returns", () => {
    const db = openDb()
    const { cardId } = seed(db)
    flagCard(
      db,
      cardId,
      { note: "Suppliers from the SII import skip this check.", action: "discard" },
      NOW,
    )
    const notes = readNotes("w-00000000")
    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain("Suppliers from the SII import skip this check.")
    expect(notes[0]).toContain("Which method validates the RUT?")
    expect(notes[0]).toContain("inside one transaction")
    expect(readdirSync(homePath("knowledge", "w-00000000"))[0]).toMatch(
      /^2026-10-28-which-method-validates-the-rut\.md$/,
    )
  })

  it("discard without a note writes nothing and hides the card", () => {
    const db = openDb()
    const { cardId } = seed(db)
    flagCard(db, cardId, { action: "discard" }, NOW)
    expect(readNotes("w-00000000")).toEqual([])
    expect(db.prepare("SELECT state FROM cards WHERE id = ?").get(cardId)).toEqual({
      state: "discarded",
    })
  })

  it("regenerate requeues the turn", () => {
    const db = openDb()
    const { cardId, turnId } = seed(db)
    flagCard(db, cardId, { note: "wrong", action: "regenerate" }, NOW)
    expect(db.prepare("SELECT state, attempts FROM turns WHERE id = ?").get(turnId)).toEqual({
      state: "queued",
      attempts: 0,
    })
  })

  it("the share of flagged cards is computable from the flags table", () => {
    const db = openDb()
    expect(flaggedShare(db)).toBe(0)
    const { cardId } = seed(db)
    seed(db)
    flagCard(db, cardId, { action: "discard" }, NOW)
    expect(flaggedShare(db)).toBe(0.5)
  })

  it("the pipeline puts the repo's notes into the generator prompt", async () => {
    const db = openDb()
    const repo = makeRepo()
    insertTurn(db, new Date(NOW.getTime() - 60_000).toISOString(), repo)
    writeNote("w-00000000", card, "Imports never call the serializer.", NOW)
    const out = join(homePath(), "env.json")
    process.env.FAKE_ENV_OUT = out
    try {
      const fake = ["node", resolve("test/fixtures/fake-generator.mjs")]
      const generator = {
        command: fake,
        schema: "validate",
        timeoutMs: 5000,
        research: { command: fake },
      }
      await runPipelineOnce(db, { ...loadConfig(), generator }, NOW)
    } finally {
      delete process.env.FAKE_ENV_OUT
    }
    expect(JSON.parse(readFileSync(out, "utf8")).input).toContain(
      "Imports never call the serializer.",
    )
  })

  it("listNotes returns every repo's notes newest first, file names only", () => {
    const older = writeNote("a-00000000", card, "Older note.", NOW)
    const newer = writeNote("b-00000000", card, "Newer note.", NOW)
    utimesSync(older, new Date(2026, 9, 27), new Date(2026, 9, 27))
    utimesSync(newer, NOW, NOW)
    writeFileSync(homePath("knowledge", "a-00000000", "README.txt"), "not a note")
    const notes = listNotes()
    expect(notes.map((n) => n.slug)).toEqual(["b-00000000", "a-00000000"])
    expect(notes[0]?.text).toContain("Newer note.")
    for (const n of notes) {
      expect(n.file).toMatch(/\.md$/)
      expect(n.file).not.toContain("/")
    }
  })

  it("listNotes is empty when the knowledge folder is missing", () => {
    expect(listNotes()).toEqual([])
  })
})
