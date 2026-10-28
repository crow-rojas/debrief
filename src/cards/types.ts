// What the generator writes. path and line are null for evidence from the prompt or messages:
// strict structured output (Codex) wants every field present.
export type Evidence = {
  source: "patch" | "prompt" | "message"
  quote: string
  path: string | null
  line: number | null
}

type Base = { question: string; explanation: string; evidence: Evidence[] }

export type CardDraft = Base &
  (
    | { kind: "defend"; keyIdeas: string[] }
    | { kind: "choice"; options: string[]; correct: number }
    | { kind: "text"; accepted: string[] }
    | { kind: "number"; value: number; tolerance: number }
  )

export type GeneratorOutput = { cards: CardDraft[] }
