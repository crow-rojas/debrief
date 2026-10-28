import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { DatabaseSync } from "node:sqlite"
import { normalize } from "../cards/grade.ts"
import type { CardDraft } from "../cards/types.ts"
import { homePath } from "../paths.ts"

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

const slugify = (text: string) =>
  normalize(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
    .replace(/-$/, "")

export function writeNote(slug: string, card: CardDraft, note: string, now: Date): string {
  const dir = homePath("knowledge", slug)
  mkdirSync(dir, { recursive: true })
  const stem = `${localDate(now)}-${slugify(card.question) || "note"}`
  let file = join(dir, `${stem}.md`)
  for (let n = 2; existsSync(file); n++) file = join(dir, `${stem}-${n}.md`)
  const evidence = card.evidence.map(
    (e) => `> ${e.quote.replace(/\n/g, "\n> ")}${e.path ? ` (${e.path})` : ""}`,
  )
  writeFileSync(
    file,
    [`# ${card.question}`, "", note.trim(), "", "## Evidence", "", ...evidence, ""].join("\n"),
  )
  return file
}

// Every note of the repo, newest first.
export function readNotes(slug: string): string[] {
  const dir = homePath("knowledge", slug)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(dir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs || b.localeCompare(a))
    .map((file) => readFileSync(file, "utf8"))
}

export function flagCard(
  db: DatabaseSync,
  cardId: number,
  input: { note?: string; action: "discard" | "regenerate" },
  now: Date,
): void {
  const row = db
    .prepare(
      "SELECT c.payload_json, c.turn_id, t.slug FROM cards c JOIN turns t ON t.id = c.turn_id WHERE c.id = ?",
    )
    .get(cardId) as { payload_json: string; turn_id: number; slug: string } | undefined
  if (!row) throw new Error(`no card ${cardId}`)
  const note = input.note?.trim()
  db.prepare("INSERT INTO flags (card_id, note, action, created_at) VALUES (?, ?, ?, ?)").run(
    cardId,
    note ?? null,
    input.action,
    now.toISOString(),
  )
  db.prepare("UPDATE cards SET state = 'discarded' WHERE id = ?").run(cardId)
  if (note) writeNote(row.slug, JSON.parse(row.payload_json) as CardDraft, note, now)
  if (input.action === "regenerate") {
    db.prepare(
      "UPDATE turns SET state = 'queued', attempts = 0, last_error = NULL WHERE id = ?",
    ).run(row.turn_id)
  }
}

// Share of all cards ever stored that someone flagged as wrong (target under 10%).
export function flaggedShare(db: DatabaseSync): number {
  const { total } = db.prepare("SELECT count(*) AS total FROM cards").get() as { total: number }
  const { flagged } = db.prepare("SELECT count(DISTINCT card_id) AS flagged FROM flags").get() as {
    flagged: number
  }
  return total ? flagged / total : 0
}
