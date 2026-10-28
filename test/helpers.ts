import type { DatabaseSync } from "node:sqlite"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

// Points OWNSHIP_HOME at a fresh temp directory and returns it.
export function tempHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "ownship-home-"))
  process.env.OWNSHIP_HOME = dir
  return dir
}

// Git hooks export GIT_DIR and friends; inherited, they would point every command at the real repository.
export const gitEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
)

export function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, env: gitEnv, encoding: "utf8", stdio: "pipe" }).trim()
}

export function writeFiles(root: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
}

// A temp repo on main; with files, they are committed as the first commit.
export function makeRepo(files?: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "ownship-repo-"))
  git(root, "init", "-q", "-b", "main")
  git(root, "config", "user.email", "test@example.com")
  git(root, "config", "user.name", "Test")
  git(root, "config", "commit.gpgsign", "false")
  if (files) {
    writeFiles(root, files)
    git(root, "add", "-A")
    git(root, "commit", "-q", "-m", "chore: base")
  }
  return root
}

// Inserts a queued turn (with an empty-diff event in worktree) and returns its row id.
export function insertTurn(
  db: DatabaseSync,
  endedAt: string,
  worktree = "/w",
  turnId = `t-${endedAt}`,
): number {
  const event = {
    schema: "ownship.turn/1",
    agent: { name: "codex", version: "0.156.1" },
    reader: { id: "codex", version: 1, source: "x", offset: 0 },
    sessionId: "s",
    turnId,
    origin: "interactive",
    ts: { start: endedAt, end: endedAt },
    status: "completed",
    prompt: "Explain the import",
    messages: ["The import runs inside one transaction."],
    repo: {
      worktree,
      commonDir: `${worktree}/.git`,
      slug: "w-00000000",
      branch: "main",
      base: "",
      head: "",
    },
    changes: [],
    merged: false,
  }
  const result = db
    .prepare(
      `INSERT INTO turns (agent, session_id, turn_id, worktree, common_dir, slug, ended_at, status, state, event_json)
       VALUES ('codex', 's', ?, ?, ?, 'w-00000000', ?, 'completed', 'queued', ?)`,
    )
    .run(turnId, worktree, `${worktree}/.git`, endedAt, JSON.stringify(event))
  return Number(result.lastInsertRowid)
}
