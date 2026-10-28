import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { loadConfig, saveConfig } from "../../src/config.ts"
import { ensureDaemon } from "../../src/daemon/lifecycle.ts"
import { homePath } from "../../src/paths.ts"
import { makeRepo, tempHome, writeFiles } from "../helpers.ts"

const FAKE = resolve("test/fixtures/fake-generator.mjs")
let pid = 0

// One finished Claude Code turn in the shape of a 2.1 log, ending now.
function sessionLines(cwd: string): string {
  const now = Date.now()
  const base = { cwd, entrypoint: "cli", sessionId: "e2e", version: "2.1.312", isSidechain: false }
  const user = {
    ...base,
    type: "user",
    uuid: "e2e-u1",
    timestamp: new Date(now - 3000).toISOString(),
    origin: { kind: "human" },
    message: { role: "user", content: "Validate the RUT before saving suppliers" },
  }
  const assistant = {
    ...base,
    type: "assistant",
    uuid: "e2e-a1",
    timestamp: new Date(now - 1000).toISOString(),
    message: {
      role: "assistant",
      content: [{ type: "text", text: "Added the check to save()." }],
      stop_reason: "end_turn",
    },
  }
  return `${JSON.stringify(user)}\n${JSON.stringify(assistant)}\n`
}

describe("the loop", () => {
  afterAll(() => {
    if (pid) process.kill(pid)
  })

  it("a Claude Code turn becomes a reviewable card", async () => {
    const home = tempHome()
    const claudeDir = mkdtempSync(join(tmpdir(), "claude-"))
    process.env.CLAUDE_CONFIG_DIR = claudeDir
    process.env.CODEX_HOME = mkdtempSync(join(tmpdir(), "codex-"))
    process.env.FAKE_OUTPUT = JSON.stringify({
      cards: [
        {
          kind: "choice",
          question: "What does save() check now?",
          explanation: "It validates the RUT first.",
          evidence: [
            {
              source: "patch",
              quote: "if not rut_is_valid(self.tax_id):",
              path: "suppliers.py",
              line: null,
            },
          ],
          options: ["Nothing", "The RUT", "The name"],
          correct: 1,
        },
      ],
    })
    const port = 46000 + Math.floor(Math.random() * 900)
    saveConfig({
      ...loadConfig(),
      port,
      generator: {
        command: ["node", FAKE],
        schema: "validate",
        timeoutMs: 10_000,
        research: { command: ["node", FAKE] },
      },
    })

    const repo = makeRepo({
      "suppliers.py": "class Supplier:\n    def save(self):\n        pass\n",
    })
    await ensureDaemon()
    pid = JSON.parse(readFileSync(homePath("daemon.json"), "utf8")).pid
    const token = readFileSync(join(home, "token"), "utf8")
    const headers = {
      authorization: `Bearer ${token}`,
      "x-ownship": "1",
      "content-type": "application/json",
    }

    writeFiles(repo, {
      "suppliers.py":
        "class Supplier:\n    def save(self):\n        if not rut_is_valid(self.tax_id):\n            raise ValueError\n",
    })
    const project = join(claudeDir, "projects", "toy")
    mkdirSync(project, { recursive: true })
    const log = join(project, "e2e.jsonl")
    writeFileSync(log, sessionLines(repo))
    const rang = await fetch(`http://127.0.0.1:${port}/api/doorbell`, {
      method: "POST",
      headers,
      body: JSON.stringify({ agent: "claude-code", transcriptPath: log }),
    })
    expect(rang.status).toBe(202)

    const session = async () =>
      (
        (await (await fetch(`http://127.0.0.1:${port}/api/session`, { headers })).json()) as {
          cards: { id: number }[]
        }
      ).cards
    await expect.poll(async () => (await session()).length, { timeout: 8000 }).toBe(1)
    const [card] = await session()
    const answered = await fetch(`http://127.0.0.1:${port}/api/cards/${card!.id}/answer`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reviewId: "e2e-r1", answer: { kind: "choice", picked: 1 } }),
    })
    expect(await answered.json()).toEqual({ rating: "good" })
    expect(await session()).toEqual([])
  })
})
