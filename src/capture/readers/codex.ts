import { readFile, readdir } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { zstdDecompressSync } from "node:zlib"
import type { RawTurn } from "../event.ts"
import { linesOf, readLines, type Line, type ReadResult, type Reader } from "./types.ts"

// Version lines with fixtures under test/fixtures/codex/ (paginated history, 0.130 to 0.169).
const SUPPORTED = /^0\.1[3-6]\d\./

type Block = { type?: string; text?: string }
type Record = {
  type?: string
  timestamp?: string
  payload?: {
    type?: string
    role?: string
    content?: Block[]
    turn_id?: string
    error?: unknown
    id?: string
    cwd?: string
    originator?: string
    cli_version?: string
    source?: unknown
  }
}

// Context Codex injects as user messages: AGENTS.md, environment, notifications, plugins.
const injected = (text: string) => text.startsWith("<") || text.startsWith("# AGENTS.md")

const textOf = (content: Block[] | undefined, injectedToo: boolean) =>
  (content ?? [])
    .map((b) => (b.text ?? "").trim())
    .filter((t) => t && (injectedToo || !injected(t)))

async function linesFrom(
  file: string,
  offset: number,
): Promise<{ lines: Line[]; meta: Line | undefined }> {
  // Cold rollouts are compressed whole, so they are always read from the start.
  if (file.endsWith(".zst")) {
    const lines = linesOf(zstdDecompressSync(await readFile(file)))
    return { lines, meta: lines[0] }
  }
  const lines = await readLines(file, offset)
  const meta = offset === 0 ? lines[0] : (await readLines(file, 0))[0]
  return { lines, meta }
}

async function read(file: string, offset: number): Promise<ReadResult> {
  const zst = file.endsWith(".zst")
  const { lines, meta: metaLine } = await linesFrom(file, zst ? 0 : offset)
  const turns: RawTurn[] = []
  const skipped: ReadResult["skipped"] = []
  let next = zst ? 0 : offset

  const meta = metaLine ? (JSON.parse(metaLine.text) as Record).payload : undefined
  const version = meta?.cli_version ?? ""
  if (!SUPPORTED.test(version)) {
    skipped.push({ reason: `unsupported Codex version ${version || "(none)"}`, at: 0 })
    return { turns, offset: zst ? 0 : (lines.at(-1)?.end ?? offset), skipped }
  }
  const headless =
    meta?.originator === "codex_exec" || (typeof meta?.source === "object" && meta.source !== null)

  let current: RawTurn | null = null
  for (const line of lines) {
    let record: Record
    try {
      record = JSON.parse(line.text) as Record
    } catch {
      skipped.push({ reason: "unparseable line", at: line.start })
      continue
    }
    const p = record.payload ?? {}
    if (record.type === "event_msg" && p.type === "task_started") {
      current = {
        agent: { name: "codex", version },
        reader: { id: "codex", version: 1, source: file, offset: line.start },
        sessionId: meta?.id ?? "",
        turnId: p.turn_id ?? String(line.start),
        origin: headless ? "headless" : "interactive",
        cwd: meta?.cwd ?? "",
        ts: { start: record.timestamp ?? "", end: "" },
        status: "completed",
        prompt: "",
        messages: [],
      }
    } else if (!current) {
      continue
    } else if (record.type === "response_item" && p.type === "message" && p.role === "user") {
      const said = textOf(p.content, false).join("\n")
      if (said) current.prompt = current.prompt ? `${current.prompt}\n${said}` : said
    } else if (record.type === "response_item" && p.type === "message" && p.role === "assistant") {
      current.messages.push(...textOf(p.content, true))
    } else if (
      record.type === "event_msg" &&
      (p.type === "task_complete" || p.type === "turn_aborted")
    ) {
      const status = p.type === "turn_aborted" ? "interrupted" : p.error ? "error" : "completed"
      turns.push({ ...current, status, ts: { ...current.ts, end: record.timestamp ?? "" } })
      current = null
      if (!zst) next = line.end
    }
  }
  return { turns, offset: next, skipped }
}

function root(): string {
  return join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "sessions")
}

async function files(): Promise<string[]> {
  const entries = await readdir(root(), { recursive: true }).catch(() => [] as string[])
  return entries
    .filter((name) => /(^|\/)rollout-[^/]*\.jsonl(\.zst)?$/.test(name))
    .map((name) => join(root(), name))
}

export const codexReader: Reader = { id: "codex", version: 1, root, files, read }
