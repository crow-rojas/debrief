import { describe, expect, it } from "vitest"
import { schedule } from "../../src/cards/schedule.ts"

const NOW = new Date("2026-10-28T12:00:00Z")

describe("schedule", () => {
  it("pushes due later after good and sooner after again", () => {
    const good = schedule(null, "good", NOW)
    const again = schedule(null, "again", NOW)
    expect(new Date(good.due).getTime()).toBeGreaterThan(new Date(again.due).getTime())
    const later = schedule(good, "good", new Date(good.due))
    expect(new Date(later.due).getTime() - new Date(good.due).getTime()).toBeGreaterThan(
      new Date(good.due).getTime() - NOW.getTime(),
    )
  })

  it("round-trips through JSON", () => {
    const state = JSON.parse(JSON.stringify(schedule(null, "good", NOW)))
    expect(() => schedule(state, "again", NOW)).not.toThrow()
  })
})
