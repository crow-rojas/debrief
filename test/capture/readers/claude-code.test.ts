import { copyFileSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { claudeCodeReader } from "../../../src/capture/readers/claude-code.ts"

const FIXTURES = resolve("test/fixtures/claude-code")
const session = join(FIXTURES, "2.1/session.jsonl")

describe("Claude Code reader", () => {
  it("extracts one completed turn with prompt and visible messages only", async () => {
    const { turns } = await claudeCodeReader.read(session, 0)
    const first = turns[0]
    expect(first).toMatchObject({
      agent: { name: "claude-code", version: "2.1.312" },
      sessionId: "s-claude-1",
      turnId: "u1",
      origin: "interactive",
      cwd: "/home/user/toy",
      status: "completed",
      prompt: "Move the RUT validation into Supplier.clean()",
      messages: [
        "Moved it to clean() because the bulk import calls full_clean() and skips the serializer.",
      ],
      ts: { start: "2026-10-28T10:00:01.000Z", end: "2026-10-28T10:00:05.000Z" },
    })
    const all = JSON.stringify(turns)
    expect(all).not.toContain("TOOL OUTPUT MUST NOT APPEAR")
    expect(all).not.toContain("META MUST NOT APPEAR")
    expect(all).not.toContain("system-reminder")
  })

  it("marks an interrupted turn", async () => {
    const { turns } = await claudeCodeReader.read(session, 0)
    expect(turns.map((t) => [t.turnId, t.status])).toEqual([
      ["u1", "completed"],
      ["u2", "interrupted"],
      ["u3", "completed"],
      ["u4", "error"],
    ])
  })

  it("marks a -p session as headless", async () => {
    const { turns } = await claudeCodeReader.read(join(FIXTURES, "2.1/headless.jsonl"), 0)
    expect(turns).toHaveLength(1)
    expect(turns[0]?.origin).toBe("headless")
  })

  it("leaves a half-written last line for the next read", async () => {
    const dir = mkdtempSync(join(tmpdir(), "reader-"))
    const file = join(dir, "s.jsonl")
    const full = readFileSync(session, "utf8")
    const cut = full.indexOf('"Moved it to clean()')
    writeFileSync(file, full.slice(0, cut))
    const partial = await claudeCodeReader.read(file, 0)
    expect(partial.turns).toEqual([])
    expect(partial.offset).toBe(0)
    copyFileSync(session, file)
    const rest = await claudeCodeReader.read(file, partial.offset)
    expect(rest.turns.filter((t) => t.turnId === "u1")).toHaveLength(1)
    expect(rest.offset).toBe(statSync(file).size)
  })

  it("ignores subagent (sidechain) records", async () => {
    const dir = mkdtempSync(join(tmpdir(), "reader-"))
    const file = join(dir, "s.jsonl")
    const sidechain = readFileSync(session, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.stringify({ ...JSON.parse(line), isSidechain: true }))
      .join("\n")
    writeFileSync(file, `${sidechain}\n`)
    expect((await claudeCodeReader.read(file, 0)).turns).toEqual([])
  })

  it("owns session logs only, not subagent logs", () => {
    const root = claudeCodeReader.root()
    expect(claudeCodeReader.owns?.(join(root, "proj", "s.jsonl"))).toBe(true)
    expect(claudeCodeReader.owns?.(join(root, "proj", "s", "subagents", "agent-1.jsonl"))).toBe(
      false,
    )
  })

  it("skips an unknown format version instead of guessing", async () => {
    const result = await claudeCodeReader.read(join(FIXTURES, "future-version.jsonl"), 0)
    expect(result.turns).toEqual([])
    expect(result.skipped[0]?.reason).toContain("3.0.0")
  })
})
