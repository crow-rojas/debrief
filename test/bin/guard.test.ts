import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { describe, expect, it } from "vitest"

const GUARD = resolve("bin/guard.mjs")
const PACKAGE = JSON.stringify({ scripts: { test: "vitest run" } })
const TWO_TESTS = `it("a", () => {})\nit("b", () => {})\n`

// Git hooks export GIT_DIR and friends; inherited, they would point every command at the real repository.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
)

function write(root: string, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
}

// Runs the guard in a throwaway repo whose main has package.json, a guard and base (null drops an
// entry), then a branch commit with files.
function guardAfter(
  files: Record<string, string>,
  extraBase: Record<string, string | null> = {},
  message = "chore: change",
) {
  const base = Object.fromEntries(
    Object.entries({ "package.json": PACKAGE, "bin/guard.mjs": "// guard\n", ...extraBase }).filter(
      (entry): entry is [string, string] => entry[1] !== null,
    ),
  )
  const root = mkdtempSync(join(tmpdir(), "guard-"))
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, env, stdio: "pipe" })
  git("init", "-q", "-b", "main")
  git("config", "user.email", "test@example.com")
  git("config", "user.name", "Test")
  git("config", "commit.gpgsign", "false")
  write(root, { "src/index.ts": "export {}\n", ...base })
  git("add", "-A")
  git("commit", "-q", "-m", "chore: base")
  git("switch", "-q", "-c", "work")
  write(root, files)
  git("add", "-A")
  git("commit", "-q", "--allow-empty", "-m", message)
  const run = spawnSync("node", [GUARD], { cwd: root, env, encoding: "utf8" })
  return { status: run.status, output: run.stderr + run.stdout }
}

describe("bin/guard", () => {
  it("fails when the test count drops", () => {
    const { status, output } = guardAfter(
      { "test/a.test.ts": `it("a", () => {})\n` },
      { "test/a.test.ts": TWO_TESTS },
    )
    expect(status).toBe(1)
    expect(output).toContain("the number of tests went down (2 -> 1)")
  })

  it("fails on a new skip or only", () => {
    const { status, output } = guardAfter({
      "test/a.test.ts": `${TWO_TESTS}it.skip("c", () => {})\n`,
    })
    expect(status).toBe(1)
    expect(output).toContain("new skip")
  })

  it("fails when the harness changes without an override", () => {
    const base = { "lefthook.yml": "pre-commit:\n" }
    const files = { "lefthook.yml": "pre-commit:\n  jobs: []\n" }
    expect(guardAfter(files, base).status).toBe(1)
    const overridden = guardAfter(files, base, "chore: change\n\nGuard-Override: harness reason")
    expect(overridden.status, overridden.output).toBe(0)
  })

  it("counts a changed package.json script as a harness change", () => {
    const { status, output } = guardAfter({
      "package.json": JSON.stringify({ scripts: { test: "true" } }),
    })
    expect(status).toBe(1)
    expect(output).toContain("package.json (scripts)")
  })

  it("lets the first harness in when main has none", () => {
    const files = { "lefthook.yml": "pre-commit:\n", "package.json": PACKAGE }
    const { status, output } = guardAfter(files, { "bin/guard.mjs": null, "package.json": null })
    expect(status, output).toBe(0)
  })

  it("does not treat issue and pull request templates as harness", () => {
    const { status, output } = guardAfter({
      ".github/ISSUE_TEMPLATE/bug_report.yml": "name: Bug\n",
    })
    expect(status, output).toBe(0)
  })

  it("still guards the workflows", () => {
    const base = { ".github/workflows/ci.yml": "on: push\n" }
    expect(guardAfter({ ".github/workflows/ci.yml": "on: pull_request\n" }, base).status).toBe(1)
  })

  it("passes an ordinary change", () => {
    const { status, output } = guardAfter({ "src/index.ts": "export const a = 1\n" })
    expect(status, output).toBe(0)
  })
})
