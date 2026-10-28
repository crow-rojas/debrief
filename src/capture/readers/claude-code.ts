import { readdir } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import type { RawTurn } from "../event.ts"
import { readLines, type ReadResult, type Reader } from "./types.ts"

// Version lines with fixtures under test/fixtures/claude-code/. Anything else is skipped, not guessed.
const SUPPORTED = /^2\.1\./
const INTERRUPTED = "[Request interrupted by user"
const INJECTED =
  /<(system-reminder|local-command-stdout|local-command-stderr|local-command-caveat|command-message|task-notification|user-prompt-submit-hook|bash-stdout|bash-stderr)>[\s\S]*?<\/\1>/g

type Block = { type?: string; text?: string }
type Entry = {
  type?: string
  uuid?: string
  timestamp?: string
  sessionId?: string
  cwd?: string
  version?: string
  entrypoint?: string
  isMeta?: boolean
  isApiErrorMessage?: boolean
  message?: { content?: string | Block[]; stop_reason?: string }
}

function text(content: string | Block[] | undefined): string | null {
  if (typeof content === "string") return content
  if (!Array.isArray(content) || content.some((b) => b.type === "tool_result")) return null
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
}

// The user's words: injected context removed, a slash command kept as "/name args".
function promptOf(raw: string): string {
  return raw
    .replace(INJECTED, "")
    .replace(/<command-name>([\s\S]*?)<\/command-name>/g, "$1 ")
    .replace(/<command-args>([\s\S]*?)<\/command-args>/g, "$1")
    .trim()
}

async function read(file: string, offset: number): Promise<ReadResult> {
  const turns: RawTurn[] = []
  const skipped: ReadResult["skipped"] = []
  let next = offset
  let current: RawTurn | null = null

  const close = (status: RawTurn["status"], end: string | undefined, lineEnd: number) => {
    if (!current) return
    turns.push({ ...current, status, ts: { ...current.ts, end: end ?? current.ts.start } })
    current = null
    next = lineEnd
  }

  for (const line of await readLines(file, offset)) {
    let entry: Entry
    try {
      entry = JSON.parse(line.text) as Entry
    } catch {
      skipped.push({ reason: "unparseable line", at: line.start })
      continue
    }
    if (entry.version && !SUPPORTED.test(entry.version)) {
      skipped.push({ reason: `unsupported Claude Code version ${entry.version}`, at: line.start })
      const end = (await readLines(file, offset)).at(-1)?.end ?? offset
      return { turns: [], offset: end, skipped }
    }

    if (entry.type === "user" && !entry.isMeta) {
      const raw = text(entry.message?.content)
      if (raw === null) continue
      if (raw.includes(INTERRUPTED)) {
        close("interrupted", entry.timestamp, line.end)
        continue
      }
      const prompt = promptOf(raw)
      if (!prompt) continue
      close("interrupted", entry.timestamp, line.start)
      current = {
        agent: { name: "claude-code", version: entry.version ?? "" },
        reader: { id: "claude-code", version: 1, source: file, offset: line.start },
        sessionId: entry.sessionId ?? "",
        turnId: entry.uuid ?? String(line.start),
        origin: entry.entrypoint === "sdk-cli" ? "headless" : "interactive",
        cwd: entry.cwd ?? "",
        ts: { start: entry.timestamp ?? "", end: "" },
        status: "completed",
        prompt,
        messages: [],
      }
    } else if (entry.type === "assistant" && current) {
      if (entry.isApiErrorMessage) {
        close("error", entry.timestamp, line.end)
        continue
      }
      const said = text(entry.message?.content)
      if (said) (current as RawTurn).messages.push(said)
      if (entry.message?.stop_reason === "end_turn") close("completed", entry.timestamp, line.end)
    }
  }
  return { turns, offset: next, skipped }
}

function root(): string {
  const config = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude")
  return join(config, "projects")
}

// One level of project folders; subagent logs live deeper and are not read in v1.
async function files(): Promise<string[]> {
  const projects = await readdir(root(), { withFileTypes: true }).catch(() => [])
  const found = await Promise.all(
    projects
      .filter((d) => d.isDirectory())
      .map(async (d) => {
        const dir = join(root(), d.name)
        const entries = await readdir(dir).catch(() => [])
        return entries.filter((name) => name.endsWith(".jsonl")).map((name) => join(dir, name))
      }),
  )
  return found.flat()
}

export const claudeCodeReader: Reader = { id: "claude-code", version: 1, root, files, read }
