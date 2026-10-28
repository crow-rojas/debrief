#!/usr/bin/env node
// Every check CI runs, in order, stopping at the first failure. CI_FAST=1 (bin/check) skips the slow ones.
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync } from "node:fs"

const fast = process.env.CI_FAST === "1"
const onPath = (bin) => spawnSync("sh", ["-c", `command -v ${bin}`]).status === 0

const steps = [
  ["eslint", ["pnpm", "exec", "eslint", "--cache", "--max-warnings", "0", "."]],
  ["prettier", ["pnpm", "exec", "prettier", "--check", "--log-level", "warn", "."]],
  ["types", ["pnpm", "exec", "tsc", "--noEmit"]],
  existsSync("app") && [
    "vue types",
    ["pnpm", "exec", "vue-tsc", "--noEmit", "-p", "tsconfig.app.json"],
  ],
  ["tests", ["pnpm", "exec", "vitest", "run"]],
  ["guard", ["node", "bin/guard.mjs"]],
  !fast && existsSync("vite.config.ts") && ["build", ["pnpm", "run", "build"]],
  !fast && onPath("gitleaks") && ["gitleaks", ["gitleaks", "git", "--redact", "--no-banner"]],
].filter(Boolean)

for (const [name, [command, ...args]] of steps) {
  const started = Date.now()
  try {
    execFileSync(command, args, { stdio: "inherit" })
  } catch {
    console.error(`\n✗ ${name} failed`)
    process.exit(1)
  }
  console.log(`✓ ${name} (${((Date.now() - started) / 1000).toFixed(1)} s)`)
}
