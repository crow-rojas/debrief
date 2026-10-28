import { resolve } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { loadConfig } from "../../src/config.ts"
import { openDb } from "../../src/db.ts"
import { runPipelineOnce } from "../../src/generate/pipeline.ts"
import { GeneratorError, type GeneratorConfig } from "../../src/generate/run.ts"
import { insertTurn, makeRepo, tempHome } from "../helpers.ts"

const NOW = new Date(2026, 9, 28, 15, 0, 0)
const fake: GeneratorConfig = {
  command: ["node", resolve("test/fixtures/fake-generator.mjs")],
  schema: "validate",
  timeoutMs: 5000,
  research: { command: ["node", resolve("test/fixtures/fake-generator.mjs")] },
}

describe("pipeline", () => {
  beforeEach(() => {
    tempHome()
  })

  it("generates cards for the newest turn and marks it generated", async () => {
    const db = openDb()
    const id = insertTurn(db, new Date(NOW.getTime() - 60_000).toISOString(), makeRepo())
    const config = { ...loadConfig(), generator: fake }
    expect(await runPipelineOnce(db, config, NOW)).toBe("generated")
    expect(db.prepare("SELECT state FROM turns WHERE id = ?").get(id)).toEqual({
      state: "generated",
    })
    expect(db.prepare("SELECT count(*) AS n FROM cards").get()).toEqual({ n: 1 })
    expect(await runPipelineOnce(db, config, NOW)).toBe("idle")
  })

  it("a generator failure keeps the turn queued with the error, and the third failure marks it failed", async () => {
    const db = openDb()
    const id = insertTurn(db, new Date(NOW.getTime() - 60_000).toISOString(), makeRepo())
    const run = async () => {
      throw new GeneratorError("timeout", "too slow")
    }
    const config = { ...loadConfig(), generator: fake }
    expect(await runPipelineOnce(db, config, NOW, { run })).toBe("failed")
    expect(
      db.prepare("SELECT state, attempts, last_error FROM turns WHERE id = ?").get(id),
    ).toEqual({
      state: "queued",
      attempts: 1,
      last_error: "timeout: too slow",
    })
    await runPipelineOnce(db, config, NOW, { run })
    await runPipelineOnce(db, config, NOW, { run })
    expect(db.prepare("SELECT state FROM turns WHERE id = ?").get(id)).toEqual({ state: "failed" })
  })

  it("reports capped when the daily cap is reached", async () => {
    const db = openDb()
    insertTurn(db, new Date(NOW.getTime() - 60_000).toISOString(), makeRepo())
    expect(
      await runPipelineOnce(db, { ...loadConfig(), generator: fake, dailyNewCards: 0 }, NOW),
    ).toBe("capped")
  })
})
