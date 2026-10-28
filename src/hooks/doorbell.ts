import { readFileSync } from "node:fs"
import type { AgentName } from "../capture/event.ts"
import { ensureDaemon } from "../daemon/lifecycle.ts"
import { homePath } from "../paths.ts"

type Deps = {
  ensureDaemon: () => Promise<{ port: number }>
  ring: (port: number, body: { agent: AgentName; transcriptPath?: string }) => Promise<void>
}

async function ring(
  port: number,
  body: { agent: AgentName; transcriptPath?: string },
): Promise<void> {
  const token = readFileSync(homePath("token"), "utf8").trim()
  await fetch(`http://127.0.0.1:${port}/api/doorbell`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "x-ownship": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(2000),
  })
}

// Run by the agent's Stop hook. It must never slow down or fail the agent's turn, so every
// problem is swallowed; the file watcher picks the turn up anyway.
export async function doorbell(
  stdin: string,
  env: NodeJS.ProcessEnv,
  agent: AgentName,
  deps: Deps = { ensureDaemon, ring },
): Promise<void> {
  if (env.OWNSHIP_GENERATING === "1") return
  let payload: { hook_event_name?: string; transcript_path?: string }
  try {
    payload = JSON.parse(stdin) as typeof payload
  } catch {
    return
  }
  // Copilot CLI also runs hooks from .claude/settings.json, with its own event names.
  if (payload.hook_event_name !== "Stop") return
  try {
    const { port } = await deps.ensureDaemon()
    await deps.ring(port, { agent, transcriptPath: payload.transcript_path })
  } catch {
    // Nothing to do: capture falls back to watching the logs.
  }
}
