import type { FilteredTurn } from "../generate/filter.ts"
import type { CardDraft } from "./types.ts"

const squash = (text: string) => text.replace(/\s+/g, " ").trim()
const fold = (text: string) => squash(text).toLowerCase()

// The text a patch quote may come from: added and context lines, without their diff marker.
function patchText(patch: string): string {
  return patch
    .split("\n")
    .filter((line) => (line.startsWith("+") && !line.startsWith("+++")) || line.startsWith(" "))
    .map((line) => line.slice(1))
    .join("\n")
}

function sources(turn: FilteredTurn, source: string, path: string | null): string[] {
  if (source === "prompt") return [turn.prompt]
  if (source === "message") return turn.messages
  return turn.changes.filter((c) => path === null || c.path === path).map((c) => patchText(c.patch))
}

export function checkCard(
  card: CardDraft,
  turn: FilteredTurn,
): { ok: true } | { ok: false; reason: string } {
  for (const e of card.evidence) {
    const quote = squash(e.quote)
    if (!quote || !sources(turn, e.source, e.path).some((text) => squash(text).includes(quote))) {
      return { ok: false, reason: `quote not found in the ${e.source}: ${e.quote.slice(0, 80)}` }
    }
  }
  if (card.kind === "choice") {
    if (
      !Number.isInteger(card.correct) ||
      card.correct < 0 ||
      card.correct >= card.options.length
    ) {
      return { ok: false, reason: "the correct option is out of range" }
    }
    if (new Set(card.options.map(fold)).size !== card.options.length) {
      return { ok: false, reason: "options repeat" }
    }
  }
  if (card.kind === "defend" && (card.keyIdeas.length < 2 || card.keyIdeas.length > 3)) {
    return { ok: false, reason: "a defend card needs 2 or 3 key ideas" }
  }
  if (card.kind === "text" && !card.accepted.some((a) => a.trim())) {
    return { ok: false, reason: "a text card needs an accepted answer" }
  }
  return { ok: true }
}
