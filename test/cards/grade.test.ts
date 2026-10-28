import { describe, expect, it } from "vitest"
import { grade, normalize } from "../../src/cards/grade.ts"
import type { CardDraft } from "../../src/cards/types.ts"

const base = { question: "q", explanation: "e", evidence: [] }
const defend: CardDraft = {
  ...base,
  kind: "defend",
  keyIdeas: ["import skips serializer", "clean runs everywhere"],
}
const text: CardDraft = { ...base, kind: "text", accepted: ["Validación RUT"] }
const number: CardDraft = { ...base, kind: "number", value: 3, tolerance: 0.5 }
const choice: CardDraft = { ...base, kind: "choice", options: ["a", "b", "c"], correct: 2 }

describe("grade", () => {
  it("defend is good only when every key idea is ticked", () => {
    expect(grade(defend, { kind: "defend", text: "x", ticked: [0, 1] })).toBe("good")
    expect(grade(defend, { kind: "defend", text: "x", ticked: [1] })).toBe("again")
    expect(grade(defend, { kind: "defend", text: "x", ticked: [0, 0] })).toBe("again")
  })

  it("dontKnow is again for every kind", () => {
    for (const card of [defend, text, number, choice])
      expect(grade(card, { kind: "dontKnow" })).toBe("again")
  })

  it("text matches ignoring case, accents and spacing", () => {
    expect(normalize("  Validación   RUT ")).toBe("validacion rut")
    expect(grade(text, { kind: "text", text: "validacion  rut" })).toBe("good")
    expect(grade(text, { kind: "text", text: "rut" })).toBe("again")
  })

  it("number honors the tolerance", () => {
    expect(grade(number, { kind: "number", value: 3.5 })).toBe("good")
    expect(grade(number, { kind: "number", value: 3.6 })).toBe("again")
  })

  it("choice is good only for the correct option", () => {
    expect(grade(choice, { kind: "choice", picked: 2 })).toBe("good")
    expect(grade(choice, { kind: "choice", picked: 0 })).toBe("again")
  })

  it("an answer of another kind is again", () => {
    expect(grade(choice, { kind: "text", text: "c" })).toBe("again")
  })
})
