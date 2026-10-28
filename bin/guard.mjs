#!/usr/bin/env node
// Fails when a change weakens the test suite or edits the harness that enforces it.
// A human can let one branch through with a commit trailer:
//   Guard-Override: tests <reason> | harness <reason>
// The test count is a heuristic: it catches deleted and skipped tests, not a gutted test body.
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

function git(...args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    }).trim()
  } catch {
    console.error(`guard: git ${args[0]} failed, so nothing was checked`)
    process.exit(1)
  }
}

const TEST_PATTERN = /^\s*(it|test)(\.each\(.*?\))?\s*\(\s*["'`]/gm
const SKIP_PATTERN = /^\+\s*((it|test|describe)\.(skip|only|todo)|x(it|describe))\(/
const TEST_FILE = /^test\/.*\.test\.ts$/
// package.json counts too, but only its scripts: see below.
const HARNESS = [
  "bin/",
  "lefthook.yml",
  ".claude/",
  ".codex/",
  ".github/",
  "eslint.config.js",
  ".prettierrc",
  ".prettierignore",
  "tsconfig.json",
  "vitest.config.ts",
  "pnpm-workspace.yaml",
  "test/bin/guard.test.ts",
]

function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function testCount(ref) {
  const files = ref ? git("ls-tree", "-r", "--name-only", ref, "test").split("\n") : walk("test")
  return files
    .filter((file) => TEST_FILE.test(file))
    .reduce((sum, file) => {
      const source = ref ? git("show", `${ref}:${file}`) : readFileSync(file, "utf8")
      return sum + (source.match(TEST_PATTERN)?.length ?? 0)
    }, 0)
}

const baseRef = ["origin/main", "main"].find((ref) => {
  try {
    execFileSync("git", ["rev-parse", "--verify", "-q", ref], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
})
if (!baseRef) {
  console.error("guard: no main branch to compare against")
  process.exit(1)
}
const base = git("merge-base", "HEAD", baseRef)
const overrides = git("log", "--format=%(trailers:key=Guard-Override,valueonly)", `${base}..HEAD`)
  .split("\n")
  .map((line) => line.trim().split(/\s+/)[0]?.toLowerCase())
const allowTests = overrides.includes("tests")
const allowHarness = overrides.includes("harness")
const failures = []

const before = testCount(base)
const after = testCount()
if (after < before && !allowTests)
  failures.push(`the number of tests went down (${before} -> ${after})`)

const untracked = git("ls-files", "--others", "--exclude-standard", "--", "test")
  .split("\n")
  .filter((f) => TEST_FILE.test(f))
const added = [
  ...git("diff", base, "--unified=0", "--", "test")
    .split("\n")
    .filter((line) => line.startsWith("+")),
  ...untracked.flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .map((line) => `+${line}`),
  ),
]
const skips = added.filter((line) => SKIP_PATTERN.test(line))
if (skips.length && !allowTests)
  failures.push(`new skip, only or todo in tests:\n${skips.join("\n")}`)

// The guard cannot protect a harness that main does not have yet: the branch that adds it goes in.
const baseHasHarness = git("ls-tree", "--name-only", base, "bin/guard.mjs") !== ""
if (baseHasHarness) {
  const changed = git("diff", "--name-only", base).split("\n").filter(Boolean)
  const changedHarness = changed.filter((file) =>
    HARNESS.some((h) => (h.endsWith("/") ? file.startsWith(h) : file === h)),
  )
  const scripts = (json) => JSON.stringify(JSON.parse(json).scripts ?? {})
  if (
    scripts(git("show", `${base}:package.json`)) !== scripts(readFileSync("package.json", "utf8"))
  ) {
    changedHarness.push("package.json (scripts)")
  }
  if (changedHarness.length && !allowHarness) {
    failures.push(
      `the harness changed, which needs a human's Guard-Override: harness <reason>:\n${changedHarness.join("\n")}`,
    )
  }
}

if (failures.length) {
  console.error(failures.map((f) => `guard: ${f}`).join("\n"))
  process.exit(1)
}
