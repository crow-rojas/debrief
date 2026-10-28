import { realpathSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { EMPTY_TREE, baseTree, diffTrees, repoIdentity, snapshot } from "../../src/capture/git.ts"
import { git, makeRepo, writeFiles } from "../helpers.ts"

describe("git snapshots", () => {
  it("snapshot leaves the user's index and status untouched", async () => {
    const repo = makeRepo({ "a.py": "a\n", "b.py": "b\n" })
    writeFiles(repo, { "a.py": "a2\n", "b.py": "b2\n", "new.py": "n\n" })
    git(repo, "add", "a.py")
    const status = git(repo, "status", "--porcelain")
    await snapshot(repo)
    expect(git(repo, "diff", "--cached", "--name-only")).toBe("a.py")
    expect(git(repo, "status", "--porcelain")).toBe(status)
  })

  it("diff between two snapshots holds only what changed in between", async () => {
    const repo = makeRepo({ "x.py": "1\n", "y.py": "1\n" })
    writeFiles(repo, { "y.py": "2\n" })
    const first = await snapshot(repo)
    writeFiles(repo, { "x.py": "2\n" })
    const second = await snapshot(repo)
    const changes = await diffTrees(repo, first, second)
    expect(changes.map(({ path, op }) => ({ path, op }))).toEqual([{ path: "x.py", op: "modify" }])
    expect(changes[0]?.patch).toContain("+2")
  })

  it("untracked files are included and ignored files are not", async () => {
    const repo = makeRepo({ ".gitignore": "build/\n" })
    const before = await snapshot(repo)
    writeFiles(repo, { "n.py": "new\n", "build/out.js": "x\n" })
    const changes = await diffTrees(repo, before, await snapshot(repo))
    expect(changes.map(({ path, op }) => ({ path, op }))).toEqual([{ path: "n.py", op: "add" }])
  })

  it("works in a repo with no commits", async () => {
    const repo = makeRepo()
    writeFiles(repo, { "first.py": "x\n" })
    expect(await baseTree(repo)).toBe(EMPTY_TREE)
    const changes = await diffTrees(repo, EMPTY_TREE, await snapshot(repo))
    expect(changes.map((c) => c.path)).toEqual(["first.py"])
  })

  it("works with a detached HEAD and during a merge conflict", async () => {
    const repo = makeRepo({ "c.txt": "base\n" })
    git(repo, "switch", "-q", "-c", "other")
    writeFiles(repo, { "c.txt": "other\n" })
    git(repo, "commit", "-q", "-am", "chore: other")
    git(repo, "switch", "-q", "main")
    writeFiles(repo, { "c.txt": "main\n" })
    git(repo, "commit", "-q", "-am", "chore: main")
    expect(() => git(repo, "merge", "other")).toThrow()
    expect(await snapshot(repo)).toMatch(/^[0-9a-f]{40}$/)
    git(repo, "merge", "--abort")
    git(repo, "switch", "-q", "--detach", "HEAD~1")
    expect(await snapshot(repo)).toMatch(/^[0-9a-f]{40}$/)
  })

  it("worktrees share commonDir and slug but not worktree", async () => {
    const repo = makeRepo({ "a.txt": "a\n" })
    const other = join(repo, "..", `${repo.split("/").pop()}-wt`)
    git(repo, "worktree", "add", "-q", other)
    const main = await repoIdentity(repo)
    const linked = await repoIdentity(join(other))
    expect(main && linked).toBeTruthy()
    expect(linked?.commonDir).toBe(main?.commonDir)
    expect(linked?.slug).toBe(main?.slug)
    expect(linked?.worktree).toBe(realpathSync(other))
    expect(main?.worktree).toBe(realpathSync(repo))
    expect(main?.slug).toMatch(new RegExp(`^${repo.split("/").pop()}-[0-9a-f]{8}$`))
  })

  it("returns null outside git", async () => {
    expect(await repoIdentity("/")).toBeNull()
  })
})
