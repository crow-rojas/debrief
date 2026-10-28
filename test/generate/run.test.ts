import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { loadConfig } from "../../src/config.ts"
import { pickGenerator, presets } from "../../src/generate/presets.ts"
import { GeneratorError, runGenerator, type GeneratorConfig } from "../../src/generate/run.ts"
import { tempHome } from "../helpers.ts"

const FAKE = resolve("test/fixtures/fake-generator.mjs")
const fake = (timeoutMs = 5000): GeneratorConfig => ({
  command: ["node", FAKE],
  schema: "validate",
  timeoutMs,
  research: { command: ["node", FAKE] },
})
const dir = () => mkdtempSync(join(tmpdir(), "gen-"))

describe("runGenerator", () => {
  afterEach(() => {
    delete process.env.FAKE_MODE
    delete process.env.FAKE_STATE
    delete process.env.FAKE_ENV_OUT
  })

  it("returns cards from a valid run and sets OWNSHIP_GENERATING=1", async () => {
    process.env.FAKE_ENV_OUT = join(dir(), "env.json")
    const out = await runGenerator(fake(), "the prompt", { research: false })
    expect(out.cards).toHaveLength(1)
    const seen = JSON.parse(readFileSync(process.env.FAKE_ENV_OUT, "utf8"))
    expect(seen).toEqual({ generating: "1", input: "the prompt" })
  })

  it("retries invalid output once", async () => {
    process.env.FAKE_MODE = "garbage-once"
    process.env.FAKE_STATE = join(dir(), "state")
    expect((await runGenerator(fake(), "p", { research: false })).cards).toHaveLength(1)
    process.env.FAKE_MODE = "garbage"
    await expect(runGenerator(fake(), "p", { research: false })).rejects.toMatchObject({
      reason: "invalid",
    })
  })

  it("times out", async () => {
    process.env.FAKE_MODE = "sleep"
    const error = await runGenerator(fake(300), "p", { research: false }).catch((e) => e)
    expect(error).toBeInstanceOf(GeneratorError)
    expect(error.reason).toBe("timeout")
  })

  it("reports a missing command and a failing one", async () => {
    const missing = { ...fake(), command: ["no-such-binary-ownship"] }
    await expect(runGenerator(missing, "p", { research: false })).rejects.toMatchObject({
      reason: "missing",
    })
    process.env.FAKE_MODE = "exit1"
    await expect(runGenerator(fake(), "p", { research: false })).rejects.toMatchObject({
      reason: "exit",
    })
  })

  it("rejects output that breaks the card schema", async () => {
    process.env.FAKE_MODE = "valid"
    const tooMany = { cards: Array.from({ length: 4 }, () => JSON.parse(defaultCard())) }
    process.env.FAKE_OUTPUT = JSON.stringify(tooMany)
    try {
      await expect(runGenerator(fake(), "p", { research: false })).rejects.toMatchObject({
        reason: "invalid",
      })
    } finally {
      delete process.env.FAKE_OUTPUT
    }
  })
})

function defaultCard(): string {
  return JSON.stringify({
    kind: "number",
    question: "How many paths create a supplier?",
    explanation: "API, admin and import.",
    evidence: [{ source: "prompt", quote: "x", path: null, line: null }],
    value: 3,
    tolerance: 0,
  })
}

describe("pickGenerator", () => {
  it("prefers the turn's agent, falls back to the other, honors a configured command", () => {
    tempHome()
    const config = loadConfig()
    expect(pickGenerator(config, "codex", ["claude-code", "codex"])).toBe(presets.codex)
    expect(pickGenerator(config, "codex", ["claude-code"])).toBe(presets["claude-code"])
    expect(pickGenerator(config, "codex", [])).toBeNull()
    const custom = fake()
    expect(pickGenerator({ ...config, generator: custom }, "codex", [])).toBe(custom)
  })

  it("presets carry the anti-recursion flags", () => {
    expect(presets["claude-code"].command).toEqual(
      expect.arrayContaining(["-p", "--no-session-persistence"]),
    )
    expect(presets["claude-code"].command.join(" ")).toContain("--tools ")
    expect(presets.codex.command).toEqual(
      expect.arrayContaining(["exec", "--ephemeral", "--disable", "hooks"]),
    )
  })
})
