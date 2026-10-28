import type { Change } from "./git.ts"

export type AgentName = "claude-code" | "codex"

// What a reader extracts from an agent's log: one finished turn, before git adds the diff.
export type RawTurn = {
  agent: { name: AgentName; version: string }
  reader: { id: AgentName; version: number; source: string; offset: number }
  sessionId: string
  turnId: string
  origin: "interactive" | "headless" | "ownship"
  cwd: string
  ts: { start: string; end: string }
  status: "completed" | "interrupted" | "error"
  prompt: string
  messages: string[]
}

export type TurnEvent = Omit<RawTurn, "cwd"> & {
  schema: "ownship.turn/1"
  repo: {
    worktree: string
    commonDir: string
    slug: string
    branch: string | null
    base: string
    head: string
  }
  changes: Change[]
  merged: boolean
}
