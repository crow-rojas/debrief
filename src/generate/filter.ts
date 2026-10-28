import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { basename, join } from "node:path"
import type { TurnEvent } from "../capture/event.ts"
import type { Change } from "../capture/git.ts"

export type FilteredTurn = {
  prompt: string
  messages: string[]
  changes: Change[]
  dropped: { path: string; reason: "ignored" | "lockfile" | "generated" | "secret" }[]
  truncated: boolean
}

const LOCKFILES = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "Gemfile.lock",
  "poetry.lock",
  "uv.lock",
  "Cargo.lock",
  "composer.lock",
  "go.sum",
])

// ponytail: regex rules catch common shapes only; run gitleaks when it is installed if this proves thin.
export const SECRET_RULES: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9]{36,}/,
  /github_pat_\w{20,}/,
  /xox[abprs]-[\w-]{10,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /(secret|token|password|passwd|api[_-]?key)\s*[:=]\s*["'][^"']{12,}["']/i,
]

const MARKER = "\n[truncated by ownship]"
const hasSecret = (text: string) => SECRET_RULES.some((rule) => rule.test(text))

function generated(change: Change): boolean {
  if (/\.min\.js$|\.map$/.test(change.path)) return true
  const added = change.patch
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .slice(0, 5)
  return added.some((l) => /@generated|DO NOT EDIT/.test(l))
}

// Paths the repo's .ownshipignore matches, asked of git so the syntax is .gitignore's.
function ignoredPaths(worktree: string, paths: string[]): Promise<Set<string>> {
  const file = join(worktree, ".ownshipignore")
  if (!existsSync(file) || paths.length === 0) return Promise.resolve(new Set())
  return new Promise((resolve) => {
    const child = execFile(
      "git",
      ["-c", `core.excludesFile=${file}`, "check-ignore", "--no-index", "--stdin"],
      { cwd: worktree },
      (_error, stdout) => resolve(new Set(stdout.split("\n").filter(Boolean))),
    )
    child.stdin?.end(paths.join("\n"))
  })
}

// Drops every hunk that holds a secret; null when none is left.
function withoutSecrets(patch: string): { patch: string | null; removed: boolean } {
  const [header = "", ...hunks] = patch.split(/^(?=@@ )/m)
  const kept = hunks.filter((hunk) => !hasSecret(hunk))
  if (kept.length === hunks.length) return { patch, removed: false }
  return { patch: kept.length ? header + kept.join("") : null, removed: true }
}

// Cuts the largest patches first until the total fits the budget.
function truncate(changes: Change[], budget: number): boolean {
  let total = changes.reduce((sum, c) => sum + c.patch.length, 0)
  if (total <= budget) return false
  for (const change of [...changes].sort((a, b) => b.patch.length - a.patch.length)) {
    if (total <= budget) break
    const keep = Math.max(200, change.patch.length - (total - budget) - MARKER.length)
    if (keep >= change.patch.length) continue
    total -= change.patch.length
    change.patch = change.patch.slice(0, keep) + MARKER
    total += change.patch.length
  }
  return true
}

const clean = (text: string) =>
  text
    .split("\n")
    .filter((line) => !hasSecret(line))
    .join("\n")

export async function filterTurn(turn: TurnEvent, budgetChars = 60_000): Promise<FilteredTurn> {
  const dropped: FilteredTurn["dropped"] = []
  const ignored = await ignoredPaths(
    turn.repo.worktree,
    turn.changes.map((c) => c.path),
  )
  const changes: Change[] = []
  for (const change of turn.changes) {
    if (ignored.has(change.path)) dropped.push({ path: change.path, reason: "ignored" })
    else if (LOCKFILES.has(basename(change.path)))
      dropped.push({ path: change.path, reason: "lockfile" })
    else if (generated(change)) dropped.push({ path: change.path, reason: "generated" })
    else {
      const { patch, removed } = withoutSecrets(change.patch)
      if (removed) dropped.push({ path: change.path, reason: "secret" })
      if (patch !== null) changes.push({ ...change, patch })
    }
  }
  return {
    prompt: clean(turn.prompt),
    messages: turn.messages.map(clean).filter(Boolean),
    changes,
    dropped,
    truncated: truncate(changes, budgetChars),
  }
}
