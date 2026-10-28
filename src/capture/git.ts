import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { promisify } from "node:util"

export type Change = { path: string; op: "add" | "modify" | "delete" | "rename"; patch: string }

export const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"

const run = promisify(execFile)

// Never inherit GIT_DIR, GIT_INDEX_FILE and friends: a hook's environment would aim git elsewhere.
function cleanEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  )
  return { ...env, ...extra }
}

async function git(cwd: string, args: string[], extraEnv?: Record<string, string>) {
  const { stdout } = await run("git", ["-c", "core.quotePath=false", ...args], {
    cwd,
    env: cleanEnv(extraEnv),
    maxBuffer: 256 * 1024 * 1024,
  })
  return stdout
}

async function hasHead(worktree: string): Promise<boolean> {
  try {
    await git(worktree, ["rev-parse", "--verify", "-q", "HEAD"])
    return true
  } catch {
    return false
  }
}

export async function repoIdentity(
  cwd: string,
): Promise<{ worktree: string; commonDir: string; slug: string } | null> {
  let out: string
  try {
    out = await git(cwd, ["rev-parse", "--show-toplevel", "--git-common-dir"])
  } catch {
    return null
  }
  const [top, common] = out.trim().split("\n")
  if (!top || !common) return null
  const worktree = await realpath(top)
  const commonDir = await realpath(resolve(cwd, common))
  const mainDir = basename(commonDir) === ".git" ? dirname(commonDir) : commonDir
  const hash = createHash("sha256").update(commonDir).digest("hex").slice(0, 8)
  return { worktree, commonDir, slug: `${basename(mainDir)}-${hash}` }
}

export async function currentBranch(worktree: string): Promise<string | null> {
  try {
    return (await git(worktree, ["symbolic-ref", "--short", "-q", "HEAD"])).trim() || null
  } catch {
    return null
  }
}

export async function baseTree(worktree: string): Promise<string> {
  if (!(await hasHead(worktree))) return EMPTY_TREE
  return (await git(worktree, ["rev-parse", "HEAD^{tree}"])).trim()
}

// The tree the working copy would commit, untracked files included, built in a throwaway index
// so the user's index, stash and branches are never touched.
export async function snapshot(worktree: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ownship-index-"))
  const env = { GIT_INDEX_FILE: join(dir, "index") }
  try {
    await git(
      worktree,
      (await hasHead(worktree)) ? ["read-tree", "HEAD"] : ["read-tree", "--empty"],
      env,
    )
    await git(worktree, ["add", "-A"], env)
    return (await git(worktree, ["write-tree"], env)).trim()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const OPS: Record<string, Change["op"]> = {
  A: "add",
  M: "modify",
  D: "delete",
  R: "rename",
  T: "modify",
}

export async function diffTrees(worktree: string, base: string, head: string): Promise<Change[]> {
  if (base === head) return []
  const flags = ["--find-renames", "--no-color", "--no-ext-diff"]
  // name-status and the patch list files in the same order, so they pair up by index.
  const status = (await git(worktree, ["diff", ...flags, "--name-status", "-z", base, head])).split(
    "\0",
  )
  const entries: { op: Change["op"]; path: string }[] = []
  for (let i = 0; i < status.length - 1;) {
    const code = status[i] ?? ""
    const renamed = code.startsWith("R") || code.startsWith("C")
    const path = (renamed ? status[i + 2] : status[i + 1]) ?? ""
    entries.push({ op: OPS[code[0] ?? "M"] ?? "modify", path })
    i += renamed ? 3 : 2
  }
  const patches = (await git(worktree, ["diff", ...flags, base, head]))
    .split(/^(?=diff --git )/m)
    .filter((chunk) => chunk.startsWith("diff --git "))
  return entries.map((entry, index) => ({ ...entry, patch: patches[index] ?? "" }))
}
