import { describe, expect, it } from "vitest"
import type { FilteredTurn } from "../../src/generate/filter.ts"
import { buildPrompt } from "../../src/generate/prompt.ts"

const turn: FilteredTurn = {
  prompt: "Move the RUT check",
  messages: ["Moved it to clean()"],
  changes: [{ path: "app/models.py", op: "modify", patch: "+def clean(self): ..." }],
  dropped: [{ path: "pnpm-lock.yaml", reason: "lockfile" }],
  truncated: false,
}

describe("buildPrompt", () => {
  it("includes the notes and the language and no dropped file", () => {
    const prompt = buildPrompt(turn, ["Suppliers from the SII import skip RUT checks."], "es")
    expect(prompt).toContain("Suppliers from the SII import skip RUT checks.")
    expect(prompt).toContain("Spanish")
    expect(prompt).toContain("+def clean(self): ...")
    expect(prompt).toContain("Move the RUT check")
    expect(prompt).not.toContain("pnpm-lock.yaml")
    expect(prompt).toMatch(/0 to 3 cards/)
  })
})
