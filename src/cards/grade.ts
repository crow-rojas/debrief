import type { CardDraft } from "./types.ts"

export type Answer =
  | { kind: "defend"; text: string; ticked: number[] }
  | { kind: "choice"; picked: number }
  | { kind: "text"; text: string }
  | { kind: "number"; value: number }
  | { kind: "dontKnow" }

export function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim()
}

export function grade(card: CardDraft, answer: Answer): "again" | "good" {
  if (card.kind === "defend" && answer.kind === "defend") {
    const ticked = new Set(answer.ticked)
    return card.keyIdeas.every((_, i) => ticked.has(i)) ? "good" : "again"
  }
  if (card.kind === "choice" && answer.kind === "choice")
    return answer.picked === card.correct ? "good" : "again"
  if (card.kind === "text" && answer.kind === "text") {
    return card.accepted.some((a) => normalize(a) === normalize(answer.text)) ? "good" : "again"
  }
  if (card.kind === "number" && answer.kind === "number") {
    return Math.abs(answer.value - card.value) <= card.tolerance ? "good" : "again"
  }
  return "again"
}
