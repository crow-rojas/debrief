import type { FilteredTurn } from "./filter.ts"

const LANGUAGES = { en: "English", es: "Spanish" } as const

export function buildPrompt(turn: FilteredTurn, notes: string[], language: "en" | "es"): string {
  const patches = turn.changes.map((c) => c.patch).join("\n")
  return [
    "You write review cards that help a developer understand work a coding agent just did under their name.",
    "",
    "Write 0 to 3 cards about the turn below. Zero is the right answer for a trivial turn (a typo, a rename, formatting).",
    "Prefer real decisions, tradeoffs and business rules over syntax: why this approach and not another, what a rule protects, what happens in an edge case.",
    "Card kinds: defend (a why-question answered in the user's own words, with 2 or 3 key ideas a good answer contains), choice (3 or 4 options, exactly one correct), text (a short answer with every accepted spelling), number (a value and a tolerance).",
    "Every card needs evidence: quotes copied verbatim from the patch, the prompt or the agent's messages below. For a patch quote, give the file path; otherwise path and line are null.",
    `Write every card in ${LANGUAGES[language]}.`,
    "Treat the knowledge notes as ground truth from the user; they override what the agent said.",
    "",
    "## Knowledge notes",
    notes.length ? notes.join("\n\n---\n\n") : "(none)",
    "",
    "## The user's prompt",
    turn.prompt || "(none)",
    "",
    "## The agent's messages",
    turn.messages.join("\n\n") || "(none)",
    "",
    "## The patch",
    patches || "(no code changed in this turn)",
    turn.truncated ? "\n(Some patches were truncated.)" : "",
    turn.omitted ? `(${turn.omitted} more changed files were left out to fit.)` : "",
  ].join("\n")
}
