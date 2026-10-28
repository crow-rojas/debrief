import { copyFileSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { codexReader } from "../../../src/capture/readers/codex.ts"

const DIR = resolve("test/fixtures/codex/0.156")
const session = join(DIR, "rollout-2026-10-28T12-00-00-s-codex-1.jsonl")

describe("Codex reader", () => {
  it("extracts one completed turn with prompt and visible messages only", async () => {
    const { turns } = await codexReader.read(session, 0)
    expect(turns[0]).toMatchObject({
      agent: { name: "codex", version: "0.156.1" },
      sessionId: "s-codex-1",
      turnId: "t1",
      origin: "interactive",
      cwd: "/home/user/toy",
      status: "completed",
      prompt: "Validate the RUT in Supplier.clean()",
      messages: ["Moved the check to clean() so the bulk import runs it too."],
      ts: { start: "2026-10-28T12:00:01.000Z", end: "2026-10-28T12:00:06.000Z" },
    })
    const all = JSON.stringify(turns)
    for (const hidden of ["DEVELOPER", "INJECTED", "REASONING", "TOOL OUTPUT"]) {
      expect(all).not.toContain(`${hidden} MUST NOT APPEAR`)
    }
  })

  it("marks an interrupted turn and a turn that ended in error", async () => {
    const { turns } = await codexReader.read(session, 0)
    expect(turns.map((t) => [t.turnId, t.status])).toEqual([
      ["t1", "completed"],
      ["t2", "interrupted"],
      ["t3", "error"],
    ])
  })

  it("marks codex exec and subagent sessions as headless", async () => {
    for (const name of ["s-codex-exec", "s-codex-sub"]) {
      const file = join(
        DIR,
        `rollout-2026-10-28T1${name.endsWith("exec") ? 3 : 4}-00-00-${name}.jsonl`,
      )
      const { turns } = await codexReader.read(file, 0)
      expect(turns.map((t) => t.origin)).toEqual(["headless"])
    }
  })

  it("leaves a half-written last line for the next read", async () => {
    const dir = mkdtempSync(join(tmpdir(), "reader-"))
    const file = join(dir, "rollout-x.jsonl")
    const full = readFileSync(session, "utf8")
    writeFileSync(file, full.slice(0, full.indexOf('"task_complete"')))
    const partial = await codexReader.read(file, 0)
    expect(partial.turns).toEqual([])
    copyFileSync(session, file)
    const rest = await codexReader.read(file, partial.offset)
    expect(rest.turns.map((t) => t.turnId)).toEqual(["t1", "t2", "t3"])
    expect(rest.offset).toBe(statSync(file).size)
  })

  it("reads the session meta again when resuming mid-file", async () => {
    const first = await codexReader.read(session, 0)
    const lines = readFileSync(session, "utf8").split("\n")
    const afterFirstTurn = Buffer.byteLength(lines.slice(0, 10).join("\n") + "\n")
    const resumed = await codexReader.read(session, afterFirstTurn)
    expect(resumed.turns[0]).toMatchObject({
      turnId: "t2",
      cwd: "/home/user/toy",
      sessionId: "s-codex-1",
    })
    expect(first.turns).toHaveLength(3)
  })

  it("skips an unknown format version instead of guessing", async () => {
    const result = await codexReader.read(resolve("test/fixtures/codex/future-version.jsonl"), 0)
    expect(result.turns).toEqual([])
    expect(result.skipped[0]?.reason).toContain("1.0.0")
  })

  it("reads a zstd-compressed rollout", async () => {
    const plain = await codexReader.read(session, 0)
    const zst = await codexReader.read(
      join(DIR, "compressed", `${session.split("/").pop()}.zst`),
      0,
    )
    expect(zst.turns.map((t) => t.turnId)).toEqual(plain.turns.map((t) => t.turnId))
    expect(zst.offset).toBe(0)
  })
})
