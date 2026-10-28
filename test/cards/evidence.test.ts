import { beforeEach, describe, expect, it } from "vitest"
import { checkCard } from "../../src/cards/evidence.ts"
import { storeCards } from "../../src/cards/store.ts"
import type { CardDraft } from "../../src/cards/types.ts"
import { openDb } from "../../src/db.ts"
import type { FilteredTurn } from "../../src/generate/filter.ts"
import { tempHome } from "../helpers.ts"

const turn: FilteredTurn = {
  prompt: "Move the RUT validation into Supplier.clean()",
  messages: ["The import calls full_clean() on each row\ninside one transaction."],
  changes: [
    {
      path: "app/models.py",
      op: "modify",
      patch: [
        "diff --git a/app/models.py b/app/models.py",
        "@@ -1,2 +1,4 @@",
        " class Supplier(models.Model):",
        "+    def clean(self):",
        "+        if not rut_is_valid(self.tax_id):",
        "-    pass",
      ].join("\n"),
    },
    { path: "app/other.py", op: "add", patch: "@@ -0,0 +1 @@\n+OTHER = 1" },
  ],
  dropped: [],
  truncated: false,
}

const choice = (over: Partial<Extract<CardDraft, { kind: "choice" }>> = {}): CardDraft => ({
  kind: "choice",
  question: "Where does the RUT check run?",
  explanation: "In clean().",
  evidence: [
    {
      source: "patch",
      quote: "def clean(self):\n  if not rut_is_valid(self.tax_id):",
      path: "app/models.py",
      line: 2,
    },
  ],
  options: ["serializer", "clean()", "view"],
  correct: 1,
  ...over,
})

describe("evidence", () => {
  beforeEach(() => {
    tempHome()
  })

  it("accepts a quote that differs only in whitespace", () => {
    expect(checkCard(choice(), turn)).toEqual({ ok: true })
    const spread = choice({
      evidence: [
        {
          source: "message",
          quote: "full_clean()   on each row inside one transaction",
          path: null,
          line: null,
        },
      ],
    })
    expect(checkCard(spread, turn)).toEqual({ ok: true })
  })

  it("rejects a quote that is not in the turn", () => {
    const made = choice({
      evidence: [{ source: "prompt", quote: "Move the CUIT validation", path: null, line: null }],
    })
    expect(checkCard(made, turn).ok).toBe(false)
  })

  it("rejects a patch quote attributed to another file, and a removed line", () => {
    const wrongFile = choice({
      evidence: [{ source: "patch", quote: "def clean(self):", path: "app/other.py", line: null }],
    })
    expect(checkCard(wrongFile, turn).ok).toBe(false)
    const removed = choice({
      evidence: [{ source: "patch", quote: "pass", path: "app/models.py", line: null }],
    })
    expect(checkCard(removed, turn).ok).toBe(false)
  })

  it("rejects a choice card with a repeated option or an out-of-range answer", () => {
    expect(checkCard(choice({ options: ["clean()", "view", "Clean()"] }), turn).ok).toBe(false)
    expect(checkCard(choice({ correct: 3 }), turn).ok).toBe(false)
  })

  it("storeCards keeps the valid cards of a mixed batch", () => {
    const db = openDb()
    db.exec(`INSERT INTO turns (id, agent, session_id, turn_id, worktree, common_dir, slug, ended_at, status, state, event_json)
      VALUES (1, 'codex', 's', 't', '/w', '/w/.git', 'w-00000000', '2026-10-28T00:00:00Z', 'completed', 'queued', '{}')`)
    const bad = choice({
      evidence: [{ source: "prompt", quote: "never said", path: null, line: null }],
    })
    expect(storeCards(db, 1, [choice(), bad], turn, new Date("2026-10-28T12:00:00Z"))).toBe(1)
    const rows = db.prepare("SELECT kind, state, due FROM cards").all()
    expect(rows).toEqual([{ kind: "choice", state: "active", due: "2026-10-28T12:00:00.000Z" }])
  })
})
