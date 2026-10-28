import { appendFileSync, mkdirSync, realpathSync, watch as fsWatch, type FSWatcher } from "node:fs"
import { stat } from "node:fs/promises"
import { join, resolve, sep } from "node:path"
import type { DatabaseSync } from "node:sqlite"
import { loadConfig } from "../config.ts"
import { home, homePath } from "../paths.ts"
import type { AgentName, RawTurn, TurnEvent } from "./event.ts"
import { baseTree, currentBranch, diffTrees, repoIdentity, snapshot } from "./git.ts"
import type { Reader } from "./readers/types.ts"

export type TurnRow = {
  id: number
  agent: AgentName
  sessionId: string
  turnId: string
  worktree: string
  commonDir: string
  slug: string
  endedAt: string
  status: RawTurn["status"]
  state: "queued" | "generated" | "expired" | "skipped" | "failed"
  attempts: number
  lastError: string | null
  event: TurnEvent
}

// A turn that ended this recently still matches the working tree, so it gets its own snapshot.
const LIVE_MS = 120_000

type Identity = NonNullable<Awaited<ReturnType<typeof repoIdentity>>>

export function getTurn(db: DatabaseSync, id: number): TurnRow | null {
  const row = db.prepare("SELECT * FROM turns WHERE id = ?").get(id) as
    Record<string, unknown> | undefined
  if (!row) return null
  return {
    id: row.id as number,
    agent: row.agent as AgentName,
    sessionId: row.session_id as string,
    turnId: row.turn_id as string,
    worktree: row.worktree as string,
    commonDir: row.common_dir as string,
    slug: row.slug as string,
    endedAt: row.ended_at as string,
    status: row.status as RawTurn["status"],
    state: row.state as TurnRow["state"],
    attempts: row.attempts as number,
    lastError: (row.last_error as string | null) ?? null,
    event: JSON.parse(row.event_json as string) as TurnEvent,
  }
}

function log(message: string): void {
  mkdirSync(home(), { recursive: true })
  appendFileSync(homePath("capture.log"), `${new Date().toISOString()} ${message}\n`)
}

function excluded(identity: Identity, exclude: string[]): boolean {
  return exclude.some((entry) => {
    if (entry === identity.slug) return true
    let path = resolve(entry)
    try {
      path = realpathSync(path)
    } catch {
      // A path that does not exist yet still excludes what lives under it later.
    }
    return [identity.worktree, identity.commonDir].some(
      (p) => p === path || p.startsWith(path + sep),
    )
  })
}

function known(db: DatabaseSync, t: RawTurn): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM turns WHERE agent = ? AND session_id = ? AND turn_id = ?")
      .get(t.agent.name, t.sessionId, t.turnId),
  )
}

const insert = (db: DatabaseSync, t: RawTurn, identity: Identity, state: string, event: object) =>
  db
    .prepare(
      `INSERT OR IGNORE INTO turns (agent, session_id, turn_id, worktree, common_dir, slug, ended_at, status, state, event_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      t.agent.name,
      t.sessionId,
      t.turnId,
      identity.worktree,
      identity.commonDir,
      identity.slug,
      t.ts.end,
      t.status,
      state,
      JSON.stringify(event),
    )

// Snapshots the worktree and stores the group as one turn; earlier members of a merged group are
// recorded as skipped so a reread does not bring them back.
async function store(db: DatabaseSync, group: RawTurn[], identity: Identity): Promise<void> {
  const last = group.at(-1)!
  const previous = db
    .prepare("SELECT tree FROM snapshots WHERE worktree = ?")
    .get(identity.worktree) as { tree: string } | undefined
  const base = previous?.tree ?? (await baseTree(identity.worktree))
  const head = await snapshot(identity.worktree)
  const event: TurnEvent = {
    agent: last.agent,
    reader: last.reader,
    sessionId: last.sessionId,
    turnId: last.turnId,
    origin: last.origin,
    status: last.status,
    schema: "ownship.turn/1",
    ts: { start: group[0]!.ts.start, end: last.ts.end },
    prompt: group
      .map((t) => t.prompt)
      .filter(Boolean)
      .join("\n\n"),
    messages: group.flatMap((t) => t.messages),
    repo: { ...identity, branch: await currentBranch(identity.worktree), base, head },
    changes: await diffTrees(identity.worktree, base, head),
    merged: group.length > 1,
  }
  db.prepare("INSERT OR REPLACE INTO snapshots (worktree, tree, taken_at) VALUES (?, ?, ?)").run(
    identity.worktree,
    head,
    new Date().toISOString(),
  )
  for (const member of group.slice(0, -1)) insert(db, member, identity, "skipped", {})
  insert(db, last, identity, "queued", event)
}

export async function processFile(
  db: DatabaseSync,
  reader: Reader,
  file: string,
  now: Date,
): Promise<number> {
  const saved = db
    .prepare("SELECT offset FROM reader_offsets WHERE reader_id = ? AND file = ?")
    .get(reader.id, file) as { offset: number } | undefined
  const size = (await stat(file).catch(() => null))?.size ?? 0
  const offset = saved && saved.offset <= size ? saved.offset : 0
  const result = await reader.read(file, offset)
  for (const skip of result.skipped) log(`${reader.id} ${file}@${skip.at}: ${skip.reason}`)

  const config = loadConfig()
  const groups: { live: boolean; identity: Identity; turns: RawTurn[] }[] = []
  for (const t of result.turns) {
    if (t.origin !== "interactive" || t.status !== "completed" || known(db, t)) continue
    const identity = await repoIdentity(t.cwd)
    if (!identity || excluded(identity, config.exclude)) continue
    const live = now.getTime() - new Date(t.ts.end).getTime() <= LIVE_MS
    const last = groups.at(-1)
    if (!live && last && !last.live && last.identity.worktree === identity.worktree)
      last.turns.push(t)
    else groups.push({ live, identity, turns: [t] })
  }
  for (const group of groups) await store(db, group.turns, group.identity)

  db.prepare(
    "INSERT OR REPLACE INTO reader_offsets (reader_id, file, offset) VALUES (?, ?, ?)",
  ).run(reader.id, file, result.offset)
  return groups.length
}

// On a reader's first run, existing logs are history: start from their end, not their start.
export async function catchUp(db: DatabaseSync, readers: Reader[], now: Date): Promise<void> {
  for (const reader of readers) {
    const files = await reader.files()
    const seen = db
      .prepare("SELECT 1 FROM reader_offsets WHERE reader_id = ? LIMIT 1")
      .get(reader.id)
    for (const file of files) {
      if (!seen) {
        const { size } = await stat(file)
        db.prepare(
          "INSERT OR REPLACE INTO reader_offsets (reader_id, file, offset) VALUES (?, ?, ?)",
        ).run(reader.id, file, file.endsWith(".zst") ? 0 : size)
        continue
      }
      await processFile(db, reader, file, now).catch((error: Error) =>
        log(`${reader.id} ${file}: ${error.message}`),
      )
    }
    if (!seen && files.length === 0) {
      db.prepare(
        "INSERT OR REPLACE INTO reader_offsets (reader_id, file, offset) VALUES (?, '', 0)",
      ).run(reader.id)
    }
  }
}

export function watch(
  db: DatabaseSync,
  readers: Reader[],
  opts: { debounceMs?: number; onStored?: () => void } = {},
): () => void {
  const timers = new Map<string, NodeJS.Timeout>()
  const watchers: FSWatcher[] = []
  for (const reader of readers) {
    let watcher: FSWatcher
    try {
      watcher = fsWatch(reader.root(), { recursive: true })
    } catch {
      continue
    }
    watcher.on("change", (_event, name) => {
      const file = join(reader.root(), String(name))
      if (!/\.jsonl(\.zst)?$/.test(file)) return
      clearTimeout(timers.get(file))
      timers.set(
        file,
        setTimeout(() => {
          processFile(db, reader, file, new Date())
            .then((stored) => stored > 0 && opts.onStored?.())
            .catch((error: Error) => log(`${reader.id} ${file}: ${error.message}`))
        }, opts.debounceMs ?? 2000),
      )
    })
    watchers.push(watcher)
  }
  return () => {
    for (const timer of timers.values()) clearTimeout(timer)
    for (const watcher of watchers) watcher.close()
  }
}
