import { describe, expect, it, vi } from "vitest"
import { doorbell } from "../../src/hooks/doorbell.ts"

const stop = JSON.stringify({
  hook_event_name: "Stop",
  transcript_path: "/tmp/s.jsonl",
  session_id: "s",
})

function deps(ensure = vi.fn(async () => ({ port: 1 }))) {
  const ring = vi.fn(async () => {})
  return { ensure, ring, d: { ensureDaemon: ensure, ring } }
}

describe("doorbell", () => {
  it("rings the daemon with the transcript path", async () => {
    const { ring, d } = deps()
    await doorbell(stop, {}, "claude-code", d)
    expect(ring).toHaveBeenCalledWith(1, { agent: "claude-code", transcriptPath: "/tmp/s.jsonl" })
  })

  it("does nothing under OWNSHIP_GENERATING=1", async () => {
    const { ensure, d } = deps()
    await doorbell(stop, { OWNSHIP_GENERATING: "1" }, "claude-code", d)
    expect(ensure).not.toHaveBeenCalled()
  })

  it("ignores a non-Stop event", async () => {
    const { ensure, d } = deps()
    await doorbell(JSON.stringify({ hook_event_name: "agentStop" }), {}, "claude-code", d)
    await doorbell("not json", {}, "claude-code", d)
    expect(ensure).not.toHaveBeenCalled()
  })

  it("resolves when the daemon cannot start", async () => {
    const failing = vi.fn(async () => {
      throw new Error("no daemon")
    })
    const { d } = deps(failing)
    await expect(doorbell(stop, {}, "codex", d)).resolves.toBeUndefined()
  })
})
