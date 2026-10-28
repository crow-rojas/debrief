import type { GeneratorOutput } from "../cards/types.ts"

const str = { type: "string" }
const strings = (minItems: number, maxItems: number) => ({
  type: "array",
  items: str,
  minItems,
  maxItems,
})
const evidence = {
  type: "array",
  minItems: 1,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["source", "quote", "path", "line"],
    properties: {
      source: { type: "string", enum: ["patch", "prompt", "message"] },
      quote: str,
      path: { type: ["string", "null"] },
      line: { type: ["integer", "null"] },
    },
  },
}
const card = (kind: string, extra: Record<string, object>) => ({
  type: "object",
  additionalProperties: false,
  required: ["kind", "question", "explanation", "evidence", ...Object.keys(extra)],
  properties: {
    kind: { type: "string", enum: [kind] },
    question: str,
    explanation: str,
    evidence,
    ...extra,
  },
})

// Written for strict structured output: every property required, no oneOf.
export const cardSchema = {
  type: "object",
  additionalProperties: false,
  required: ["cards"],
  properties: {
    cards: {
      type: "array",
      maxItems: 3,
      items: {
        anyOf: [
          card("defend", { keyIdeas: strings(2, 3) }),
          card("choice", { options: strings(3, 4), correct: { type: "integer" } }),
          card("text", { accepted: strings(1, 10) }),
          card("number", { value: { type: "number" }, tolerance: { type: "number" } }),
        ],
      },
    },
  },
}

// ponytail: a hand check of the one schema above, so no validator dependency; swap for ajv if the
// schema grows.
export function validateOutput(value: unknown): string | null {
  const isStrings = (v: unknown, min: number, max: number) =>
    Array.isArray(v) &&
    v.length >= min &&
    v.length <= max &&
    v.every((s) => typeof s === "string" && s.trim())
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray((value as GeneratorOutput).cards)
  ) {
    return "expected an object with a cards array"
  }
  const { cards } = value as GeneratorOutput
  if (cards.length > 3) return "at most 3 cards"
  for (const [i, c] of cards.entries()) {
    const at = `cards[${i}]`
    if (typeof c.question !== "string" || !c.question.trim()) return `${at}.question is missing`
    if (typeof c.explanation !== "string") return `${at}.explanation is missing`
    if (!Array.isArray(c.evidence) || c.evidence.length === 0)
      return `${at}.evidence needs at least one quote`
    for (const e of c.evidence) {
      if (
        !["patch", "prompt", "message"].includes(e.source) ||
        typeof e.quote !== "string" ||
        !e.quote.trim()
      ) {
        return `${at}.evidence has an invalid entry`
      }
    }
    if (c.kind === "defend" && !isStrings(c.keyIdeas, 2, 3))
      return `${at}.keyIdeas needs 2 or 3 ideas`
    else if (c.kind === "choice" && (!isStrings(c.options, 3, 4) || !Number.isInteger(c.correct))) {
      return `${at} needs 3 or 4 options and an integer correct`
    } else if (c.kind === "text" && !isStrings(c.accepted, 1, 10))
      return `${at}.accepted needs answers`
    else if (
      c.kind === "number" &&
      (typeof c.value !== "number" || typeof c.tolerance !== "number")
    ) {
      return `${at} needs a numeric value and tolerance`
    } else if (!["defend", "choice", "text", "number"].includes(c.kind))
      return `${at}.kind is unknown`
  }
  return null
}
